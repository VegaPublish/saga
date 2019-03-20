module.exports = (err, props) => {
  Object.assign(err.output.payload, props, err.output.payload)
  return err
}
