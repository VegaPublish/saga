const {close, getApp} = require('../helpers')
const PermissionsBuilder = require('../../src/security/PermissionsBuilder')

describe('permissionsBuilder', () => {
  const identityTemplate = {
    provider: 'google',
    providerId: 'xyzzy',
    name: 'Test User',
    email: 'test@example.com'
  }

  let app
  let scopedDataStore

  async function getScopedDataStore() {
    if (!scopedDataStore) {
      scopedDataStore = await app.services.dataStore.forDataset('saga-test')
    }
    return scopedDataStore
  }

  async function createUser() {
    const userStore = app.services.userStore
    const identity = await userStore.createIdentity(identityTemplate)
    const user = await userStore.createUser(identity, 'saga-test')
    return user
  }

  async function createDocument(doc) {
    const dataStore = await getScopedDataStore()
    const createdDocument = await dataStore
      .newTransaction({identity: '_system_'})
      .create(doc)
      .commit()
    return createdDocument
  }

  async function permissionsForUser(userId) {
    const permissionsBuilder = new PermissionsBuilder(userId, app.services.dataStore, 'saga-test')
    const permissions = await permissionsBuilder.determinePermissions()
    return permissions
  }

  beforeAll(() => {
    app = getApp()
  })

  beforeEach(() => {
    jest.setTimeout(15000)
  })

  afterAll(() => close(app))

  afterEach(async () => {
    const dataStore = app.services.dataStore
    await Promise.all([
      dataStore.forDataset('saga-test').then(ds => ds.truncate()),
      dataStore.forDataset('saga-system-test').then(ds => ds.truncate())
    ])
  })

  test('produces VegaQL filters granting some read access to unprivileged user', async () => {
    const unprivilegedUser = await createUser()
    await createDocument({
      _type: 'venue',
      name: 'journal-of-snah'
    })
    const {filters} = await permissionsForUser(unprivilegedUser._id)

    expect(filters).toBeTruthy()
    const expected = `((_type == "venue") || (_type == "issue") || (_type == "track") || (_type == "stage") || (_type == "user") || (_type == "comment" && (author._ref in ["${
      unprivilegedUser._id
    }"])) || (_type == "lyra.imageAsset") || (_type == "lyra.fileAsset") || (_type == "checklistConfig") || (_type == "checklistState") || (_type == "declarationConfig") || (_type == "declarationState") || (_type == "dueDateConfig") || (_type == "dueDateState"))`

    expect(filters.read).toEqual(expected)
  })

  test('produces VegaQL filters allowing comment author to update own comment', async () => {
    const author = await createUser()
    await createDocument({
      _type: 'comment',
      title: 'Stuff I chew on',
      author: {_type: 'reference', _ref: author._id}
    })
    const {filters} = await permissionsForUser(author._id)

    const expected = `((_type == "user" && ((!defined(identity) && isAdmin != true) || (_id == "${
      author._id
    }" && isAdmin != true))) || (_type == "comment" && (author._ref in ["${
      author._id
    }"])) || (_type == "lyra.imageAsset") || (_type == "lyra.fileAsset") || (_type == "checklistState") || (_type == "declarationState") || (_type == "dueDateState"))`
    expect(filters.update).toEqual(expected)
  })

  // you break it you buy it
  test.skip('sanity-check all capabilities - comment author', async () => {
    const author = await createUser()
    await createDocument({
      _type: 'comment',
      title: 'Stuff I chew on',
      author: {_type: 'reference', _ref: author._id}
    })
    const {grants} = await permissionsForUser(author._id)

    const expected = {
      create: {comment: [['author._ref', [`${author._id}`]]]},
      delete: {
        comment: [['author._ref', [`${author._id}`]]],
        reviewItem: [['reviewer._ref', [`${author._id}`]]]
      },
      read: {
        comment: [['author._ref', [`${author._id}`]]],
        featureConfig: true,
        issue: true,
        reviewItem: [['reviewer._ref', [`${author._id}`]]],
        stage: true,
        track: true,
        user: true,
        venue: true
      },
      update: {
        comment: [['author._ref', [`${author._id}`]]],
        reviewItem: [['reviewer._ref', [`${author._id}`]]]
      }
    }
    expect(grants).toEqual(expected)
  })
})
