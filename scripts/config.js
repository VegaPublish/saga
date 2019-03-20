const {ensureConnected} = require('./utils')

const StoreManager = require('../src/datastore/StoreManager')
const {adminPermissions} = require('../src/security/securityConstants')
const config = require('../src/config')
const url = require('url')
const UserStore = require('../src/userstore')

const SERVER_URL = url.format({
  protocol: 'http',
  hostname: config.hostname,
  port: config.port
})

exports.ROOT_CLAIM_URL = url.format({
  protocol: 'http',
  hostname: config.hostname,
  port: config.port,
  pathname: `/v1/invitations/root/login`
})

exports.ROOT_INVITE_URL = url.format({
  protocol: 'http',
  hostname: config.hostname,
  port: config.port,
  pathname: `/v1/invitations/root`
})

const fullAccessDatastore = new StoreManager(config.datastore)
fullAccessDatastore.setSecurityManager({
  getPermissionsForUser: () => Promise.resolve(adminPermissions)
})

const userStore = new UserStore({
  dataStore: fullAccessDatastore,
  db: config.datastore.options.systemDb
})

exports.withFullAccessDataStore = function withFullAccessDataStore(task) {
  return task(fullAccessDatastore).finally(() => fullAccessDatastore.disconnect())
}
exports.withUserStore = function withUserStore(task) {
  return task(userStore).finally(() => fullAccessDatastore.disconnect())
}

exports.connect = function connect() {
  return ensureConnected(SERVER_URL)
}
