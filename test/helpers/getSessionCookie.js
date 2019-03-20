const signature = require('cookie-signature')

const enc = encodeURIComponent

module.exports = (app, user, tokenOnly = false) => {
  const {secret, name} = app.services.config.session
  const signed = `s:${signature.sign(user.sessionId, secret)}`
  return tokenOnly ? signed : `${enc(name)}=${enc(signed)}`
}
