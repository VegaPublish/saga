const EventEmitter = require('events')
const PQueue = require('p-queue')
const {find, isEqual} = require('lodash')
const {Patcher} = require('@lyra/mutator')
const {query: execQuery} = require('../vega-ql')
const Transaction = require('./Transaction')
const TransactionError = require('./errors/TransactionError')
const MutationError = require('./errors/MutationError')
const mapMutations = require('./mutationModifiers/mapMutations')
const findReferences = require('../util/findReferences')

class Store extends EventEmitter {
  constructor(adapter, options = {}) {
    super()
    this.adapter = adapter
    this.mutationQueue = new PQueue({
      concurrency: 1
    })
    this.isClosing = false
    this.fetch = this.fetch.bind(this)
    this.dataset = options.dataset
    this.securityManager = options.securityManager
  }

  async close() {
    this.isClosing = true
    await this.mutationQueue.onIdle()
    return this
  }

  setSecurityManager(manager) {
    this.securityManager = manager
    return this
  }

  newTransaction(options = {}) {
    return new Transaction(this, options)
  }

  getDocumentsById(ids) {
    return this.adapter.getDocumentsById(ids)
  }

  async getDocumentById(id) {
    const docs = await this.getDocumentsById([id])
    return docs ? docs[0] : null
  }

  fetch(query, params = {}, options = {}) {
    return this.adapter.fetch(query, params, options)
  }

  getAllDocuments() {
    return this.adapter.getAllDocuments()
  }

  /* eslint-disable no-await-in-loop, max-depth, id-length */
  async executeTransaction(trx, options = {}) {
    if (!this.securityManager) {
      throw new Error('No security manager provided to store')
    }

    if (this.isClosing) {
      throw new Error('Transaction cannot be performed; store is closing')
    }

    const {filters} = await this.securityManager.getPermissionsForUser(
      this.dataset,
      options.identity
    )

    const annotations = {
      ...(options.annotations || {}),
      venueId: this.dataset
    }
    const muts = trx.getMutations()
    const transactionId = trx.getTransactionId()
    const identity = trx.getIdentity()
    const timestamp = new Date()
    const ids = getTouchedDocumentIds(muts)
    const mutations = mapMutations(muts, {
      timestamp,
      transaction: trx
    })

    this.emit('queue-mutation', {
      blocked: this.mutationQueue.pending > 0,
      dataset: this.dataset
    })

    // eslint-disable-next-line complexity, max-statements
    return this.mutationQueue.add(async () => {
      const documents = await this.adapter.getDocumentsById(ids)
      const transaction = await this.adapter.startTransaction()

      // A list of all documents that will be created/patched during this transaction
      const patchDocs = mergeCreatedDocuments(mutations, documents)

      const docsCache = {}
      patchDocs.forEach(doc => {
        docsCache[doc._id] = doc
      })

      let results = []
      try {
        for (let m = 0; m < mutations.length; m++) {
          const {operation, body} = mutations[m]
          if (!this.adapter[operation]) {
            throw new Error(`Operation "${operation}" not implemented`)
          }

          // Apply patches with mutator to avoid having to the same work in each adapter
          const isDelete = operation === 'delete'
          const isPatch = operation === 'patch'
          const targetDoc = isPatch && docsCache[body.id]
          let next
          if (isPatch && targetDoc) {
            const patch = new Patcher(body)
            next = patch.apply(targetDoc)
            docsCache[next._id] = next

            // Permission and foreign keys checks
            await Promise.all([
              checkPermissions(filters.update, targetDoc, 'update', m),
              checkPermissions(filters.update, next, 'update', m)
            ])
          }

          if (operation === 'createIfNotExists') {
            const _id = idFromMutation(operation, body)
            if (await this.getDocumentById(_id)) {
              console.log(`Skipped createIfNotExists for ${_id} because it actually does exist.`)
              continue
            }
          }

          if (operation === 'create' || operation === 'createIfNotExists') {
            await checkPermissions(filters.create, body, 'create', m)
          }

          if (operation === 'createOrReplace') {
            const prev = documents.find(doc => doc._id === body._id)
            await (prev
              ? Promise.all([
                  checkPermissions(filters.delete, prev, 'delete', m),
                  checkPermissions(filters.create, body, 'create', m)
                ])
              : checkPermissions(filters.create, body, 'create', m))
          }

          const deleteDoc = isDelete && documents.find(doc => doc._id === body.id)
          if (deleteDoc) {
            await checkPermissions(filters.delete, deleteDoc, 'delete', m)
            await this.checkForeignKeysDeletion(deleteDoc, null, m)
          }

          if (isPatch || operation.startsWith('create')) {
            await this.checkForeignKeysCreation(next || body, patchDocs, m)
          }

          // Execute operation
          try {
            results.push(
              await this.adapter[operation](body, {
                transaction,
                next
              })
            )
          } catch (err) {
            if (err instanceof MutationError) {
              throw new TransactionError({
                errors: [
                  {
                    error: err.payload,
                    index: m
                  }
                ]
              })
            }

            throw err
          }
        }

        results = results.filter(Boolean)

        const refPatches = generateDocumentReferencePatches(results, documents)
        for (let i = 0; i < refPatches.length; i++) {
          const patch = refPatches[i]
          await this.adapter.setReferences(patch.id, patch.references, {
            transaction
          })
        }

        await transaction.commit()

        this.emitMutationEvents({
          mutations: muts,
          transactionId,
          timestamp,
          identity,
          results,
          documents,
          annotations
        })
      } catch (err) {
        await transaction.abort()
        throw err
      }

      return results
    })
  }
  /* eslint-enable no-await-in-loop, max-depth, id-length */

  async checkForeignKeysDeletion(targetDoc, patchDocs, i) {
    const referencingIDs = await this.adapter.findReferencingDocuments(targetDoc._id, {
      includeWeak: false
    })

    if (referencingIDs.length === 0) {
      return
    }

    const description = `Document "${
      targetDoc._id
    }" cannot be deleted as there are references to it from "${referencingIDs[0]}"`

    throw new TransactionError({
      errors: [
        {
          error: {
            description,
            id: targetDoc._id,
            referencingIDs,
            type: 'documentHasExistingReferencesError'
          },
          index: i
        }
      ],
      statusCode: 409
    })
  }

  async checkForeignKeysCreation(next, patchDocs, i) {
    // See if the document references any items strongly, and validate that the documents exist
    const strongRefs = findReferences(next)
      .filter(ref => !ref.weak)
      .map(ref => ref.id)

    const existingIds = strongRefs && (await this.adapter.documentsExists(strongRefs))
    const allExistingIds = (existingIds || []).concat(patchDocs.map(doc => doc._id))
    const missing = strongRefs && strongRefs.find(id => !allExistingIds.includes(id))
    if (!missing) {
      return
    }

    const description = `Document "${next._id}" references non-existent document "${missing}"`
    throw new TransactionError({
      errors: [
        {
          error: {
            description,
            id: next._id,
            referenceID: missing,
            type: 'documentReferenceDoesNotExistError'
          },
          index: i
        }
      ],
      statusCode: 409
    })
  }

  emitMutationEvents(options) {
    const {mutations, transactionId, timestamp, identity, results, documents, annotations} = options
    const mutationResults = getUniqueDocumentResults(results)
    mutationResults.forEach(result => {
      const documentId = result.id
      const previous = documents.find(doc => doc._id === documentId)

      this.emit('mutation', {
        type: 'mutation',
        eventId: `${transactionId}#${documentId}`,
        documentId,
        transactionId,
        identity,
        resultRev: transactionId,
        timestamp: timestamp.toISOString(),
        previousRev: previous ? previous._rev : undefined,
        previous,
        mutations: getMutationsForDocumentId(mutations, documentId),
        result: result.document,
        annotations
      })
    })
  }

  truncate() {
    // eslint-disable-next-line no-process-env
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Refusing to truncate when NODE_ENV is not "test"')
    }

    return this.adapter.truncate()
  }
}

function getUniqueDocumentResults(allResults) {
  const seenIds = new Set()
  const results = []

  for (let i = allResults.length - 1; i >= 0; i--) {
    const result = allResults[i]
    if (seenIds.has(result.id)) {
      continue
    }

    seenIds.add(result.id)
    results.unshift(result)
  }

  return results
}

function getTouchedDocumentIds(mutations) {
  return Array.from(
    mutations.reduce((set, mutation) => {
      const operation = Object.keys(mutation)[0]
      const body = mutation[operation]
      return set.add(idFromMutation(operation, body))
    }, new Set())
  )
}

function getMutationsForDocumentId(mutations, documentId) {
  return mutations.filter(mutation => {
    const [operation] = Object.keys(mutation)
    return operation && idFromMutation(operation, mutation[operation]) === documentId
  })
}

function idFromMutation(operation, body) {
  switch (operation) {
    case 'create':
    case 'createOrReplace':
    case 'createIfNotExists':
      return body._id
    case 'delete':
    case 'patch':
      return body.id
    default:
      throw new Error(`Unknown mutation type "${operation}"`)
  }
}

function mergeCreatedDocuments(mutations, existing) {
  return (
    mutations
      // Remove non-create (or id-less) mutations
      .filter(mut => mut.operation.startsWith('create') && mut.body._id)
      // Remove create/createIfNotExists if document exists
      .filter(mut => isReplace(mut) || !existing.find(doc => doc._id === mut.body._id))
      // Remove creates that exist later in mutation array
      .filter((mut, i, muts) => !find(muts, item => item.body._id === mut.body._id, i + 1))
      // Merge remaining mutations, make sure to override existing documents with same ID
      .reduce((docs, mut) => {
        const prev = existing.findIndex(doc => doc._id === mut._id)
        return prev === -1 ? docs.concat(mut.body) : docs.splice(prev, 1, mut.body) && docs
      }, existing.slice())
  )
}

function isReplace(mut) {
  return mut.operation === 'createOrReplace'
}

function generateDocumentReferencePatches(results, prevDocs) {
  const mutationResults = getUniqueDocumentResults(results)

  const refs = mutationResults.map(result => {
    const prevDoc = prevDocs.find(doc => doc._id === result.id)
    const prevRefs = prevDoc && findReferences(prevDoc)
    const newRefs = findReferences(result.document)

    if (!prevDoc && newRefs.length === 0) {
      return false
    }

    const hasDiff =
      !prevDoc ||
      prevRefs.length !== newRefs.length ||
      prevRefs.some((prevRef, idx) => !isEqual(prevRef, newRefs[idx]))

    return (
      hasDiff && {
        id: result.id,
        references: newRefs
      }
    )
  })

  return refs.filter(Boolean)
}

async function checkPermissions(filter, doc, permission, i) {
  const hasAccess = await filterMatchesDocument(filter, doc)
  if (hasAccess) {
    return true
  }

  throw new TransactionError({
    errors: [
      {
        error: {
          description: `Insufficient permissions; permission "${permission}" required`,
          permission,
          type: 'insufficientPermissionsError'
        },
        index: i
      }
    ],
    statusCode: 403
  })
}

async function filterMatchesDocument(filter, doc) {
  if (!filter) {
    return true
  }
  const filterAsQuery = `*[${filter}]`
  const results = await execQuery({
    source: filterAsQuery,
    params: {},
    fetcher: spec => ({
      results: [doc],
      start: 0
    })
  })

  return Array.isArray(results) && results.length > 0
}

module.exports = Store
