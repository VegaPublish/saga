const Boom = require('boom')
const extendBoom = require('../../util/extendBoom')

async function performQuery(options, req, res, next) {
  const start = Date.now()
  const {dataStore, securityManager} = req.app.services
  const {dataset} = req.params
  const {query, params} = options
  const {filters} = await securityManager.getPermissionsForUser(dataset, req.user && req.user.id)

  let result
  try {
    const store = await dataStore.forDataset(dataset)
    const results = await store.fetch(query, params, {
      globalFilter: filters.read
    })
    result = typeof results === 'undefined' ? null : results
  } catch (err) {
    next(err)
    return
  }

  res.json({
    ms: Date.now() - start,
    query,
    result
  })
}

const get = (req, res, next) => {
  const params = Object.keys(req.query)
    .filter(param => param.startsWith('$'))
    .reduce((acc, param) => {
      acc[param.slice(1)] = parseJson(param, req.query[param])
      return acc
    }, {})

  const query = req.query.query
  return performQuery(
    {
      query,
      params
    },
    req,
    res,
    next
  )
}

const post = (req, res, next) => performQuery(req.body, req, res, next)

function parseJson(key, value) {
  try {
    return JSON.parse(value)
  } catch (err) {
    throw extendBoom(Boom.badRequest('Invalid parameter'), {
      type: 'httpBadRequest',
      error: {
        description: `Unable to parse value of "${key}=${value}". Please quote string values.`
      }
    })
  }
}

module.exports = {
  get,
  post
}
