const {noop, uniq} = require('lodash')
const EventEmitter = require('events')
const {query} = require('./filterToQuerySelector')
const MutationError = require('../../errors/MutationError')

// eslint-disable-next-line id-length
const getIds = docs => docs.map(doc => doc._id)
class DocumentEmitter extends EventEmitter {}
const writeOptions = {w: 'majority', j: true}
const supportsSession = false
const withSession = ({transaction}, options = {}) =>
  supportsSession
    ? {session: transaction.session, ...writeOptions, ...options}
    : {...writeOptions, ...options}

module.exports = class MongoDbAdapter {
  constructor(client, config, options) {
    this.databaseName = `${config.options.dbPrefix || ''}${options.dataset || 'system'}`
    this.client = client
    this.db = this.client.db(this.databaseName)
    this.collection = this.db.collection(config.options.collection || 'documents')
  }

  getDocumentsById(ids) {
    return this.collection.find({_id: {$in: ids}}).toArray()
  }

  documentsExists(ids) {
    return this.collection
      .find({_id: {$in: ids}})
      .project({_id: 1})
      .toArray()
      .then(getIds)
  }

  fetch(filter, params, options) {
    return query(this.collection, filter, params, options)
  }

  startTransaction() {
    if (!supportsSession) {
      return {commit: noop, abort: noop}
    }

    const session = this.client.startSession()
    // @todo implement actual transaction commit
    const commit = () => session.endSession()
    // @todo implement actual transaction abort
    const abort = () => session.endSession()
    return {session, commit, abort}
  }

  create(doc, options) {
    return this.collection
      .insertOne(doc, withSession(options))
      .then(() => ({
        id: doc._id,
        document: doc,
        operation: 'create'
      }))
      .catch(err => {
        if (!isDuplicateKeyError(err)) {
          throw err
        }

        throw new MutationError({
          description: `Document by ID "${doc._id}" already exists`,
          id: doc && doc._id,
          type: 'documentAlreadyExistsError',
          statusCode: 409
        })
      })
  }

  createIfNotExists(doc, options) {
    return this.collection
      .insertOne(doc, withSession(options))
      .then(() => ({
        id: doc._id,
        document: doc,
        operation: 'create'
      }))
      .catch(err => {
        if (isDuplicateKeyError(err)) {
          return null
        }

        throw err
      })
  }

  createOrReplace(doc, options) {
    return this.collection
      .findOneAndReplace({_id: doc._id}, doc, withSession(options, {upsert: true}))
      .then(res => ({
        id: doc._id,
        document: doc,
        operation: res.lastErrorObject && res.lastErrorObject.updatedExisting ? 'update' : 'create'
      }))
  }

  delete(selector, options) {
    if (!selector.id) {
      throw new Error('Can only delete by ID')
    }

    return this.collection
      .findOneAndDelete({_id: selector.id}, withSession(options))
      .then(res => (res.value ? {id: selector.id, operation: 'delete'} : null))
  }

  patch(patches, options) {
    const {next} = options
    if (!next) {
      throw new MutationError({
        description: `The document with the ID "${patches.id}" was not found`,
        id: patches.id,
        type: 'documentNotFoundError'
      })
    }

    return this.collection
      .findOneAndReplace({_id: next._id}, next, withSession(options, {upsert: true}))
      .then(() => ({
        id: next._id,
        document: next,
        operation: 'update'
      }))
  }

  setReferences(documentId, references) {
    return this.collection.findOneAndUpdate({_id: documentId}, {$set: {'@refs': references}})
  }

  findReferencingDocuments(id, options = {}) {
    const {includeWeak} = {includeWeak: true, ...options}
    const $elemMatch = includeWeak ? {id} : {id, weak: false}
    return this.collection
      .find({'@refs': {$elemMatch}})
      .project({_id: 1})
      .toArray()
      .then(getIds)
      .then(uniq)
  }

  getAllDocuments() {
    const emitter = new DocumentEmitter()
    process.nextTick(() =>
      this.collection.find().forEach(
        doc => emitter.emit('document', doc),
        err => {
          emitter.emit(err ? 'error' : 'end', err)
          emitter.removeAllListeners('document')
          emitter.removeAllListeners('error')
          emitter.removeAllListeners('end')
        }
      )
    )
    return emitter
  }

  truncate() {
    return this.collection.drop().catch(noop)
  }
}

function isDuplicateKeyError(err) {
  return err.code === 11000
}
