/* eslint-disable no-await-in-loop */
const MongoDbConnector = require('../../src/datastore/adapters/MongoDB/MongoDbConnector')
const config = require('../../src/config')

module.exports = async () => {
  const dbPrefix = 'saga-test-'
  const connector = new MongoDbConnector(config.datastore)
  const client = await connector.connect()
  const db = await client.db('admin')
  const adminDb = db.admin()
  const {databases} = await adminDb.listDatabases()

  for (let i = 0; i < databases.length; i++) {
    if (databases[i].name.startsWith(dbPrefix)) {
      const testDb = await client.db(databases[i].name)
      await testDb.dropDatabase()
    }
  }

  return connector.disconnect()
}
