module.exports = async (req, res, next) => {
  const {dataset} = req.params
  const {securityManager} = req.app.services

  const {grants, capabilities} = await securityManager.getPermissionsForUser(
    dataset,
    req.user && req.user.id
  )
  const result = {
    grants,
    capabilities
  }
  res.json(result)
}
