// A version of the tree rewriter that can deal with async

async function rewriteAttributes(node, attributes, cb) {
  // Rewrite all the attributes and wait for all the results to come in
  const result = Object.assign({}, node)
  let didRewrite = false
  await Promise.all(
    attributes.map(
      attribute => asyncRewrite(node[attribute], cb)
        .then(value => {
          if (value != node[attribute]) {
            didRewrite = true
          }
          result[attribute] = value
        })
    )
  )
  if (!didRewrite) return node
  return result
}

async function asyncRewrite(node, cb) {
  if (node === null || node === undefined) {
    return null
  }
  if (Array.isArray(node)) {
    return Promise.all(node.map(item => asyncRewrite(item, cb)))
  }

  let result = node
  if (typeof node == 'object') {
    result = await rewriteAttributes(node, ['lhs', 'rhs', 'filter', 'operations', 'terms'], cb)
  }

  return cb(result)
}

export default asyncRewrite