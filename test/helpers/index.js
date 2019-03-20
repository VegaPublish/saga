const close = require('./close')
const getConfig = require('./getConfig')
const getApp = require('./getApp')
const getCallbackServer = require('./getCallbackServer')
const createAdminUser = require('./createAdminUser')
const createSession = require('./createSession')
const getSessionCookie = require('./getSessionCookie')
const createUserlessSession = require('./createUserlessSession')

const delay = (ms = 250) =>
  new Promise(resolve => (ms ? setTimeout(resolve, ms) : setImmediate(resolve)))

module.exports = {
  close,
  delay,
  getApp,
  getConfig,
  getCallbackServer,
  createAdminUser,
  createSession,
  createUserlessSession,
  getSessionCookie
}
