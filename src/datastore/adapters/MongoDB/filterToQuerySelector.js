const util = require('util')
const {merge, omit} = require('lodash')
const {query: execQuery} = require('../../../vega-ql')
const debug = require('debug')('vega-ql-mongo')

const log = (prefix, ast) =>
  // eslint-disable-next-line no-console
  console.log(
    '%s: ',
    prefix,
    util.inspect(ast, {
      colors: true,
      depth: 15
    })
  )

module.exports = {
  toMongo,
  fetchForSpec,
  query
}

function query(collection, vegaQl, params = {}, options) {
  return execQuery({
    source: vegaQl,
    globalFilter: options.globalFilter || undefined || 'true',
    params,
    fetcher: spec => fetchForSpec(collection, spec)
  })
}

async function fetchForSpec(collection, spec) {
  const sort = spec.ordering.map(fromNode)
  const canSort = sort.every(Boolean)
  const filter = spec.filter ? fromNode(spec.filter) : {}
  const end = canSort ? Math.max(0, spec.end || 100) : 0
  const start = 0 //canSort ? Math.max(0, (spec.start || 0)) : 0
  // Currently the range limitation will be done by the run-time VegaQL-engine, so the fetch will always
  // start at index 0. In the future this result should be able to communicate to the run-time evaluator
  // when it has performed the range limitation here.

  debug(
    'mongo-fetch',
    util.inspect(
      {
        sort,
        canSort,
        filter,
        start,
        end
        // spec
      },
      {
        depth: 10
      }
    )
  )

  // Filter might be short-circuited to `false`,
  // don't query mongodb if this is the case
  let documents = []
  if (filter !== false) {
    const docQuery = collection.find(filter)

    // If there are things that cannot be sorted...
    if (canSort) {
      docQuery
        .skip(start)
        .limit(end - start)
        .sort(sort)
    }

    documents = await docQuery.toArray()
  }

  return documents.reduce(
    (acc, doc) => {
      acc.results.push(omit(doc, ['@refs']))
      acc.refs[doc._id] = doc['@refs'] || []
      return acc
    },
    {
      results: [],
      refs: {},
      start
    }
  )
}

function toMongo(node) {
  return fromNode(node)
}

// eslint-disable-next-line complexity
function fromNode(node) {
  switch (node.op) {
    case 'pipe':
      return fromPipe(node)
    case 'source':
      return fromSource(node)
    case 'parent':
      return fromParent(node)
    case 'filter':
      return wrapQuery(fromFilter(node))
    case 'not':
      return fromNotOperator(node)
    case 'and':
      return fromAndOperator(node)
    case 'or':
      return fromOrOperator(node)
    case 'eq':
      return fromEqualityFilter(node)
    case 'neq':
      return fromInequalityFilter(node)
    case 'gt':
      return fromGreaterThanFilter(node)
    case 'gte':
      return fromGreaterThanOrEqualFilter(node)
    case 'lt':
      return fromLessThanFilter(node)
    case 'lte':
      return fromLessThanOrEqualFilter(node)
    case 'in':
      return fromInFilter(node)
    case 'match':
      return fromMatchFilter(node)
    case 'accessor':
      return fromAccessor(node)
    case 'attribute':
      return fromAttribute(node)
    case 'literal':
      return fromLiteral(node)
    case 'array':
      return fromArray(node)
    case 'subscript':
      return fromSubscript(node)
    case 'functionCall':
      return fromFunctionCall(node)
    case 'sortDirection':
      return fromSortDirection(node)
    case 'ordering':
      return fromOrdering(node)
    default:
      throw new Error(`toMongo: Unknown node operation "${node.op}"`)
  }
}

function fromSource(node) {
  return {
    query: {}
  }
}

function fromPipe(pipe) {
  // Use for loop instead of reduce to be able to bail early in case of short-circuiting
  let acc = {
    query: {},
    limit: 100,
    offset: 0,
    returnFirst: false,
    sort: []
  }

  for (let i = 0; i < pipe.operations.length; i++) {
    const node = pipe.operations[i]
    const result = fromNode(node)
    const isShortCircuit = result && typeof result.query === 'boolean'
    if (isShortCircuit && result.query === true) {
      continue
    } else if (isShortCircuit) {
      return {
        query: false
      }
    }

    acc = merge(acc, result)
  }

  return acc
}

function fromParent(node) {
  return {}
}

function fromAndOperator(node) {
  const [lhs, rhs] = [node.lhs, node.rhs].map(asFilter)
  // Short circuit on "false" or "true"
  if (lhs === false || rhs === false) {
    return false
  } else if (lhs === true && rhs === true) {
    return {}
  } else if (lhs === true || rhs === true) {
    return lhs === true ? rhs : lhs
  }

  return {
    $and: [lhs, rhs]
  }
}

function fromOrOperator(node) {
  const [lhs, rhs] = [node.lhs, node.rhs].map(asFilter)
  // Short circuit on any side being literal true
  if (lhs === true || rhs === true) {
    return {}
  }

  // Remove any falsey parts
  return {
    $or: [lhs, rhs].filter(Boolean)
  }
}

function asFilter(node) {
  // *[isPublished] -> {isPublished: true}
  if (isAccessor(node)) {
    return fromEqualityFilter({
      op: 'eq',
      lhs: node,
      rhs: {
        op: 'literal',
        type: 'bool',
        value: true
      }
    })
  }

  return fromNode(node)
}

function fromFilter(node) {
  // *[isPublished] -> {isPublished: true}
  if (node.filter.op === 'accessor') {
    return asFilter(node.filter)
  }

  return fromNode(node.filter)
}

function fromNotOperator(node) {
  const rhs = fromNode(node.rhs)
  if (typeof rhs === 'boolean') {
    return !rhs
  }

  return {
    $nor: [fromNode(node.rhs)]
  }
}

function fromEqualityFilter(node) {
  const {type, lhs, rhs} = filterParts(node)
  if (type === 'literalComparison') {
    return lhs === rhs
  }

  if (type === 'fieldComparison') {
    return {
      $expr: {
        $eq: [`$${lhs}`, `$${rhs}`]
      }
    }
  }

  return {
    [lhs]: rhs
  }
}

function fromInequalityFilter(node) {
  const {type, lhs, rhs} = filterParts(node)
  if (type === 'literalComparison') {
    return lhs !== rhs
  }

  if (type === 'fieldComparison') {
    return {
      $expr: {
        $ne: [`$${lhs}`, `$${rhs}`]
      }
    }
  }

  return {
    [lhs]: {
      $ne: rhs
    }
  }
}

function fromGreaterThanFilter(node) {
  const {type, lhs, rhs} = filterParts(node)
  if (type === 'literalComparison') {
    return lhs > rhs
  }

  if (type === 'fieldComparison') {
    return {
      $expr: {
        $gt: [`$${lhs}`, `$${rhs}`]
      }
    }
  }

  return {
    [lhs]: {
      $gt: rhs
    }
  }
}

function fromGreaterThanOrEqualFilter(node) {
  const {type, lhs, rhs} = filterParts(node)
  if (type === 'literalComparison') {
    return lhs >= rhs
  }

  if (type === 'fieldComparison') {
    return {
      $expr: {
        $gte: [`$${lhs}`, `$${rhs}`]
      }
    }
  }

  return {
    [lhs]: {
      $gte: rhs
    }
  }
}

function fromLessThanFilter(node) {
  const {type, lhs, rhs} = filterParts(node)
  if (type === 'literalComparison') {
    return lhs < rhs
  }

  if (type === 'fieldComparison') {
    return {
      $expr: {
        $lt: [`$${lhs}`, `$${rhs}`]
      }
    }
  }

  return {
    [lhs]: {
      $lt: rhs
    }
  }
}

function fromLessThanOrEqualFilter(node) {
  const {type, lhs, rhs} = filterParts(node)
  if (type === 'literalComparison') {
    return lhs <= rhs
  }

  if (type === 'fieldComparison') {
    return {
      $expr: {
        $lte: [`$${lhs}`, `$${rhs}`]
      }
    }
  }

  return {
    [lhs]: {
      $lte: rhs
    }
  }
}

function fromInFilter(node) {
  const {type, lhs, rhs} = filterParts(node)

  if (type === 'pipeComparison') {
    // Could potentially be optimized
    return {}
  }

  // 'stringVal' in fieldName
  if (!rhs.$op && !Array.isArray(rhs) && type !== 'fieldComparison') {
    return {
      [lhs]: rhs
    }
  }

  // _id in path('drafts.*')
  let op = '$in'
  let rhsValue = rhs
  if (rhs.$op && rhs.value) {
    op = rhs.$op
    rhsValue = rhs.value
  }

  // 'foo' in ['hei', 'der']
  // 'drafts.foo' in path('drafts.*')
  if (type === 'literalComparison') {
    return op === '$in' ? rhs.includes(lhs) : new RegExp(rhsValue).test(lhs)
  }

  // mainTagField in arrayOfTagsField
  if (type === 'fieldComparison') {
    return {
      [lhs]: {
        $exists: true
      },
      [rhsValue]: {
        $type: 'array'
      },
      $expr: {
        [op]: [`$${lhs}`, `$${rhsValue}`]
      }
    }
  }

  return {
    [lhs]: {
      [op]: rhsValue
    }
  }
}

function fromInPathFilter(node) {
  const [path] = node.arguments.map(fromNode)
  const pattern = escapeRegExp(path)
    .replace(/\*\*$/, '')
    .replace(/\*$/, '[^\\.]+$')

  return {
    $op: '$regex',
    value: `^${pattern}`
  }
}

function fromDefinedFilter(node) {
  const [field] = node.arguments.map(fromNode)
  return {
    [field]: {
      $exists: true,
      $not: {
        $size: 0
      }
    }
  }
}

function fromReferencesFilter(node) {
  const ids = node.arguments.map(fromNode)
  return {
    $or: ids.map(id => ({
      '@refs': {
        $elemMatch: {
          id
        }
      }
    }))
  }
}

function fromMatchFilter(node) {
  const {type, lhs, rhs} = filterParts(node)

  if (Array.isArray(rhs)) {
    return {
      $and: rhs.map(term =>
        fromMatchFilter(
          Object.assign({}, node, {
            rhs: {
              op: 'literal',
              type: 'string',
              value: term
            }
          })
        )
      )
    }
  }

  if (Array.isArray(lhs)) {
    return {
      $or: lhs.map(name =>
        fromMatchFilter(
          Object.assign({}, node, {
            lhs: {
              op: 'accessor',
              path: [
                {
                  op: 'attribute',
                  name
                }
              ]
            }
          })
        )
      )
    }
  }

  const pattern = escapeRegExp(rhs)
    // * -> .*?
    .replace(/\*/g, '.*?')
    // Multiple occurences -> Single occurence (*** -> .*?)
    .replace(/(\.\*\?)+/g, '.*?')

  if (type === 'literalComparison') {
    const $regex = new RegExp(pattern, 'i')
    return $regex.test(lhs)
  }

  return {
    [lhs]: {
      $regex: pattern,
      $options: 'i'
    }
  }
}

function fromAccessor(node) {
  return node.path.map(fromNode).join('.')
}

function fromAttribute(node) {
  return node.name
}

function fromLiteral(node) {
  return node.value
}

function fromArray(node) {
  return node.operations.map(fromNode)
}

function fromFunctionCall(node) {
  switch (node.name) {
    case 'path':
      return fromInPathFilter(node)
    case 'defined':
      return fromDefinedFilter(node)
    case 'references':
      return fromReferencesFilter(node)
    case 'coalesce':
      // @todo See if this can be implemented at some point
      return true
    default:
      log(node.name, node)
      throw new Error(`toMongo: Unhandled function call "${node.name}"`)
  }
}

function fromSubscript(node) {
  return {
    limit: node.end - node.start,
    offset: node.start,
    returnFirst: node.first
  }
}

function fromSortDirection(node) {
  const expr = fromNode(node.expression)
  const dir = node.direction === 'desc' ? -1 : 1

  return typeof expr === 'string' ? [expr, dir] : false
}

function fromOrdering(node) {
  return {
    sort: node.terms.map(fromNode).filter(Boolean)
  }
}

// eslint-disable-next-line complexity
function filterParts(node) {
  const lhsIsAccessor = isAccessor(node.lhs)
  const rhsIsAccessor = isAccessor(node.rhs)

  const lhsIsLiteral = isValue(node.lhs)
  const rhsIsLiteral = isValue(node.rhs)

  const lhs = node.lhs && fromNode(node.lhs)
  const rhs = node.rhs && fromNode(node.rhs)

  if (lhsIsAccessor && rhsIsAccessor) {
    // some.field == other.field
    return {
      type: 'fieldComparison',
      lhs,
      rhs
    }
  } else if (lhsIsAccessor && rhsIsLiteral) {
    // some.field == 'some value'
    return {
      type: 'fieldLiteralComparison',
      lhs,
      rhs
    }
  } else if (rhsIsAccessor && lhsIsLiteral) {
    // 'some value' == some.field (-> some.field == 'some value')
    return {
      type: 'fieldLiteralComparison',
      lhs: rhs,
      rhs: lhs
    }
  } else if (lhsIsLiteral && rhsIsLiteral) {
    // 'some value' == 'other value'
    return {
      type: 'literalComparison',
      lhs,
      rhs
    }
  } else if (lhsIsAccessor && rhs.$op) {
    // 'some.field' $mongo-operator
    return {
      type: 'mongoComparison',
      lhs,
      rhs
    }
  } else if (lhsIsLiteral && node.rhs.op === 'pipe') {
    return {
      type: 'pipeComparison',
      lhs,
      rhs: node.rhs
    }
  }

  log('ehm', {
    lhs,
    rhs: node.rhs,
    node
  })
  console.log(node)
  throw new Error('Unable to determine filter type')
}

function wrapQuery(queryVal) {
  return {
    query: queryVal
  }
}

function isAccessor(node) {
  return node ? node.op === 'accessor' : false
}

function isValue(node) {
  return node ? node.op === 'literal' || node.op === 'array' : false
}

function escapeRegExp(reg) {
  // eslint-disable-next-line no-useless-escape
  return reg.replace(/([-.+?^${}()|[\]\/\\])/g, '\\$1')
}
