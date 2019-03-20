const modifiers = [
  require('./timestampMutation'),
  require('./applyDocumentId'),
  require('./applyRevision')
]

function flattenMutations(mutations) {
  return mutations.reduce((acc, mutation) => {
    const operations = Object.keys(mutation)
    const operation = operations[0]
    const body = mutation[operation]
    return acc.concat({operation, body})
  }, [])
}

module.exports = (muts, options) => {
  const mutations = flattenMutations(muts)
  return mutations.map((original, i) => {
    return modifiers.reduce((mutation, modifier) => {
      return modifier(mutation, options, i, mutations)
    }, original)
  })
}
