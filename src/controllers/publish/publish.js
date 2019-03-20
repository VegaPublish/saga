// Given a dataset + an issue id, performs the entire publishing / re-publishing process
const Boom = require('boom')
const {get} = require('lodash')
const Publisher = require('./Publisher')
const SecurityManager = require('../../security/SecurityManager.js')
const {publicDatasetNameFor} = require('./utils')

module.exports = async (req, res, next) => {
  const {dataset: datasetName, issue: issueId} = req.params
  const {dataStore, securityManager, fileStore} = req.app.services
  const permissions = await securityManager.getPermissionsForUser(
    datasetName,
    req.user && req.user.id
  )

  if (!get(permissions, 'grants.update.venue')) {
    next(Boom.unauthorized('Not allowed to publish issue'))
    return
  }

  try {
    // The store to publish _from_
    const store = await dataStore.forDataset(datasetName)
    // The store to publish _to_
    const storePub = await dataStore.forDataset(publicDatasetNameFor(datasetName))

    const publisher = new Publisher({store, issueId, failOnUnpublishable: true})

    publisher
      // Recursively crawl the issue, find all objects that needs to be published with this issue and
      // generate the public versions of those given documents
      .prepare()
      .then(docs => {
        // Go publish all those prepared documents to the public dataset for this venue
        const txn = storePub.newTransaction({identity: SecurityManager.SYSTEM_IDENTITY})
        docs.forEach(doc => {
          txn.createOrReplace(doc)
        })
        return txn.commit()
      })
      .then(async txnResponse => {
        // Copy all the asset files
        await Promise.all(
          publisher.filesToCopy.map(operation => {
            return fileStore.copy(operation.from, operation.to)
          })
        )
        return txnResponse
      })
      .then(txnResponse => {
        // Extract a timestamp from the transaction respnose
        const timestampedDoc = txnResponse.results.find(doc => !!doc.document._updatedAt)
        if (!timestampedDoc) return txnResponse
        const timestamp = timestampedDoc.document._updatedAt

        // Stick that timestamp on the original issue
        return store
          .newTransaction({identity: SecurityManager.SYSTEM_IDENTITY})
          .patch(issueId, patch => patch.set({publishedAt: timestamp}))
          .commit()
          .then(async result => {
            // Because we are effectively changing the Issue object when we tag it with the publishedAt field,
            // we need to update the _srcRev field on its published counterpart to make sure it is not always
            // marked as updated in the source dataset.
            await storePub
              .newTransaction({identity: SecurityManager.SYSTEM_IDENTITY})
              .patch(issueId, patch => patch.set({_srcRev: result.transactionId}))
              .commit()
            return txnResponse
          })
          .then(response => {
            return {
              published: response.results.map(item => ({
                _id: item.document._id,
                _type: item.document._type
              })),
              timestamp: timestamp
            }
          })
      })
      .then(result => {
        res.json(result)
      })
      .catch(err => next(err))
  } catch (err) {
    next(err)
  }
}
