const Boom = require('boom')

module.exports = async (req, res, next) => {
  // This might seem weird, but since invitations are basically just available for anyone to
  // claim, we want to prevent brute-force attacks. We do this with a fairly large token with
  // a large keyspace. In addition to this, let's wait for a random amount of time in order
  // to make testing random tokens a real chore. Obviously we should have rate-limiting on
  // top of this, but that should be handled by an external layer
  const {userStore, dataStore} = req.app.services
  const {token} = req.params
  const {venueId} = req.query

  const store = await (venueId ? dataStore.forDataset(venueId) : userStore.connect())
  const invite = await store.fetch('*[_type == "invite" && _id == $id][0]', {id: token})
  if (!invite) {
    await delay()
    next(Boom.notFound('Invitation not found'))
    return
  }

  await delay(50, 250)
  res.json(invite)
}

function delay(min = 100, max = 1000) {
  // eslint-disable-next-line no-process-env
  const isTest = process.env.NODE_ENV === 'test'
  const ms = isTest ? 10 : Math.floor(Math.random() * (max - min + 1) + min)
  return new Promise(resolve => setTimeout(resolve, ms))
}
