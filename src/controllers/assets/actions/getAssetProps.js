const config = require('../../../config')

const getAssetProps = options => {
  const {type, sha1hash, imageData, extension, req, mimeType, size} = options
  const {width, height} = imageData ? imageData.dimensions : {}
  const datasetName = req.params.dataset
  const dstFilename = type === 'file'
    ? `${sha1hash}.${extension || 'bin'}`
    : `${sha1hash}-${width}x${height}.${extension || 'bin'}`

  const originalFilename = req.query.filename || dstFilename
  const dstPath = `${type}s/${datasetName}/${dstFilename}`
  const baseProps = {
    assetId: sha1hash,
    sha1hash,
    path: dstPath,
    url: generateAssetUrl(dstPath),
    originalFilename,
    extension,
    mimeType,
    size
  }

  if (type === 'image') {
    const ext = imageData.extension || extension
    return Object.assign({
      _id: `image-${sha1hash}-${width}x${height}-${ext}`
    }, baseProps, {
      extension
    })
  }

  return Object.assign({
    _id: `file-${sha1hash}-${extension}`
  }, baseProps)
}

function generateAssetUrl(assetPath) {
  const base = config.assets.baseUrl.replace(/\/+$/, '')
  const path = assetPath.replace(/^\/+$/, '')
  return `${base}/${path}`
}

module.exports = getAssetProps
