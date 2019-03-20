const Boom = require('boom')

module.exports = (req, res, next) => {
  next(Boom.badRequest('Login failed'))
}
