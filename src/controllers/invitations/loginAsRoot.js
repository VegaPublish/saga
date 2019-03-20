const render = require('./views/login')

const withUrl = ({baseUrl, origin}) => provider => ({
  ...provider,
  url: `${baseUrl}/v1/auth/login/${provider.name}?origin=${encodeURIComponent(origin)}`
})

module.exports = async (providers, req, res, next) => {
  const {userStore} = req.app.services
  let rootInvite
  try {
    rootInvite = await getOrCreateRootInviteId()
  } catch (err) {
    next(err)
    return
  }

  if (rootInvite && (rootInvite.isAccepted || rootInvite.isRevoked)) {
    res.send('Root invite already claimed')
    return
  }

  const baseUrl = `${req.protocol}://${req.headers.host}`
  res.type('text/html; charset=utf-8').send(
    render({
      providers: providers.map(
        withUrl({
          origin: `${baseUrl}/v1/invitations/claim/root`,
          baseUrl
        })
      )
    })
  )

  async function getOrCreateRootInviteId() {
    return (await userStore.getRootInvite()) || userStore.createRootUser()
  }
}
