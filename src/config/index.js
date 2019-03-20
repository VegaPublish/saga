const defaultConfig = require('./defaultConfig')
const testConfig = require('./testConfig')
const commander = require('commander')
const fs = require('fs')

let config = defaultConfig

const env = process.env.NODE_ENV || 'development'

if (env == 'test') {
  config = Object.assign(config, testConfig)
}

if (env !== 'test') {
  commander
    .version('0.1.0')
    .option('-c, --config [path]', 'Path to config file')
    .parse(process.argv);

  if (commander.config) {
    console.log("Reading config from ", commander.config)
    const optionalConfig = JSON.parse(fs.readFileSync(commander.config).toString())
    config = Object.assign(config, optionalConfig)
  }
}

module.exports = config