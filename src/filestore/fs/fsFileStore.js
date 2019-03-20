const path = require('path')
const fse = require('fs-extra')

module.exports = class FsFileStore {
  constructor(config) {
    this.config = config
    this.options = config.options
  }

  getBasePath() {
    return this.options.basePath
  }

  getPath(dstPath) {
    return path.join(this.options.basePath, dstPath)
  }

  getReadStream(srcPath) {
    return fse.getReadStream(this.getPath(srcPath))
  }

  read(srcPath) {
    return fse.readFile(this.getPath(srcPath))
  }

  write(dstPath, content) {
    return fse.outputFile(this.getPath(dstPath), content)
  }

  delete(dstPath) {
    return fse.remove(this.getPath(dstPath))
  }

  async copy(srcPath, dstPath) {
    await fse.ensureDir(this.getPath(path.dirname(dstPath)))
    return fse.copyFile(this.getPath(srcPath), this.getPath(dstPath))
  }

  list(dstPath) {
    return fse.readdir(this.getPath(dstPath))
  }
}
