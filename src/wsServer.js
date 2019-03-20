const WebSocket = require('ws')
const passport = require('passport')
const {isPlainObject} = require('lodash')
const listen = require('./controllers/data/listenWs')

const pathMatch = /^\/v1\/data\/channel\/([-\w]+)($|\/)/
const methods = {
  listen,
  cancel: listen.cancel
}

const initPassport = passport.initialize()
const passportSession = passport.session()

module.exports = options => {
  const {wsOptions, app} = options
  const wss = new WebSocket.Server({
    ...(wsOptions || {}),
    verifyClient: verifyClient.bind(null, app)
  })

  wss.on('connection', (ws, req) => {
    const log = req.app.services.log
    const [, datasetName] = req.url.match(pathMatch) || []
    if (!datasetName) {
      log.info('Websocket requested non-websocket endpoint')
      sendError(ws, formatError({code: 4004, message: 'Missing or invalid dataset'}))
      ws.close(4004, 'Missing or invalid dataset')
      return
    }

    req.dataset = datasetName

    ws.on('message', msg => onMessage(msg, ws, req))
  })
}

function onMessage(message, ws, req) {
  const log = req.app.services.log

  let msg
  try {
    msg = parseMessage(message)
  } catch (err) {
    log.error(err)
    sendError(ws, err)
    return
  }

  log.info('Got message: %o', msg)

  if (isNoopMessage(msg)) {
    // Treat as notification (noop)
    log.info('Noop message received')
    return
  }

  const method = methods[msg.method]
  method(msg, ws, req)
}

function parseMessage(message) {
  let msg
  try {
    msg = JSON.parse(message)
  } catch (err) {
    throw formatError({code: -32700, message: 'Parse error', data: err.message})
  }

  if (!['string', 'number'].includes(typeof msg.id)) {
    throw formatError({code: -32600, message: 'Invalid Request', data: 'Invalid message ID'})
  }

  if (msg.jsonrpc !== '2.0') {
    throw formatError({
      code: -32600,
      message: 'Invalid Request',
      data: 'Unsupported jsonrpc version',
      id: msg.id
    })
  }

  const hasParams = typeof msg.params !== 'undefined'
  if (hasParams && !isPlainObject(msg.params)) {
    throw formatError({
      code: -32602,
      message: 'Invalid params',
      data: 'Only object parameters is supported'
    })
  }

  if (msg.method && !methods[msg.method]) {
    throw formatError({
      code: -32601,
      message: 'Method not found'
    })
  }

  return msg
}

function isNoopMessage(msg) {
  return !msg.id || !msg.method
}

function sendError(ws, err) {
  return ws.send(JSON.stringify(err.payload))
}

function formatError(err) {
  const {id, code, message} = err
  const error = new Error(message)
  error.payload = {jsonrpc: '2.0', error: {code, message}, id: id || null}
  return error
}

function verifyClient(app, info, done) {
  const res = {}
  const sessionParser = app.services.sessionParser
  sessionParser(info.req, res, () => {
    initPassport(info.req, res, () => {
      passportSession(info.req, res, err => {
        info.req.app = app
        done(!err)
      })
    })
  })
}
