const path = require('path')
const pump = require('pump')
const url = require('url')
const FsFileStore = require('../../filestore/fs/fsFileStore')

module.exports = (req, res, next) => {
  const fileStore = req.app.services.fileStore
  const parsedUrl = url.parse(req.url, true, true)
  const filePath = path.join('files', parsedUrl.pathname)

  if ('dl' in parsedUrl.query) {
    res.set('Content-Disposition', `attachment; filename="${path.basename(parsedUrl.pathname)}"`)
  }
  if (fileStore instanceof FsFileStore) {
    res.sendFile(path.join(fileStore.getBasePath(), filePath))
  } else {
    pump(fileStore.getReadStream(req.url), res, err => {
      req.app.services.warn(err)
    })
  }
}
