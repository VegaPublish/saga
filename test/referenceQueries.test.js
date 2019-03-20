import fs from 'fs'
import glob from 'glob'
import path from 'path'
import yaml from 'js-yaml'
import query from '../src/vega-ql/query'
import debug from '../src/vega-ql/debug'

describe('Reference queries (only through the runtime query executor)', () => {
  const suites = glob.sync(path.join(__dirname, 'reference_queries', '*.yml')).map(filename => {
    try {
      const yamlSrc = fs.readFileSync(filename, {
        encoding: "UTF8"
      })
      return yaml.safeLoad(yamlSrc)
    } catch (error) {
      console.error(`Error while parsing ${filename}`)
      throw error
    }
  })

  Promise.all(suites.map(async suite => {
    await runSuite(suite)
  }))

})

async function runSuite(suite) {
  const fetcher = (filter) => {
    debug('fetcher()', filter)
    return new Promise((resolve, reject) => {
      resolve({
        results: suite.documents,
        start: 0
      })
    })
  }

  describe(suite.title, () => {
    suite.tests.forEach(test => {
      let theIt = it
      if (test.skip) {
        theIt = theIt.skip
      }
      if (test.only) {
        theIt = theIt.only
      }
      theIt(test.title, async () => {
        debug('test case', test.title)
        const params = Object.assign({}, {
          identity: 'groot'
        }, test.params || {})
        const result = await query({
          source: test.query,
          globalFilter: test.globalFilter,
          params,
          fetcher
        })
        // Some types like e.g. Path will be returned as such and will not get cleaned up for output before
        // the whole result is stringified to JSON.
        const cleanResult = JSON.parse(JSON.stringify(result))
        expect(cleanResult).toEqual(test.result)
      })
    })
  })
}
