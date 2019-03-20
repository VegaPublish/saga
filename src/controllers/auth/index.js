const express = require('express')
const passport = require('passport')
const {celebrate, Joi} = require('celebrate')
const callback = require('./callback')
const loginError = require('./loginError')
const logout = require('./logout')
const listProviders = require('./listProviders')

module.exports = strategies => {
  const auth = express.Router()

  auth.get('/error', loginError)
  auth.post('/logout', logout)
  auth.get('/providers', listProviders.bind(null, strategies))

  strategies.forEach(strategy => {
    auth.get(
      `/login/${strategy.name}`,
      celebrate({
        query: Joi.object({
          venue: Joi.string().optional(),
          type: Joi.string()
            .allow(['cookie', 'token', 'listen'])
            .default('cookie'),
          origin: Joi.string()
            .uri()
            .when('type', {
              is: 'cookie',
              then: Joi.optional(), // @todo
              otherwise: Joi.optional()
            }),
          uuid: Joi.string().when('type', {
            is: 'token',
            then: Joi.required(),
            otherwise: Joi.optional()
          })
        })
      }),
      (req, res, next) => {
        req.session.loginInfo = req.query
        req.session.save()
        next()
      },
      passport.authenticate(strategy.name, strategy.authConfig)
    )

    auth.get(
      `/callback/${strategy.name}`,
      passport.authorize(strategy.name, {
        failureRedirect: '/v1/auth/error',
        successRedirect: '/v1/users/me'
      }),
      callback.bind(null, strategy)
    )
  })

  return auth
}
