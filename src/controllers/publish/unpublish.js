// Given a dataset + an issue id, deletes all related documents in the public dataset
const Boom = require('boom')
const {get} = require('lodash')
const Publisher = require('./Publisher')
const SecurityManager = require('../../security/SecurityManager.js')
const {publicDatasetNameFor} = require('./utils')

module.exports = async (req, res, next) => {
  const {dataset: datasetName, issue: issueId} = req.params
  const {dataStore, securityManager} = req.app.services
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

    new Publisher({store, issueId, failOnUnpublishable: true})
      // Recursively crawl the issue, find all objects that needs to be published with this issue and
      // generate the public versions of those given documents
      .prepare()
      // Then go publish all those prepared documents to the public dataset for this venue
      .then(docs => {
        const txn = storePub.newTransaction({identity: SecurityManager.SYSTEM_IDENTITY})
        docs.forEach(doc => {
          txn.delete(doc._id)
        })
        return txn.commit()
      })
      .then(txnResponse => {
        // Unset publishedAt attr
        return store
          .newTransaction({identity: SecurityManager.SYSTEM_IDENTITY})
          .patch(issueId, patch => patch.unset(['publishedAt']))
          .commit()
      })
      .then(result => {
        res.json(result)
      })
      .catch(err => next(err))
  } catch (err) {
    return next(err)
  }
}
