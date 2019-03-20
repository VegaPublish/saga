module.exports = obj =>
  Object.keys(obj).reduce((acc, key) => {
    if (typeof obj[key] !== 'undefined') {
      acc[key] = obj[key]
    }
    return acc
  }, {})
