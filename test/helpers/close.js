const fse = require('fs-extra')

module.exports = async app => {
  await app.services.dataStore.closeAll()
  await app.services.dataStore.disconnect()
  await app.services.sessionStore.close()
  await fse.remove(app.services.config.assets.options.basePath)
}
