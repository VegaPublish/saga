const request = require('supertest')
const getId = require('randomstring').generate
const {close, createSession, getApp, createAdminUser, getSessionCookie} = require('./helpers')

describe('export', () => {
  let app
  let adminUser

  const identityTemplate = {
    provider: 'google',
    providerId: 'xyzzy',
    name: 'Test User',
    email: 'test@example.com'
  }

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

  beforeEach(async () => {
    jest.setTimeout(15000)

    const dataStore = app.services.dataStore
    await Promise.all([
      dataStore.forDataset('saga-test').then(ds => ds.truncate()),
      dataStore.forDataset('saga-system-test').then(ds => ds.truncate())
    ])

    adminUser = await createAdminUser(app)
  })

  afterAll(() => close(app))

  test('can export all documents as admin', async () => {
    const docs = []
    for (let i = 0; i < 20; i++) {
      docs.push({_id: `foo${i}`, _type: 'test', num: i})
    }

    await request(app)
      .post('/v1/data/mutate/saga-test?returnIds=true')
      .set('Cookie', getSessionCookie(app, adminUser))
      .send({mutations: docs.map(create => ({create}))})
      .expect(200)

    await request(app)
      .get(`/v1/data/export/saga-test`)
      .set('Cookie', getSessionCookie(app, adminUser))
      .expect(200)
      .expect(res => {
        const documents = res.text
          .split('\n')
          .filter(Boolean)
          .map(doc => JSON.parse(doc))

        expect(documents).toHaveLength(20)
        documents.forEach((doc, i) => {
          expect(doc).toMatchObject(docs[i])
        })
      })
  })

  test('can export only user document as user', async () => {
    const user = await createUser()
    const docs = []
    for (let i = 0; i < 20; i++) {
      docs.push({_id: `foo${i}`, _type: 'test', num: i})
    }

    await request(app)
      .post('/v1/data/mutate/saga-test?returnIds=true')
      .set('Cookie', getSessionCookie(app, adminUser))
      .send({mutations: docs.map(create => ({create}))})
      .expect(200)

    await request(app)
      .get(`/v1/data/export/saga-test`)
      .set('Cookie', getSessionCookie(app, user))
      .expect(200)
      .expect(res => {
        const documents = res.text
          .split('\n')
          .filter(Boolean)
          .map(doc => JSON.parse(doc))

        expect(documents).toHaveLength(1)
        expect(documents[0]).toMatchObject({
          _type: 'user',
          email: 'test@example.com',
          name: 'Test User'
        })
      })
  })
})
