module.exports = (req, res, next) => {
  const auth = req.headers.authorization
  if (!auth || auth.toLowerCase().indexOf('bearer ') !== 0) {
    next()
    return
  }

  const enc = encodeURIComponent
  const config = req.app.services.config
  req.headers.cookie = `${enc(config.session.name)}=${enc(auth.split(' ')[1])}`
  next()
}
