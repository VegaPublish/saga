const saga = require('../../src/app')
const getConfig = require('./getConfig')

module.exports = (config = {}) => saga(getConfig(config))
