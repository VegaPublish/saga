const http = require('http')

module.exports = () =>
  new Promise(resolve => {
    const server = http.createServer(
      (req, res) =>
        res.writeHead(200, 'OK', {'Content-Type': 'application/json'}) &&
        res.write(JSON.stringify(req.body || {})) &&
        res.end()
    )

    const close = () => new Promise(resolveClose => server.close(resolveClose))
    server.listen(0, () => resolve({close, port: server.address().port}))
  })
