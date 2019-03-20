const config = require('../config')
const actions = ['read', 'create', 'update', 'delete']

const additionalTypes = []
config.vega.featurePlugins.forEach(feature => {
  additionalTypes.push(`${feature}Config`)
  additionalTypes.push(`${feature}State`)
})
const documentTypes = [
  'venue',
  'issue',
  'track',
  'stage',
  'user',
  'article',
  'comment',
  'reviewProcess',
  'reviewItem',
  'lyra.imageAsset',
  'lyra.fileAsset'
].concat(additionalTypes)

const noAccessFilterExpressions = {
  create: 'false',
  read: 'published', // People with no access can still read documents with the published flag set to true
  update: 'false',
  delete: 'false'
}

const fullAccessFilterExpressions = {
  create: 'true',
  read: 'true',
  update: 'true',
  delete: 'true'
}

const noPermissions = {
  filters: noAccessFilterExpressions,
  grants: {
    read: documentTypes.reduce(
      (obj, documentType) => ({
        ...obj,
        [documentType]: false
      }),
      {}
    ),
    create: documentTypes.reduce(
      (obj, documentType) => ({
        ...obj,
        [documentType]: false
      }),
      {}
    ),
    update: documentTypes.reduce(
      (obj, documentType) => ({
        ...obj,
        [documentType]: false
      }),
      {}
    ),
    delete: documentTypes.reduce(
      (obj, documentType) => ({
        ...obj,
        [documentType]: false
      }),
      {}
    )
  },
  capabilities: {
    isLoggedInUser: [false]
  }
}

const adminPermissions = {
  filters: fullAccessFilterExpressions,
  grants: {
    read: documentTypes.reduce(
      (obj, documentType) => ({
        ...obj,
        [documentType]: true
      }),
      {}
    ),
    create: documentTypes.reduce(
      (obj, documentType) => ({
        ...obj,
        [documentType]: true
      }),
      {}
    ),
    update: documentTypes.reduce(
      (obj, documentType) => ({
        ...obj,
        [documentType]: true
      }),
      {}
    ),
    delete: documentTypes.reduce(
      (obj, documentType) => ({
        ...obj,
        [documentType]: true
      }),
      {}
    )
  },
  capabilities: {
    isLoggedInUser: [true],
    isAdminUser: [true]
  }
}

module.exports = {
  adminPermissions,
  noPermissions,
  noAccessFilterExpressions,
  fullAccessFilterExpressions,
  actions,
  documentTypes
}
