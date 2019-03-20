const Boom = require('boom')
const uuid = require('uuid/v4')
const {omit} = require('lodash')
const {query: execQuery} = require('../../vega-ql')
const endOfStream = require('end-of-stream')
const SseChannel = require('sse-channel')
const extendBoom = require('../../util/extendBoom')

module.exports = async (req, res, next) => {
  let messageIndex = 0
  const getMessageId = () => ++messageIndex + Date.now()

  const channel = new SseChannel({
    historySize: 250,
    jsonEncode: true,
    cors: false
  })

  channel.addClient(req, res)

  const {dataset} = req.params
  const {dataStore, securityManager} = req.app.services
  const {query, includeResult, includePreviousRevision} = req.query
  const params = Object.keys(req.query)
    .filter(param => param.startsWith('$'))
    .reduce((acc, param) => {
      acc[param.slice(1)] = parseJson(param, req.query[param])
      return acc
    }, {})

  const store = await dataStore.forDataset(dataset)
  const omitProps = ['annotations']
    .concat(includeResult ? [] : ['result'])
    .concat(includePreviousRevision ? [] : ['previous'])

  const filterOptions = {
    user: req.user && req.user.id,
    securityManager,
    dataset
  }

  const emitOptions = {
    channel,
    params,
    query,
    omitProps,
    filterOptions
  }
  const onMutation = mut => emitOnMutationMatch(mut, getMessageId(), emitOptions)

  channel.send({
    id: getMessageId(),
    data: {
      listenerName: uuid()
    },
    event: 'welcome'
  })

  store.on('mutation', onMutation)
  endOfStream(res, () => {
    store.removeListener('mutation', onMutation)
    channel.close()
  })
}

async function emitOnMutationMatch(mut, messageId, options) {
  const {query, params, channel, omitProps, filterOptions} = options

  const matchesPrev =
    mut.previous && (await queryMatchesDocument(query, mut.previous, params, filterOptions))

  const matchesNext =
    mut.result && (await queryMatchesDocument(query, mut.result, params, filterOptions))

  let transition
  if (matchesPrev && matchesNext) {
    transition = 'update'
  } else if (matchesPrev) {
    transition = 'disappear'
  } else if (matchesNext) {
    transition = 'appear'
  } else {
    return
  }

  const data = omitProps.length > 0 ? omit(mut, omitProps) : mut

  channel.send({
    id: messageId,
    event: 'mutation',
    data: {
      ...data,
      transition
    }
  })
}

async function queryMatchesDocument(query, doc, params, filterOptions) {
  const {dataset, user, securityManager} = filterOptions
  const {filters} = await securityManager.getPermissionsForUser(dataset, user)

  const results = await execQuery({
    source: query,
    globalFilter: filters.read,
    params,
    fetcher: spec => ({
      results: [doc],
      start: 0
    })
  })

  return Array.isArray(results) && results.length > 0
}

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
