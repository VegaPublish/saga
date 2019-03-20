/* eslint-disable no-console */
const {prompt} = require('../utils')
const {createVenue} = require('./createVenue')
const {claimRoot} = require('./claimRoot')

exports.setup = async function setup({dataStore, userStore, rootInviteUrl, claimUrl}) {
  await claimRoot({claimUrl, rootInviteUrl})

  const shouldCreateVenue = await prompt.single({
    message: 'Would you like to create a new venue?',
    type: 'confirm'
  })
  if (shouldCreateVenue) {
    await createVenue({dataStore, userStore})
  }
}
