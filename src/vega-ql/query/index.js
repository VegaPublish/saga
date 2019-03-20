import parse from '../parse'
import plan from '../plan'
import exec from '../exec'
import debug from '../debug'
import { asPlainValue } from '../exec/scopeTools'

// Entry point for query engine. Accepts a VegaQL-query + a fetcher to retrieve
// data from the data source, parses, plans out and then executes the query.
// The fetcher is a query that will receive a filter expression and is expected
// to return a promise that resolves to an array of documents. The fetcher must
// provide all documents matching the filter expression, but may provide false
// positives as all documents are double checked against the filter in the
// executor. That means: a fetcher may actually return the entire database
// every time and still be compliant, although potentially slow.

module.exports = async function query(options) {
  if (typeof options !== 'object') {
    throw new Error('query() takes a singele object as parameter. {source, params, fetcher, globalFilter}')
  }
  const {source, params, fetcher, globalFilter} = options

  debug("query:", source, "params:", params, "fetcher:", fetcher)
  const ast = parse(source, params)

  const globalFilterAst = globalFilter ? parse(globalFilter, {}) : null

  const operations = plan(ast, globalFilterAst)
  const resultScope = await exec({
    operations,
    fetcher
  })

  return asPlainValue(resultScope)
}
