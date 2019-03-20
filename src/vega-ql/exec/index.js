const Executor = require('./Executor')

module.exports = function exec(options) {
  const executor = new Executor(options)
  return executor.run()
}
