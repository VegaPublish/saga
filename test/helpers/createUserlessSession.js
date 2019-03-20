const getId = require('randomstring').generate
const createSession = require('./createSession')

module.exports = async (app, venueId) => {
  const identity = await app.services.userStore.createIdentity({
    provider: 'mock',
    providerId: 'someUserId',
    name: 'Anonymous User',
    email: 'anon@ymous.com'
  })

  const sessionId = getId()
  const session = await createSession(app, sessionId, identity._id)

  return {identity, session, sessionId}
}
