const SagaError = require('../../errors/SagaError')

class MutationError extends SagaError {
  constructor(options = {}) {
    const description = options.description || 'An unknown error occured'
    super(description, options)
    this.payload = options
  }
}

module.exports = MutationError
