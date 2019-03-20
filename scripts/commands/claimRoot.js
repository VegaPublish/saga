/* eslint-disable no-console */

const {claimRoot} = require('../actions/claimRoot')
const {connect, ROOT_CLAIM_URL, ROOT_INVITE_URL} = require('../config')

async function run() {
  await connect()
  await claimRoot({claimUrl: ROOT_CLAIM_URL, rootInviteUrl: ROOT_INVITE_URL})
}

run()
