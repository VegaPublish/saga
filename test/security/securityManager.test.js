const {close, getApp} = require('../helpers')
const {adminPermissions, noPermissions} = require('../../src/security/securityConstants')

describe('securityManager', () => {
  const identityTemplate = {
    provider: 'google',
    providerId: 'xyzzy',
    name: 'Test User',
    email: 'test@example.com'
  }

  let app
  let securityManager

  beforeAll(() => {
    app = getApp()
    securityManager = app.services.securityManager
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

  test('denies access to unknown user', async () => {
    const permissions = await securityManager.getPermissionsForUser('saga-test', 'unknownUser')
    expect(permissions).toEqual(noPermissions)
  })

  test('denies access if no user is given', async () => {
    const permissions = await securityManager.getPermissionsForUser('saga-test')
    expect(permissions).toEqual(noPermissions)
  })

  test('grants full access to system user', async () => {
    const permissions = await securityManager.getPermissionsForUser('saga-test', '_system_')
    expect(permissions).toEqual(adminPermissions)
  })

  test('grants full access to global admin user', async () => {
    const userStore = app.services.userStore
    const identity = await userStore.createIdentity(identityTemplate)
    const user = await userStore.createAdminUser(identity)
    const permissions = await securityManager.getPermissionsForUser(null, user.identity)
    expect(permissions).toEqual(adminPermissions)
  })

  test('grants full access to venue admin user', async () => {
    const userStore = app.services.userStore
    const identity = await userStore.createIdentity(identityTemplate)
    const user = await userStore.createAdminUser(identity, 'saga-test')
    const permissions = await securityManager.getPermissionsForUser('saga-test', user.identity)
    expect(permissions).toEqual(adminPermissions)
  })
})
