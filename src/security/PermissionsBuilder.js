/* eslint-disable complexity */

const UserCapabilityDiviner = require('./UserCapabilityDiviner')
const requiredCapabilities = require('./requiredCapabilities')
const {actions, documentTypes} = require('./securityConstants')
const {fetchCurrentUser} = require('./util')

function quote(item) {
  return `"${item}"`
}

function arrayAsQuotedString(items) {
  return `[${items.map(quote).join(',')}]`
}

function querify(tuples, additionalFilters) {
  const queryfied = tuples
    .map(tuple => `(${tuple[0]} in ${arrayAsQuotedString(tuple[1])})`)
    .concat(additionalFilters)
    .join(' || ')
  const itemCount = tuples.length + additionalFilters.length
  return itemCount > 1 ? `(${queryfied})` : queryfied
}

// This class defines which capabilities a given user must have in order
// to gain access to a document type.
// The filters produced here are applied in SecurityManager
class PermissionsBuilder {
  constructor(userId, dataStore, venueId) {
    this.userId = userId
    this.venueId = venueId
    this.dataStore = dataStore
    this.currentUser = null
  }

  async fetchAllCapabilities() {
    if (!this.userCapabilities) {
      const userCapabilities = new UserCapabilityDiviner(this.userId, this.dataStore, this.venueId)
      this.userCapabilities = await userCapabilities.runAll()
    }
    return this.userCapabilities
  }

  async getCurrentUser() {
    if (!this.currentUser) {
      this.currentUser = await fetchCurrentUser(this.userId, this.dataStore, this.venueId)
    }
    return this.currentUser
  }

  compressCapabilities(action, type) {
    // Needed requirements for this action and type
    const requirements = requiredCapabilities[action][type]
    // The users' capability-tuples for those requirements
    const tuples = requirements.map(requirement => this.userCapabilities[requirement])
    // A single true grants access
    const explicitAllow = tuples.some(tuple => tuple[0] === true)
    if (explicitAllow) {
      return true
    }
    // All false denies access
    const allDisallow = tuples.every(tuple => tuple[0] === false)
    if (allDisallow) {
      return false
    }
    // Return all non-true/false rules we have
    return tuples.filter(tuple => tuple.length > 1)
  }

  assembleGrantsByActionAndType() {
    const allCapabilityTuples = {}
    actions.forEach(action => {
      allCapabilityTuples[action] = {}
      documentTypes.forEach(type => {
        const compressedCapabilities = this.compressCapabilities(action, type)
        if (compressedCapabilities) {
          allCapabilityTuples[action][type] = compressedCapabilities
        }
      })
    })
    return allCapabilityTuples
  }

  filtersByActionAndType(action, type, grantsByActionAndType) {
    const specificGrants = grantsByActionAndType[action][type]
    if (specificGrants === true) {
      return `(_type == "${type}")`
    }

    // additionalFilters are used for those cases where the requiredCapabilities
    // architecture is unable to specify what we want
    // If we need more of these special-cases, move them to a separate file
    // Keep in mind: These filters are for non-admins. Admins always get a free pass.

    const additionalFilters = []
    if (action === 'update' && type === 'user') {
      const nonClaimedNonAdminUser = '(!defined(identity) && isAdmin != true)'
      additionalFilters.push(nonClaimedNonAdminUser)
      const ownUserNonAdmin = `(_id == "${this.userId}" && isAdmin != true)`
      additionalFilters.push(ownUserNonAdmin)
    }

    if (!specificGrants && additionalFilters.length === 0) {
      return null
    }

    const grantTuples = specificGrants ? specificGrants : []
    const query = [`_type == "${type}"`, querify(grantTuples, additionalFilters)].join(' && ')
    return `(${query})`
  }

  async determinePermissions() {
    await this.fetchAllCapabilities() // warm up needed data
    await this.getCurrentUser() // warm up needed data

    const grantsByActionAndType = this.assembleGrantsByActionAndType()
    const filters = {}
    actions.forEach(action => {
      const queries = documentTypes
        .map(type => this.filtersByActionAndType(action, type, grantsByActionAndType))
        .filter(Boolean)
      filters[action] = `(${queries.join(' || ')})`
    })

    return {
      filters: filters,
      grants: grantsByActionAndType,
      capabilities: this.userCapabilities
    }
  }
}

module.exports = PermissionsBuilder
