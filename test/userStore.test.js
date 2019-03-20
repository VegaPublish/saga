const {close, getApp} = require('./helpers')

describe('query', () => {
  const identity = {
    provider: 'google',
    providerId: 'uid123',
    name: 'Espen',
    email: 'espen@sanity.io'
  }

  let app

  beforeAll(() => {
    app = getApp()
  })

  beforeEach(() => {
    jest.setTimeout(15000)
  })

  afterAll(() => close(app))

  afterEach(() =>
    Promise.all(
      ['saga-system-test', 'saga-test'].map(dsName =>
        app.services.dataStore.forDataset(dsName).then(ds => ds.truncate())
      )
    ))

  test('can create and fetch identity', async () => {
    const userStore = app.services.userStore
    await userStore.createIdentity(identity)
    const result = await userStore.fetchIdentity('google', 'uid123')
    expect(result).toMatchObject(identity)
    expect(result).toHaveProperty('_id')
  })

  test('can claim global user and fetch user for identity', async () => {
    const userStore = app.services.userStore
    const ident = await userStore.createIdentity(identity)
    expect(ident).toMatchObject(identity)

    const stub = await userStore.createAdminUser()
    expect(stub).toMatchObject({isAdmin: true})

    const claimed = await userStore.claimUser(stub._id, ident._id, null, {name: 'Espen', arb: 'i'})
    expect(claimed).toMatchObject({isAdmin: true, identity: ident._id, name: 'Espen'})
    expect(claimed).not.toHaveProperty('arb')

    const {globalUser, venueUser} = await userStore.fetchUsersForIdentity(ident._id)
    expect(globalUser).toMatchObject(claimed)
    expect(venueUser).toBe(null)
  })

  test('can claim venue user and fetch user for identity', async () => {
    const userStore = app.services.userStore
    const ident = await userStore.createIdentity(identity)
    expect(ident).toMatchObject(identity)

    const stub = await userStore.createAdminUser({}, 'saga-test')
    expect(stub).toMatchObject({isAdmin: true})

    const claimed = await userStore.claimUser(stub._id, ident._id, 'saga-test', {
      name: 'Espen',
      arb: 'i'
    })
    expect(claimed).toMatchObject({isAdmin: true, identity: ident._id, name: 'Espen'})
    expect(claimed).not.toHaveProperty('arb')

    const {globalUser, venueUser} = await userStore.fetchUsersForIdentity(ident._id, 'saga-test')
    expect(venueUser).toMatchObject(claimed)
    expect(globalUser).toBe(null)
  })
})
