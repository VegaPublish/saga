const {query: execQuery} = require('../../vega-ql')

const exportDocuments = async (req, res, next) => {
  const {dataStore, securityManager} = req.app.services
  const {dataset} = req.params
  const {filters} = await securityManager.getPermissionsForUser(dataset, req.user && req.user.id)

  let results
  try {
    const store = await dataStore.forDataset(dataset)
    results = await store.getAllDocuments()
  } catch (err) {
    next(err)
    return
  }

  res.writeHead(200, 'OK', {'Content-Type': 'application/x-ndjson'})
  results.on('end', () => res.end())
  results.on('error', next)
  results.on('document', async doc => {
    const isReadable = await documentIsReadable(doc, filters.read)
    if (!isReadable) {
      return
    }

    res.write(`${JSON.stringify(doc)}\n`)
  })
}

async function documentIsReadable(doc, filter) {
  const results = await execQuery({
    source: '*',
    globalFilter: filter,
    params: {},
    fetcher: spec => ({
      results: [doc],
      start: 0
    })
  })

  return results.length > 0
}

module.exports = exportDocuments
