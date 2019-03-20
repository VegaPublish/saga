/* eslint-disable no-console */
const fetch = require('node-fetch')
const open = require('opn')
const ora = require('ora')
const {prompt} = require('../utils')
const url = require('url')

async function fetchRootInvite(rootInviteUrl) {
  return (await fetch(rootInviteUrl)).json()
}

async function waitForRootClaimed(rootInviteUrl) {
  await new Promise(resolve => setTimeout(resolve, 1000))
  const rootInvite = await fetchRootInvite(rootInviteUrl)
  if (!rootInvite.isAccepted) {
    await waitForRootClaimed(rootInviteUrl)
  }
}

exports.claimRoot = async function claimRoot({claimUrl, rootInviteUrl}) {
  const rootInvite = await fetchRootInvite(rootInviteUrl)
  if (rootInvite.isAccepted) {
    console.log('✔ Root user already exists')
    console.log('')
    return
  }
  const doCreate = await prompt.single({
    message: 'No root user found. Would you like to become the root user now?',
    type: 'confirm'
  })
  if (!doCreate) {
    return
  }

  const spinner = ora(`Log in from the browser at ${claimUrl}`).start()
  try {
    open(claimUrl)
  } catch (err) {
    spinner.text = `Please navigate your browser of choice to http://<saga-host>${url.parse(claimUrl).pathname}`
  }
  await waitForRootClaimed(rootInviteUrl)
  spinner.stop()
  console.log('✔ ︎Success')
}
