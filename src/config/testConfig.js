// Config overrides for use when running tests

const os = require('os')
const path = require('path')
const randomstring = require('randomstring').generate

const executionId = randomstring()

const ONE_MEGABYTE = 1024 * 1024
const FIFTEEN_MEGABYTES = ONE_MEGABYTE * 15

module.exports = {
  env: 'test',
  logLevel: 'warn',
  assets: {
    baseUrl: 'http://localhost:4000',
    maxInputBytes: int(process.env.SAGA_ASSETS_MAX_INPUT_BYTES, FIFTEEN_MEGABYTES),
    adapter: 'fs',
    options: {
      basePath: path.join(os.tmpdir(), executionId)
    }
  },
  vega: {
    featurePlugins: ['checklist', 'declaration', 'dueDate']
  }
}

function int(num, defaultVal) {
  return typeof num === 'undefined' ? defaultVal : parseInt(num, 10)
}
