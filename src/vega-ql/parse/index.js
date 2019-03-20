const parseVegaQL = require('./vega-ql')

export default function parse(query, params) {
  const [json, err] = parseVegaQL(query, params)
  if (err !== null) {
    throw err
  }
  return JSON.parse(json)
}
