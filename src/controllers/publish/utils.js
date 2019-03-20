const {omit} = require('lodash')
const {URL} = require('url')

function rewriteId(id) {
  // Isn't a string
  if (typeof id !== 'string') {
    return id
  }
  // Is allready rewritten
  if (id.match(/^pub_/)) {
    return id
  }
  // Perform the rewrite
  return `pub.${id}`
}

// Recursively rewrite all refs and ids returning the rewritten document
// and a list of all the original reffed ids.
function rewriteRefs(value) {
  // All id's seen in this pass
  const ids = {}

  const process = input => {
    let value = input
    if (Array.isArray(value)) {
      value = value.map(process)
    } else if (typeof value == 'object' && !!value) {
      // If the object has an _id, rewrite it
      if (typeof value._id === 'string') {
        value = Object.assign({}, value, {_id: rewriteId(value._id)})
      }
      // If the object has a _ref, rewrite it and add it to the ids registry
      if (typeof value._ref == 'string') {
        ids[value._ref] = true
        value = Object.assign(value, {_ref: rewriteId(value._ref)})
      }
      // Rewrite the values of the object
      for (const key of Object.keys(value)) {
        if (typeof value[key] === 'object') {
          value = Object.assign({}, value, {[key]: process(value[key])})
        }
      }
    }
    return value
  }
  return {rewritten: process(value), ids: Object.keys(ids)}
}

function findRefs(doc) {
  // All id's seen in this pass
  const ids = {}

  const process = value => {
    if (Array.isArray(value)) {
      value.forEach(process)
    } else if (typeof value == 'object' && !!value) {
      // If the object has a _ref, add it to the ids registry
      if (typeof value._ref == 'string') {
        ids[value._ref] = true
      }
      // Process the values of the object
      Object.keys(value).forEach(key => process(value[key]))
    }
  }

  process(doc)

  return Object.keys(ids)
}

// Prepares the document by omitting non-published fields, and adding the `published` field.
function prepareDocument(input) {
  const doc = omit(input, ['_createdAt', '_updatedAt', '_rev', 'publishedAt'])
  doc.published = true
  doc._srcRev = input._rev
  switch (doc._type) {
    case 'article':
      return omit(doc, ['track', 'stage', 'isReadyToAdvance', 'submitters'])
    case 'lyra.imageAsset':
    case 'lyra.fileAsset':
      return Object.assign({}, doc, {
        path: publicAssetPathFor(doc.path),
        url: publicAssetUrlFor(doc.url),
        fnah: 'Foo'
      })
    default:
      return doc
  }
}

function publicDatasetNameFor(privateDatasetName) {
  return `${privateDatasetName}--pub`
}

function publicAssetPathFor(path) {
  if (path[0] == '/') {
    path = path.slice(1)
  }
  const [kind, dataset, filename] = path.split('/')
  return `${kind}/${publicDatasetNameFor(dataset)}/${filename}`
}

function publicAssetUrlFor(url) {
  const assetUrl = new URL(url)
  assetUrl.pathname = publicAssetPathFor(assetUrl.pathname)
  return assetUrl.toString()
}

module.exports = {rewriteRefs, rewriteId, prepareDocument, findRefs, publicDatasetNameFor}
