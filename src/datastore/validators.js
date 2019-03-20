function validateObject(op, val) {
  if (val === null || typeof val !== 'object' || Array.isArray(val)) {
    throw new Error(`${op}() takes an object of properties`)
  }
}

function validateDocumentId(op, id) {
  if (typeof id !== 'string' || !/^[a-z0-9_.-]+$/i.test(id)) {
    throw new Error(`${op}(): "${id}" is not a valid document ID`)
  }
}

function requireDocumentId(op, doc) {
  if (!doc._id) {
    throw new Error(`${op}() requires that the document contains an ID ("_id" property)`)
  }

  validateDocumentId(op, doc._id)
}

module.exports = {
  validateDocumentId,
  validateObject,
  requireDocumentId
}
