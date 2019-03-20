/* eslint-disable no-console,no-process-exit */
const {setup} = require('../actions/setup')
const {
  ROOT_CLAIM_URL,
  ROOT_INVITE_URL,
  withFullAccessDataStore,
  connect,
  withUserStore
} = require('../config')
const {existsSync} = require('fs')

async function run() {
  if (!existsSync('./config/oauth.json')) {
    console.error('❌ Missing file: config/oauth.json')
    return false
  }

  await connect()
  await withFullAccessDataStore(dataStore =>
    withUserStore(userStore =>
      setup({
        dataStore,
        userStore,
        rootInviteUrl: ROOT_INVITE_URL,
        claimUrl: ROOT_CLAIM_URL
      })
    )
  )
  return true
}

run().then(success => {
  console.log()
  if (success) {
    console.log(`That's it. Goodbye 👋`)
  } else {
    console.log(`Please fix the above error and try again`)
  }
  process.exit()
})
