const curry = require('lodash/curry')
const SecurityManager = require('../../security/SecurityManager')

const respond = curry((res, code, markup) => {
  res
    .type('html')
    .status(400)
    .send(markup)
})

module.exports = async (req, res) => {
  const {userStore} = req.app.services
  const identityId = req.user && req.user.id

  const rootInvite = await userStore.getRootInvite()

  const respond400 = respond(res, 400)
  const respond200 = respond(res, 200)

  if (!rootInvite) {
    respond400('No root invite exists.')
    return
  }
  if (rootInvite.isRevoked) {
    respond400('Root invitation has been revoked')
    return
  }

  if (rootInvite.isAccepted) {
    respond400('Root invitation has already been accepted')
    return
  }

  if (!identityId) {
    respond400('Valid session required to claim invitation')
    return
  }

  await userStore.claimUser(rootInvite.target._ref, identityId, null, req.user.identity)

  await (await userStore.connect())
    .newTransaction({identity: SecurityManager.SYSTEM_IDENTITY})
    .patch(rootInvite._id, patch => patch.set({isAccepted: true}))
    .commit()

  respond200('You are now root')
}
