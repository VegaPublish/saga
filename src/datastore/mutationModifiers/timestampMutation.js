// Modify a set of mutations to include the required timestamps
module.exports = function timestampMutation(mutation, options) {
  const {timestamp} = options
  const {operation, body} = mutation
  const isoTimeStamp = timestamp.toISOString()

  switch (operation) {
    case 'create':
    case 'createOrReplace':
    case 'createIfNotExists':
      return {
        operation,
        body: {
          ...body,
          _createdAt: body._createdAt || isoTimeStamp,
          _updatedAt: body._updatedAt || isoTimeStamp
        }
      }
    case 'patch':
      return {
        operation,
        body: {
          ...body,
          set: {
            ...(body.set || {}),
            _updatedAt: isoTimeStamp
          }
        }
      }
    default:
      // ignore, this patch does not need a timestamp
      return mutation
  }
}
