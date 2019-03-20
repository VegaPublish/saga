// eslint-disable-next-line max-params
module.exports = async function handleLogin(app, provider, accessToken, refreshToken, profile, cb) {
  const {userStore, log} = app.services

  log.info('Fetching identity for user ID %s of provider %s', profile.id, provider.name)
  let identity = await userStore.fetchIdentity(provider.name, profile.id)

  log.info(
    identity ? 'Found identity with ID %s' : 'No identity found, creating one',
    (identity && identity._id) || ''
  )

  if (!identity) {
    identity = await userStore.createIdentity({
      provider: provider.name,
      providerId: profile.id,
      name: profile.displayName || profile.username || 'Anonymous Aardvark',
      email: findEmail(profile.emails),
      externalProfileImageUrl: findImage(profile.photos)
    })
  }

  cb(null, identity)
}

function findEmail(emails) {
  if (!emails || !emails.length) {
    return null
  }

  const accountEmail = emails.find(email => email.type === 'account')
  return accountEmail ? accountEmail.value : emails[0].value
}

function findImage(photos) {
  if (!photos || !photos.length) {
    return null
  }

  return photos[0].value
}
