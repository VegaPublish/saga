const passport = require('passport')
const providersFallback = require('../../config/oauth.fallback.json')
const handleLogin = require('./handleLogin')

module.exports = function applyStrategies(app, config) {
  const {userStore, log} = app.services

  passport.serializeUser((user, done) => {
    log.trace(`Serializing user to ${user._id}`)
    done(null, `${user._id}`)
  })

  passport.deserializeUser(async (id, done) => {
    log.trace(`Fetching users for identity ${id}`)
    const [identity, users] = await Promise.all([
      userStore.fetchIdentityById(id),
      userStore
        .fetchUsersForIdentity(id)
        .then(result => [result.globalUser, result.venueUser].filter(Boolean))
    ])

    log.trace(`Found %d users`, users ? users.length : 0)
    done(null, {
      id,
      identity,
      users
    })
  })

  let providers

  // providers = require(config.auth.providersConfigPath)
  try {
    providers = require(config.auth.providersConfigPath)
  } catch (err) {
    if (config.auth.providersConfigPath !== config.DEFAULT_AUTH_PROVIDER_CONFIG_PATH) {
      throw err
    }
  }

  if ((config.env === 'production' || config.env === 'staging') && !providers) {
    app.services.log.warn('No OAuth configuration provided, using fallback')
  }

  providers = providers || providersFallback

  return providers.map(provider => {
    const Strategy =
      config.env === 'test'
        ? require('passport-mocked').Strategy
        : require(`passport-${provider.strategy}`).Strategy

    passport.use(new Strategy(provider.config, handleLogin.bind(null, app, provider)))
    return provider
  })
}
