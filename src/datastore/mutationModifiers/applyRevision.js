// Modify a set of mutations to include a revision
module.exports = function applyRevision(mutation, options) {
  const {transaction} = options
  const revision = transaction.getTransactionId()
  const {operation, body} = mutation

  switch (operation) {
    case 'create':
    case 'createOrReplace':
    case 'createIfNotExists':
      return {
        operation,
        body: {
          ...body,
          _rev: revision
        }
      }
    case 'patch':
      return {
        operation,
        body: {
          ...body,
          set: {
            ...(body.set || {}),
            _rev: revision
          }
        }
      }
    default:
      // ignore, this patch does not need a revision
      return mutation
  }
}
