const MongoClient = require('mongodb').MongoClient

module.exports = class MongoDbConnector {
  constructor(config) {
    this.config = config
    this.client = null
    this.connecting = null
  }

  get() {
    return this.connect()
  }

  connect() {
    if (this.client) {
      return this.client
    }

    if (this.connecting) {
      return this.connecting
    }

    this.connecting = MongoClient.connect(this.config.url, {
      useNewUrlParser: true
    }).then(client => {
      this.client = client
      this.connecting = null
      return client
    })

    return this.connecting
  }

  async listDatasets() {
    const client = await this.connect()
    const listDatabasesResult = await client.db('dummy').admin().listDatabases()
    const datasets = []
    const prefix = this.config.options.dbPrefix
    const systemName = this.config.options.systemDb
    listDatabasesResult.databases.forEach(record => {
      const name = record.name
      if (name == systemName) return
      if (name.startsWith(prefix)) {
        datasets.push({
          name: name.slice(prefix.length)
        })
      }
    })
    return datasets
  }

  disconnect() {
    if (!this.client && !this.connecting) {
      return Promise.resolve()
    }

    return this.connecting
      ? // Not yet connected, since we can't cancel, wait for it to complete first
      this.connecting.then(() => this.client.close())
      : // If already connected
      this.client.close()
  }
}
