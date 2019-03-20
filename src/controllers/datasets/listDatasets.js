

module.exports = async (req, res, next) => {
  const {dataStore} = req.app.services
  const result = await dataStore.listDatasets()
  res.json(result)
}
