class SagaError extends Error {
  constructor(message, options = {}) {
    super(message)
    const {statusCode, payload} = options
    this.statusCode = statusCode || 500
    this.payload = payload || {description: 'An unknown error occured'}
  }

  toJSON() {
    return {
      error: this.payload
    }
  }
}

module.exports = SagaError
