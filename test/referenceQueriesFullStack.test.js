import fs from 'fs'
import glob from 'glob'
import path from 'path'
import yaml from 'js-yaml'

const request = require('supertest')
const {close, getApp, createAdminUser, getSessionCookie} = require('./helpers')
const uuid = require('uuid/v4')

let app
let adminUser


describe('Reference queries (through the full stack, including MongoDB driver)', () => {
  beforeAll(() => {
    app = getApp()
  })

  afterAll(() => close(app))

  const suites = glob.sync(path.join(__dirname, 'reference_queries', '*.yml'))
    // .filter(filename => filename.match(/es_pagination\.yml/))
    .map(filename => {
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

  return Promise.all(suites.map(async suite => {
    await runSuite(suite)
  }))
})

function runSuite(suite) {
  describe(`${suite.title} (fullstack)`, () => {

    beforeAll(async () => {
      jest.setTimeout(30000)

      const dataStore = app.services.dataStore
      await Promise.all([
        dataStore.forDataset('saga-test').then(ds => ds.truncate()),
        dataStore.forDataset('saga-system-test').then(ds => ds.truncate())
      ])

      adminUser = await createAdminUser(app)

      const transactionId = uuid()
      return request(app)
        .post('/v1/data/mutate/saga-test?returnIds=true')
        .set('Cookie', getSessionCookie(app, adminUser))
        .send({
          mutations: suite.documents.map(doc => ({
            create: doc
          })),
          transactionId
        })
        .expect(200)
    })


    suite.tests.forEach(test => {
      let theIt = it
      if (test.skip || test.globalFilter) {
        theIt = theIt.skip
      }
      if (test.only) {
        theIt = theIt.only
      }

      theIt(test.title, () => {
        let params
        if (test.params) {
          params = Object.keys(test.params).map(name => `$${name}=${encodeURIComponent(JSON.stringify(test.params[name]))}`
          )
        }
        return request(app)
          .get(
            `/v1/data/query/saga-test/?query=${encodeURIComponent(
              test.query
            )}${params ? ('&' + params.join('&')) : ''}`
        )
          .set('Cookie', getSessionCookie(app, adminUser))
          .expect(200)
          .expect(res => {
            if (test.result !== null && typeof test.result === 'object') {
              expect(res.body.result).toMatchObject(test.result)
            } else {
              expect(res.body.result).toEqual(test.result)
            }
          })
      })
    })
  })
}
