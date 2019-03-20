const adapters = {
  fs: require('./fs/fsFileStore')
}

module.exports = config => {
  if (!adapters[config.adapter]) {
    throw new Error(`Unknown filestore adapter "${config.adapter}"`)
  }

  const FileStore = adapters[config.adapter]
  return new FileStore(config)
}
