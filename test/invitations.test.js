const request = require('supertest')
const {close, getApp, getSessionCookie, createUserlessSession} = require('./helpers')
const SecurityManager = require('../src/security/SecurityManager')

describe('invitations', () => {
  let app
  let dataStore

  beforeAll(() => {
    app = getApp()
  })

  beforeEach(() => {
    jest.setTimeout(15000)

    dataStore = app.services.dataStore
    return Promise.all([
      dataStore.forDataset('saga-test').then(ds => ds.truncate()),
      dataStore.forDataset('saga-system-test').then(ds => ds.truncate())
    ])
  })

  afterAll(() => close(app))

  test('can fetch invitations by id', async () => {
    const invite = await createMockInvite(dataStore)
    return request(app)
      .get(`/v1/invitations/${invite._id}?venueId=saga-test`)
      .expect(200)
      .then(res => expect(res.body).toMatchObject(invite))
  })

  test('can claim guest invitations', async () => {
    const invite = await createMockInvite(dataStore)
    const agent = request.agent(app)
    await agent
      .get(`/v1/invitations/claim/${invite._id}?venueId=saga-test`)
      .expect(302)
      .expect('Location', '/v1/users/me')

    await agent
      .get('/v1/users/me')
      .expect(200)
      .then(res => expect(res.body).toMatchObject({id: /\w+/}))
  })

  test('can reuse guest invitation', async () => {
    const invite = await createMockInvite(dataStore)
    const agent = request.agent(app)
    await agent
      .get(`/v1/invitations/claim/${invite._id}?venueId=saga-test`)
      .expect(302)
      .expect('Location', '/v1/users/me')

    await agent
      .post('/v1/auth/logout')
      .expect(302)
      .expect('Location', '/v1/users/me')

    await agent
      .get(`/v1/invitations/claim/${invite._id}?venueId=saga-test`)
      .expect(302)
      .expect('Location', '/v1/users/me')

    await agent
      .get('/v1/users/me')
      .expect(200)
      .then(res => expect(res.body).toMatchObject({id: /\w+/}))
  })

  test('cannot claim regular invitations if unauthorized', async () => {
    const invite = await createMockInvite(dataStore, {
      _id: 'someUserId',
      _type: 'user'
    })

    const agent = request.agent(app)
    await agent.get(`/v1/invitations/claim/${invite._id}?venueId=saga-test`).then(res =>
      expect(res.body).toMatchObject({
        error: 'Unauthorized',
        message: 'Valid session required to claim invitation',
        statusCode: 401
      })
    )
  })

  test('can claim regular invitations if logged in', async () => {
    const invite = await createMockInvite(dataStore, {
      _id: 'someUserId',
      _type: 'user'
    })

    const session = await createUserlessSession(app, 'saga-test')
    const agent = request.agent(app)
    await agent
      .get(`/v1/invitations/claim/${invite._id}?venueId=saga-test`)
      .set('Cookie', getSessionCookie(app, session))
      .expect(200, {claimed: true})
  })

  test('can claim regular invitations if logged in', async () => {
    const invite = await createMockInvite(dataStore, {
      _id: 'someUserId',
      _type: 'user'
    })

    const session = await createUserlessSession(app, 'saga-test')
    const agent = request.agent(app)
    await agent
      .get(`/v1/invitations/claim/${invite._id}?venueId=saga-test`)
      .set('Cookie', getSessionCookie(app, session))
      .expect(200, {claimed: true})
  })
})

async function createMockInvite(dataStore, userObject = null) {
  const user = userObject || {_id: 'someGuestId', _type: 'guest', isRevoked: false}
  const ds = await dataStore.forDataset('saga-test')
  const trx = ds.newTransaction({identity: SecurityManager.SYSTEM_IDENTITY})
  const invite = {
    _id: 'someRandomStringOfSufficientLength',
    _type: 'invite',
    targetType: user._type === 'guest' ? 'guest' : 'user',
    target: {_ref: user._id},
    isAccepted: false,
    isRevoked: false
  }

  await trx
    .create(user)
    .create(invite)
    .commit()

  return invite
}
