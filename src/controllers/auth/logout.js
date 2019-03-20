module.exports = (req, res) => {
  req.logout()
  res.redirect('/v1/users/me')
}
