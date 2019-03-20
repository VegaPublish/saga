module.exports = (app, sid, userId) =>
  app.services.sessionStore.set(sid, {
    id: sid,
    passport: {user: userId},
    cookie: {path: '/'}
  })
