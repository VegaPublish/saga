/* eslint-disable camelcase */
const request = require('supertest')
const passport = require('passport')
const {close, getApp, getCallbackServer} = require('./helpers')

describe('auth', () => {
  let app
  let callbackServer

  beforeAll(() => {
    app = getApp()
  })

  beforeEach(() => jest.setTimeout(15000))

  afterEach(() => callbackServer && callbackServer.close())

  afterAll(() => close(app))

  test('can log someone in, create profile, retrieve profile and log out', async () => {
    const strategy = passport._strategies.google
    strategy._token_response = {
      access_token: 'at-1234',
      expires_in: 3600
    }

    strategy._profile = {
      id: 1234,
      provider: 'google',
      displayName: 'Jon Smith',
      emails: [{value: 'jon.smith@example.com'}],
      photos: [{value: 'http://some.img.host/me.jpg'}]
    }

    callbackServer = await getCallbackServer()
    const origin = `http://localhost:${callbackServer.port}/callback`
    const agent = request.agent(app)

    // Log in
    await agent
      .get('/v1/auth/login/google')
      .query({origin})
      .expect(302)
      .expect('Location', '/v1/auth/callback/google?__mock_strategy_callback=true')

    // Callback (creates profile)
    await agent
      .get('/v1/auth/callback/google?__mock_strategy_callback=true')
      .expect(302)
      .expect('Location', origin)

    // Fetch profile
    await agent
      .get('/v1/users/me')
      .expect(200)
      .then(res =>
        expect(res.body).toMatchObject({
          name: 'Jon Smith',
          email: 'jon.smith@example.com',
          externalProfileImageUrl: 'http://some.img.host/me.jpg'
        })
      )

    // Log out
    await agent
      .post('/v1/auth/logout')
      .expect(302)
      .expect('Location', '/v1/users/me')

    // Check for empty profile
    await agent.get('/v1/users/me').expect(200, {})
  })
})
