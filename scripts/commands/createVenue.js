/* eslint-disable no-console */
const {connect, withFullAccessDataStore, withUserStore} = require('../config')
const {createVenue} = require('../actions/createVenue')

async function run() {
  await connect()
  await withFullAccessDataStore(dataStore =>
    withUserStore(userStore => createVenue({dataStore, userStore}))
  )
}

run()
