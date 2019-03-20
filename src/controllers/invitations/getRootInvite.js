module.exports = async (req, res, next) => {
  const {userStore} = req.app.services
  const rootInvite = (await userStore.getRootInvite()) || {
    isAccepted: false,
    isRevoked: false
  }
  res.json({
    isAccepted: rootInvite.isAccepted,
    isRevoked: rootInvite.isRevoked
  })
}
