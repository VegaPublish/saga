const Boom = require('boom')
const claimGuestInvitation = require('./claimGuestInvitation')
const SecurityManager = require('../../security/SecurityManager')

module.exports = async (req, res, next) => {
  const {dataStore, userStore} = req.app.services
  const token = req.params.token
  const identityId = req.user && req.user.id
  const venueId = req.query.venueId

  const store = await (venueId ? dataStore.forDataset(venueId) : userStore.connect())
  const invite = await store.fetch('*[_type == "invite" && _id == $id][0]', {id: token})
  if (!invite) {
    next(Boom.notFound('Invitation not found'))
    return
  }

  const isGuestInvite = invite.targetType === 'guest'

  if (invite.isRevoked) {
    next(Boom.badRequest('Invitation has been revoked'))
    return
  }

  if (!isGuestInvite && invite.isAccepted) {
    next(Boom.badRequest('Invitation has already been accepted'))
    return
  }

  if (isGuestInvite) {
    claimGuestInvitation(req, res, next, invite)
    return
  }

  if (!identityId) {
    next(Boom.unauthorized('Valid session required to claim invitation'))
    return
  }

  await userStore.claimUser(invite.target._ref, identityId, venueId, req.user.identity)
  await store
    .newTransaction({identity: SecurityManager.SYSTEM_IDENTITY})
    .patch(invite._id, patch => patch.set({isAccepted: true}))
    .commit()

  res.json({claimed: true})
}
