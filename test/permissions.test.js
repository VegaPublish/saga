const request = require('supertest')
const getId = require('randomstring').generate
const {close, createSession, getApp, getSessionCookie} = require('./helpers')
const {noPermissions, adminPermissions} = require('../src/security/securityConstants')

describe('grants', () => {
  const identityTemplate = {
    provider: 'google',
    providerId: 'xyzzy',
    name: 'Test User',
    email: 'test@example.com'
  }

  const dataset = 'saga-test'
  const systemDataset = 'saga-system-test'

  let app

  async function createUser(options = {}) {
    const userStore = app.services.userStore
    const identity = await userStore.createIdentity(identityTemplate)
    const user = await userStore.createUser(identity, 'saga-test', options)
    const sessionId = getId()
    await createSession(app, sessionId, identity._id)
    user.sessionId = sessionId
    return user
  }

  beforeAll(() => {
    app = getApp()
  })

  beforeEach(() => {
    jest.setTimeout(15000)
  })

  afterAll(() => close(app))

  afterEach(() =>
    Promise.all(
      [systemDataset, dataset].map(dsName =>
        app.services.dataStore.forDataset(dsName).then(ds => ds.truncate())
      )
    ))

  test('returns no grants for logged out user', async () => {
    const expected = {
      grants: noPermissions.grants,
      capabilities: noPermissions.capabilities
    }
    await request(app)
      .get(`/v1/permissions/${dataset}`)
      .expect(200, expected)
  })

  test('returns grants for logged in user', async () => {
    const user = await createUser()

    await request(app)
      .get(`/v1/permissions/${dataset}`)
      .set('Cookie', getSessionCookie(app, user))
      .expect(200)
      .expect(result => {
        const {grants, capabilities} = result.body
        expect(grants.read).toBeTruthy()
        expect(grants.create).toBeTruthy()
        expect(grants.update).toBeTruthy()
        expect(grants.delete).toBeTruthy()
        expect(capabilities).toBeTruthy()
      })
  })

  test('returns all grants for admin user', async () => {
    const user = await createUser({isAdmin: true})

    await request(app)
      .get(`/v1/permissions/${dataset}`)
      .set('Cookie', getSessionCookie(app, user))
      .expect(200)
      .expect(result => {
        const {grants, capabilities} = result.body
        expect(grants).toEqual(adminPermissions.grants)
        expect(capabilities).toEqual(adminPermissions.capabilities)
      })
  })
})
