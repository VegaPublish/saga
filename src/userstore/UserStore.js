const randomstring = require('randomstring').generate
const removeUndefined = require('../util/removeUndefined')
const SecurityManager = require('../security/SecurityManager')

module.exports = class UserStore {
  constructor(options) {
    this.dataStore = options.dataStore
    this.identityStore = this.dataStore.forDataset(options.systemDb)
  }

  async connect() {
    this.identityStore = await this.identityStore
    return this.identityStore
  }

  async fetchIdentityById(id) {
    await this.connect()
    return this.identityStore.getDocumentById(id)
  }

  async fetchIdentity(provider, providerId) {
    await this.connect()
    return this.identityStore.fetch(
      '*[_type == "identity" && provider == $provider && providerId == $providerId][0]',
      {provider, providerId}
    )
  }

  async createIdentity(identity) {
    const {provider, providerId, name, email, externalProfileImageUrl} = identity
    await this.connect()
    return this.identityStore
      .newTransaction({identity: SecurityManager.SYSTEM_IDENTITY})
      .create({
        _type: 'identity',
        provider,
        providerId,
        name,
        email,
        externalProfileImageUrl
      })
      .commit()
      .then(getFirstDocument)
  }

  async claimUser(userId, identity, venueId = null, props = {}) {
    const {name, email, profileImage, externalProfileImageUrl} = props
    const store = await (venueId ? this.dataStore.forDataset(venueId) : this.connect())
    const userProps = removeUndefined({
      identity,
      name,
      email,
      profileImage,
      externalProfileImageUrl
    })

    return store
      .newTransaction({identity: SecurityManager.SYSTEM_IDENTITY})
      .patch(userId, patch => patch.set(userProps))
      .commit()
      .then(getFirstDocument)
  }

  async fetchUsersForIdentity(identityId, venueId = null) {
    const getUserForIdentity = store => {
      return store.fetch('*[_type == "user" && identity == $identityId][0]', {identityId})
    }

    const globalUser = this.connect().then(getUserForIdentity)
    if (!venueId) {
      return {
        globalUser: await globalUser,
        venueUser: null
      }
    }

    const venueUser = this.dataStore.forDataset(venueId).then(getUserForIdentity)
    return Promise.all([globalUser, venueUser]).then(results => {
      return {
        globalUser: results[0],
        venueUser: results[1]
      }
    })
  }

  getRootUser() {
    return this.connect().then(store => store.fetch('*[_type == "user" && isRootUser == true][0]'))
  }

  getRootInvite() {
    return this.connect()
      .then(store => store.fetch('*[_type == "invite" && isRootUser == true]'))
      .then(rootInvites => {
        if (rootInvites.length > 1) {
          throw new Error('Invalid state: multiple root invites')
        }
        return rootInvites[0]
      })
  }

  async createVenueAdminFrom(rootUser, venue) {
    const store = await this.dataStore.forDataset(venue.title)
    return store
      .newTransaction({identity: SecurityManager.SYSTEM_IDENTITY})
      .create({
        _type: 'user',
        identity: rootUser.identity,
        name: rootUser.name,
        isAdmin: true,
        email: rootUser.email,
        externalProfileImageUrl: rootUser.externalProfileImageUrl
      })
      .commit()
      .then(getFirstDocument)
  }

  async createUser(identity, venueId = null, options = {}) {
    const {_id, name, email, externalProfileImageUrl} = identity

    const store = await (venueId ? this.dataStore.forDataset(venueId) : this.connect())
    return store
      .newTransaction({identity: SecurityManager.SYSTEM_IDENTITY})
      .create({
        _type: 'user',
        identity: _id,
        isAdmin: options.isAdmin,
        isRootUser: options.isRootUser,
        name,
        email,
        externalProfileImageUrl
      })
      .commit()
      .then(getFirstDocument)
  }

  // eslint-disable-next-line require-await
  async createAdminUser(identity = {}, venueId = null, isRootUser = false) {
    return this.createUser(identity, venueId, {isRootUser, isAdmin: true})
  }

  async createRootUser() {
    const admin = await this.createAdminUser({}, null, true)
    const userStore = await this.connect()
    const invite = {
      _id: randomstring(),
      _type: 'invite',
      targetType: 'user',
      target: {_ref: admin._id},
      isAccepted: false,
      isRevoked: false,
      isRootUser: true
    }

    await userStore
      .newTransaction({identity: SecurityManager.SYSTEM_IDENTITY})
      .create(invite)
      .commit()

    return invite
  }
}

function getFirstDocument(result) {
  return result.results[0].document
}
