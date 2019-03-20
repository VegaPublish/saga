const request = require('supertest')
const {close, getApp} = require('./helpers')

describe('users', () => {
  let app

  beforeAll(() => {
    app = getApp()
  })

  beforeEach(() => {
    jest.setTimeout(15000)
  })

  afterAll(() => close(app))

  test('returns empty object on logged out user', () =>
    request(app)
      .get('/v1/users/me')
      .expect(200, {}))
})
