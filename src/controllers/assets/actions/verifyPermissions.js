const generateId = require('randomstring').generate

module.exports = (req, store, asset) => {
  const _id = `perm-check-${generateId({length: 16})}`
  const permAsset = Object.assign({}, asset, {_id})
  return store
    .newTransaction({identity: req.user && req.user.id})
    .create(permAsset)
    .delete(_id)
    .commit()
}
