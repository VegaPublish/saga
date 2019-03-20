const Boom = require('boom')
const extendBoom = require('../../util/extendBoom')

const {findRefs, prepareDocument} = require('./utils')

class Publisher {
  constructor({store, issueId, failOnUnpublishable}) {
    this.store = store
    this.issueId = issueId
    // Contains every id we've seen. Used to make sure we do not
    // re-add documents to the queue if they have been processed.
    this.seen = {}
    // Documents that we are going to write back to the store
    // when we are done processing. Keys are "source id", as in the
    // id the document came from. Whereas the values has the
    // rewritten id they will have once we publish this.
    this.output = {}
    // IDs of documents we need, but have yet to process
    this.queue = [issueId]
    // Documents that are not allowed to be published at this time
    this.unpublishable = []
    // After initPublishableStages() this will contain a map from track id to stage
    // ids where articles are allowed to be published.
    this.publishableStages = {}
    // This is a list of files to copy. An array of objects on the form {from: source path, to: destination path}
    this.filesToCopy = []
    // If this is set to true, the preparation process will fail if it encounters an
    // unpublishable document.
    this.failOnUnpublishable = failOnUnpublishable
  }

  fetch(query, params) {
    return this.store.fetch(query, params)
  }

  // Keep processing until we have processed the entire issue. The documents
  // we need to publish will be in the output hash.
  async chug() {
    const chunkSize = 5
    const chunk = this.queue.slice(0, chunkSize)
    this.queue = this.queue.slice(chunkSize)
    if (chunk.length == 0) return
    await this.process(chunk)
    // Keep chugging until it's empty
    await this.chug()
  }

  async initPublishableStages() {
    await this.fetch(
      `*[_type == 'track']{
      _id,
      "publishable": trackStages[mayBePublished].stage._ref
    }`
    ).then(tracks => {
      tracks.forEach(track => {
        this.publishableStages[track._id] = track.publishable
      })
    })
  }

  documentIsPublishable(doc) {
    if (doc._type === 'article') {
      if (!doc.track || !doc.stage) {
        return false
      }
      const [track, stage] = [doc.track._ref, doc.stage._ref]
      const allowedStages = this.publishableStages[track]
      if (!allowedStages) return false
      if (allowedStages.indexOf(stage) === -1) return false
    }
    return true
  }

  // Perform the entire recursive publishing operation returning the documents
  // prepared for publication.
  async prepare() {
    await this.initPublishableStages()
    // Add the venue to the documents to be published
    await this.fetch('*[_type == "venue"][0]._id').then(venueId => {
      this.queueIds([venueId])
    })
    // Now go recurse through it all
    await this.chug()
    if (this.failOnUnpublishable && this.unpublishable.length > 0) {
      throw extendBoom(
        Boom.forbidden(
          'Unable to publish, set includes documents that are not ready to be published at this time'
        ),
        {
          target: this.issueId,
          unpublishable: this.unpublishable
        }
      )
    }
    const result = Object.keys(this.output).map(key => this.output[key])
    return result
  }

  async process(ids) {
    const docs = await this.fetch('*[_id in $ids]', {ids})
    docs.forEach(doc => this.processInputDocument(doc))
  }

  // Queues up ids, making sure not to re-add id's we have seen before during this run
  queueIds(ids) {
    ids
      .filter(id => !this.seen[id])
      .forEach(id => {
        this.queue.push(id)
        this.seen[id] = true
      })
  }

  // Given a document, rewrites it to its publishable counterpart, also discovering any secondary objects
  // that should be published with it.
  processInputDocument(doc) {
    if (!this.documentIsPublishable(doc)) {
      this.unpublishable.push(doc._id)
    }
    const rewritten = prepareDocument(doc)
    if (doc._type == 'lyra.imageAsset' || doc._type == 'lyra.fileAsset') {
      this.filesToCopy.push({
        from: doc.path,
        to: rewritten.path
      })
    }
    const ids = findRefs(rewritten)
    this.queueIds(ids)
    this.output[doc._id] = rewritten
  }
}

module.exports = Publisher
