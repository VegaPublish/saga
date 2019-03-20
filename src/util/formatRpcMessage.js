module.exports = (result, id, options = {}) => {
  const {stream, complete} = options
  return JSON.stringify({
    jsonrpc: '2.0',
    result,
    stream,
    complete,
    id
  })
}
