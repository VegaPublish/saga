const cors = require('cors')
const pino = require('pino')
const {errors} = require('celebrate')
const passport = require('passport')
const express = require('express')
const session = require('express-session')
const bodyParser = require('body-parser')
const MongoStore = require('connect-mongo')(session)
const cookieParser = require('cookie-parser')
const pkg = require('../package.json')
const errorHandler = require('./middleware/errorHandler')
const StoreManager = require('./datastore/StoreManager')
const checkForAssetDelete = require('./controllers/assets/actions/checkForAssetDelete')
const SecurityManager = require('./security/SecurityManager')
const applyAuthStrategies = require('./authentication/applyStrategies')
const UserStore = require('./userstore')
const getFileStore = require('./filestore')
const bearerToCookie = require('./middleware/bearerToCookie')

module.exports = config => {
  const app = express()
  const log = pino({
    level: config.logLevel
  })
  const fileStore = getFileStore(config.assets)
  const dataStore = new StoreManager(config.datastore)
  const userStore = new UserStore({
    dataStore,
    db: config.datastore.options.systemDb
  })
  const securityManager = new SecurityManager({
    userStore,
    dataStore,
    featurePlugins: config.vega.featurePlugins
  })
  const sessionStore = new MongoStore({
    ...config.sessionStore,
    dbPromise: dataStore.connect().then(client => client.db(config.datastore.options.systemDb))
  })

  const sessionParser = session({
    ...config.session,
    store: sessionStore
  })

  dataStore.setSecurityManager(securityManager)
  dataStore.on('mutation', securityManager.onMutation)
  dataStore.on('mutation', checkForAssetDelete.bind(null, app))

  app.services = {
    log,
    config,
    sessionStore,
    fileStore,
    dataStore,
    userStore,
    sessionParser,
    securityManager
  }

  app.disable('x-powered-by')
  app.set('trust proxy', 1)
  app.use(bearerToCookie)
  app.use(sessionParser)
  app.use(cookieParser())
  app.use(cors(config.cors))
  app.use(passport.initialize())
  app.use(passport.session())

  app.get('/', (req, res) =>
    res.json({
      service: pkg.name,
      version: pkg.version
    })
  )

  app.get('/v1/ping', (req, res) =>
    res.json({
      pong: true
    })
  )
  app.get('/v1/versions', require('./controllers/versions'))

  app.use(
    '/v1/auth',
    bodyParser.json({
      limit: config.data.maxInputBytes
    }),
    require('./controllers/auth')(applyAuthStrategies(app, config))
  )

  app.use(
    '/v1/users',
    bodyParser.json({
      limit: config.data.maxInputBytes
    }),
    require('./controllers/users')
  )

  app.use(
    '/v1/permissions',
    bodyParser.json({
      limit: config.data.maxInputBytes
    }),
    require('./controllers/permissions')
  )

  app.use(
    '/v1/invitations',
    bodyParser.json({
      limit: config.data.maxInputBytes
    }),
    require('./controllers/invitations')(applyAuthStrategies(app, config))
  )

  app.use(
    '/v1/data',
    bodyParser.json({
      limit: config.data.maxInputBytes
    }),
    require('./controllers/data')
  )

  app.use(
    '/v1/datasets',
    bodyParser.json({
      limit: config.data.maxInputBytes
    }),
    require('./controllers/datasets')
  )

  app.use(
    '/v1/assets',
    bodyParser.raw({
      limit: config.assets.maxInputBytes,
      type: () => true
    }),
    require('./controllers/assets/upload')
  )

  app.use(
    '/v1/publish',
    bodyParser.raw({
      limit: config.assets.maxInputBytes
    }),
    require('./controllers/publish')
  )

  app.use(require('./controllers/assets/serve'))

  app.use(errors())
  app.use(errorHandler)

  return app
}
