function rewriteAttribute(node, attribute, cb) {
  if (!node[attribute]) {
    return node
  }
  const next = rewrite(node[attribute], cb)
  if (next !== node[attribute]) {
    return Object.assign({}, node, {
      [attribute]: next
    })
  }
  return node
}


export default function rewrite(node, cb) {
  if (!node) {
    return null
  }
  if (Array.isArray(node)) {
    return node.map(item => rewrite(item, cb))
  }

  ['lhs', 'rhs', 'filter', 'operations', 'terms'].reduce(
    (rewrittenNode, attribute) => rewriteAttribute(rewrittenNode, attribute, cb),
    node
  )

  return cb(node)
}
