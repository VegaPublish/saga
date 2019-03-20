const crypto = require('crypto')
const processImage = require('./actions/processImage')
const removeUndefined = require('../../util/removeUndefined')
const getAssetProps = require('./actions/getAssetProps')
const verifyPermissions = require('./actions/verifyPermissions')

module.exports = async (req, res, next) => {
  const {dataset} = req.params
  const {dataStore, fileStore} = req.app.services
  const {label, title, description} = req.query
  const store = await dataStore.forDataset(dataset)

  let imageData
  try {
    imageData = await processImage(req.body)
  } catch (err) {
    next(err)
    return
  }

  const doc = removeUndefined({
    _type: `lyra.imageAsset`,
    label,
    title,
    description,
    ...getAssetMeta(req, imageData)
  })

  // Verify that the session has access to create the document
  try {
    await verifyPermissions(req, store, doc)
  } catch (error) {
    next(error)
    return
  }

  // Write the asset to its final location
  try {
    await fileStore.write(doc.path, req.body)
  } catch (error) {
    next(error instanceof Error ? error : new Error(error.message || error))
    return
  }

  // Write the asset document, exposing it to the world
  try {
    await store
      .newTransaction({identity: req.user && req.user.id})
      .createOrReplace(doc)
      .commit()
  } catch (error) {
    fileStore.delete(doc.path)
    next(error)
    return
  }

  res.json({document: doc})
}

function getAssetMeta(req, imageData) {
  const size = req.body.length
  const sha1hash = crypto
    .createHash('sha1')
    .update(req.body)
    .digest('hex')

  const {extension, mimeType, dimensions} = imageData
  const base = getAssetProps({type: 'image', imageData, sha1hash, extension, req, mimeType, size})
  return Object.assign(base, {metadata: {dimensions}})
}
