const {flatten} = require('lodash')

module.exports = function findReferences(item, path = []) {
  if (Array.isArray(item)) {
    return flatten(
      item
        .map((arrItem, i) => findReferences(arrItem, path.concat(arrItem && arrItem._key ? {
          _key: arrItem._key
        } : i))
      )
        .filter(Boolean)
    )
  }

  // Can't recurse through bools, string, numbers etc
  if (!item || typeof item !== 'object') {
    return []
  }

  if (!item._ref) {
    return flatten(
      Object.keys(item)
        .map(key => findReferences(item[key], path.concat(key)))
        .filter(Boolean)
    )
  }

  return {
    id: item._ref,
    weak: Boolean(item._weak),
    path
  }
}
