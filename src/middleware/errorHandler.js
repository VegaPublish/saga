const Boom = require('boom')
const extendBoom = require('../util/extendBoom')

module.exports = (err, req, res, next) => {
  const error = errorResponse(res, err)
  const log = req.app.services && req.app.services.log
  const code = getStatusCode(
    (error.output && error.output.statusCode) || error.statusCode || error.code
  )

  if (log && (!code || code >= 500)) {
    log.error(error)
  }
}

function getStatusCode(statusCode) {
  const code = Number(statusCode || 500)
  return !isNaN(code) && code >= 400 && code <= 599 ? code : 500
}

function wrapInBoom(err) {
  let error = err

  const isError = error instanceof Error
  if (!isError && error.Message && err.Pos) {
    error = Boom.badRequest(error.Message)
  } else if (!isError) {
    error = new Error('Unknown error encountered')
  }

  if (!error.isBoom) {
    error = Boom.boomify(error, {statusCode: getStatusCode(error.statusCode)})
    error = error.payload ? extendBoom(error, error.payload) : error
  }

  return error
}

function errorResponse(res, err) {
  const error = wrapInBoom(err)
  const statusCode = getStatusCode(
    err.code || err.statusCode || (error.output && error.output.statusCode)
  )

  const headers = error.output.headers || {}

  if (!res.headersSent) {
    res
      .set(headers)
      .status(statusCode)
      .json(error.output.payload)
  }

  return error
}
