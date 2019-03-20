const SagaError = require('../../errors/SagaError')

class TransactionError extends SagaError {
  constructor(options = {}) {
    const {payload, errors} = options

    let description = payload && payload.description
    if (errors && errors.length > 0 && !description) {
      description = errors[0].error.description
    } else if (!description) {
      description = 'An unknown error occured'
    }

    const errorMessage = `The mutation(s) failed: ${description}`
    super(errorMessage, options)

    this.payload = {
      description: this.message,
      type: 'mutationError',
      items: errors
    }
  }
}

module.exports = TransactionError
