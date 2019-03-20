module.exports = (provider, req, res, next) => {
  const log = req.app.services.log
  const loginInfo = req.session.loginInfo || {}
  const {origin, uuid, type} = loginInfo

  req.login(req.account, err => {
    if (err) {
      log.error(err)
      res.redirect('/v1/auth/error?code=LOGIN_ERR')
      return
    }

    // Ensure session has been saved before redirecting
    req.session.save(() => {
      res.redirect(origin || '/v1/users/me')
    })
  })
}
