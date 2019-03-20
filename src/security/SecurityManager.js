const LruCache = require('lru-cache')
const PermissionsBuilder = require('./PermissionsBuilder')
const {noPermissions, adminPermissions} = require('./securityConstants')
import { union, difference, isEqual } from 'lodash'

function extractUserIds(value) {
  if (!value) return []
  const refs = Array.isArray(value) ? value : [value]
  return refs.map(item => item._ref).sort()
}

function oldAndNewValue(doc1, doc2, fieldName) {
  let oldValue
  let newValue
  if (doc1) {
    oldValue = doc1[fieldName]
  }
  if (doc2) {
    newValue = doc2[fieldName]
  }

  return [oldValue, newValue]
}

function didChange(doc1, doc2, fieldName) {
  const [oldValue, newValue] = oldAndNewValue(doc1, doc2, fieldName)
  return !isEqual(oldValue, newValue)
}

// Returns the value of a field for the document at any time, preferring the newest value.
// Used to extract values that you want regardless of whether the document has been deleted
// or created.
function valueAtAnyPoint(doc1, doc2, fieldName) {
  const [oldValue, newValue] = oldAndNewValue(doc1, doc2, fieldName)
  return newValue || oldValue
}

function differenceUserIds(doc1, doc2, fieldName) {
  let uids1 = []
  let uids2 = []

  if (doc1) {
    uids1 = extractUserIds(doc1[fieldName])
  }
  if (doc2) {
    uids2 = extractUserIds(doc2[fieldName])
  }
  return union(difference(uids1, uids2), difference(uids2, uids1))
}

class SecurityManager {
  constructor(options = {}) {
    this.userStore = options.userStore
    this.dataStore = options.dataStore
    this.cache = new LruCache({
      max: 500
    })
    this.onMutation = this.onMutation.bind(this)
  }

  setUserStore(userStore) {
    this.userStore = userStore
  }

  confirmStoresArePresent() {
    if (!this.userStore) {
      throw new Error('User store must be set before fetching filter expressions')
    }
    if (!this.dataStore) {
      throw new Error('Data store must be set before fetching filter expressions')
    }
  }

  async computePermissionsForUser(venueId, identityId) {
    if (!identityId) {
      return noPermissions
    }

    if (identityId === SecurityManager.SYSTEM_IDENTITY) {
      return adminPermissions
    }

    this.confirmStoresArePresent()

    const {globalUser, venueUser} = await this.userStore.fetchUsersForIdentity(identityId, venueId)
    // console.info('🦄', `hasGlobalUser: ${!!globalUser} // hasVenueUser: ${!!venueUser}`)

    if (globalUser) {
      // Will there ever be a globalUser who is not admin?
      return globalUser.isAdmin ? adminPermissions : noPermissions
    }
    if (venueUser) {
      const permissionsBuilder = new PermissionsBuilder(venueUser._id, this.dataStore, venueId)
      return venueUser.isAdmin ? adminPermissions : permissionsBuilder.determinePermissions()
    }

    return noPermissions
  }

  async getPermissionsForUser(venueId, identityId) {
    const key = getCacheKey(venueId, identityId)
    let result = this.cache.get(key)
    if (result) {
      return result
    }

    result = await this.computePermissionsForUser(venueId, identityId)
    this.cache.set(key, result)
    return result
  }

  // Figure out which users must have their access privilege cache purged
  accessFilterChangesForUserIds(venueId, previousDoc, nextDoc) {
    // eslint-disable-line class-methods-use-this
    const _type = valueAtAnyPoint(previousDoc, nextDoc, '_type')

    // If this is a user object, just invalidate the user regardless of what just happened
    if (_type == 'user') {
      return [valueAtAnyPoint(previousDoc, nextDoc, '_id')]
    }

    // Look for the fields that define roles across objects and invalidate any users
    // that are added or removed from any such field.
    const roleFields = ['editors', 'submitters', 'reviewer']
    let usersToInvalidate = []
    roleFields.forEach(fieldName => {
      const uids = differenceUserIds(previousDoc, nextDoc, fieldName)
      usersToInvalidate = union(usersToInvalidate, uids)
    })
    return usersToInvalidate
  }

  doesRequireFullCacheReset(venueId, previousDoc, nextDoc) {
    // eslint-disable-line class-methods-use-this
    const _type = valueAtAnyPoint(previousDoc, nextDoc, '_type')
    switch (_type) {
      case 'issue':
        if (didChange(previousDoc, nextDoc, 'content')) {
          return true
        }
        break
      default:
        return false
    }
    return false
  }

  // Point of callback when a document changes
  onMutation(mutation) {
    const venueId = mutation.annotations.venueId

    // Check if we should just reset the entire cache
    if (this.doesRequireFullCacheReset(venueId, mutation.previous, mutation.result)) {
      // console.log('Reset entire access cache')
      this.cache.reset()
      return
    }

    // If we did not have to throw out the entire cache: See if we can determine
    // individual users.
    const changedFor = this.accessFilterChangesForUserIds(
      venueId,
      mutation.previous,
      mutation.result
    )

    if (changedFor.length > 0) {
      // At this point we have an array of user IDs, but in order to invalidate them
      // we'll have to retrieve the identity-ids of those users. In 99.972% of all cases
      // it is cheaper to reset the cache, rather than hit the db to perform the conversion.
      // console.log('Reset entire access cache, because state changed for users', changedFor)
      this.cache.reset()
    }

  // changedFor.forEach(userId => {
  //   console.log('Reset access cache for', userId)
  //   this.cache.del(getCacheKey(venueId, identityId))
  // })
  }
}

SecurityManager.SYSTEM_IDENTITY = '_system_'

function getCacheKey(venueId, userId) {
  return `sm-${venueId}-${userId}`
}

module.exports = SecurityManager
