module.exports = (req, res, next) => {
  res.json({
    isSupported: true,
    isUpToDate: true
  })
}
