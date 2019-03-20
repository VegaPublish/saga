module.exports = (providers, req, res) => {
  res.json({
    providers: providers.map(provider => ({
      name: provider.name,
      title: provider.title,
      url: `${req.protocol}://${req.headers.host}/v1/auth/login/${provider.name}`
    }))
  })
}
