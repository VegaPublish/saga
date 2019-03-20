// Given a dataset + an issue id, performs a "dry run" publication checking whether
//
const Boom = require('boom')
const {get} = require('lodash')
const Publisher = require('./Publisher')
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

    const publisher = new Publisher({store, issueId})
    const output = await publisher.prepare()

    // Prepare a hash map where the key is document id and the
    // value is the revision of the published version.
    const preExisting = {}
    await storePub
      .fetch('*[_id in $ids]|{_id, _srcRev}', {
        ids: output.map(doc => doc._id)
      })
      .then(docs =>
        docs.forEach(doc => {
          preExisting[doc._id] = doc._srcRev
        })
      )

    const unpublished = output.filter(doc => doc._srcRev !== preExisting[doc._id])

    res.json({
      issueId: req.params.issue,
      readyToPublish: publisher.unpublishable.length == 0,
      unpublishable: publisher.unpublishable,
      unpublished: unpublished.map(doc => ({
        _id: doc._id,
        _type: doc._type,
        title: doc.title
      }))
    })
  } catch (err) {
    return next(err)
  }
}
