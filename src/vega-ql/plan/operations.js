import { determineUnambiguousAlias } from './objectExpressionOps'
import debug from '../debug'
import util from 'util'

let nextSourceId = 1

class Source {
  constructor() {
    this.op = 'source'
    this.id = nextSourceId++
  }
}

class Filter {
  constructor(filter) {
    this.op = 'filter'
    this.filter = filter
  }
}

class Pipeline {
  constructor(options) {
    const {operations, alias} = options
    this.op = 'pipe'
    this.operations = operations
    // The alias will be used to auto-assign this pipeline if it appears
    // without an explicit assignment in an object expression
    this.alias = alias
    debug("new pipeline:", util.inspect(this, {
      depth: 10
    }), options)
  }

  pipeOp(operation) {
    return new Pipeline({
      operations: this.operations.concat(operation),
      alias: this.alias
    })
  }

  dotOp(operation) {
    return new Pipeline({
      operations: this.operations.concat(operation),
      alias: this.alias
    })
  }
}

class ObjectExpr {
  constructor(options) {
    const {operations} = options
    this.op = 'object'
    this.operations = operations
  }

  dotOp(rhs) {
    return new Pipeline({
      operations: [this, rhs]
    })
  }
}

class ArrayExpr {
  constructor(options) {
    const {operations} = options
    this.op = 'array'
    this.operations = operations
  }
}

class Accessor {
  constructor(path) {
    this.op = 'accessor'
    this.path = path
  }

  dotOp(rhs) {
    switch (rhs.op) {
      case 'attribute':
        return new Accessor(this.path.concat([rhs]))
      case 'accessor':
        return new Accessor(this.path.concat(rhs.path))
      default:
        return null
    }
  }
}

class Attribute {
  constructor(name) {
    this.op = 'attribute'
    this.name = name
  }

  dotOp(rhs) {
    if (rhs.op == 'attribute') {
      return new Accessor([this, rhs])
    }
    return null
  }
}

class SortDirection {
  constructor(options) {
    const {expression, direction} = options
    this.op = 'sortDirection'
    if (expression.op == 'literal') {
      this.expression = new Accessor(
        [new Attribute(expression.value)]
      )
    } else {
      this.expression = expression
    }
    this.direction = direction
  }
}

class Ordering {
  constructor(terms) {
    this.op = 'ordering'
    this.terms = terms
  }
}

class Subscript {
  constructor(options) {
    const {start, end, first} = options
    this.op = 'subscript'
    this.start = start
    this.end = end
    // Should this resolve to just the first value of the result set?
    this.first = first
  }
}

class Range {
  constructor(options) {
    const {start, end, inclusive} = options
    this.op = 'range'
    this.start = start
    this.inclusive = inclusive
    this.end = end
  }
}

class Splat {
  constructor() {
    this.op = 'splat'
  }
}

class Parent {
  constructor() {
    this.op = 'parent'
  }
}

class FunctionCall {
  constructor(name, args) {
    this.op = 'functionCall'
    this.name = name
    this.arguments = args
  }
}

class Literal {
  constructor(options) {
    const {type, value} = options
    this.op = 'literal'
    this.type = type
    this.value = value
  }
}

class BinaryOperator {
  constructor(name, lhs, rhs) {
    this.op = name
    this.lhs = lhs
    this.rhs = rhs
  }
}

class PrefixOperator {
  constructor(name, rhs) {
    this.op = name
    this.rhs = rhs
  }
}

// Explicit assignment of attribute in object expression
class Assignment {
  constructor(name, value) {
    this.op = 'assignment'
    this.name = name
    this.value = value
  }
}


// A map join takes a pipeline that resolves to an array of id's and fetches those documents returning them in the same order
// as they resolve in the pipeline.
class MapJoin {
  constructor(pipeline) {
    this.op = 'mapJoin'
    this.pipeline = pipeline
  }
}

const defaultOperators = {
  andOp(lhs, rhs) {
    return new BinaryOperator('and', lhs, rhs)
  },

  orOp(lhs, rhs) {
    return new BinaryOperator('or', lhs, rhs)
  },

  equalsOp(lhs, rhs) {
    return new BinaryOperator('eq', lhs, rhs)
  },

  neqOp(lhs, rhs) {
    return new BinaryOperator('neq', lhs, rhs)
  },

  pipeOp(lhs, rhs) {
    return new Pipeline({
      operations: [lhs, rhs]
    })
  },

  inOp(lhs, rhs) {
    return new BinaryOperator('in', lhs, rhs)
  },

  ltOp(lhs, rhs) {
    return new BinaryOperator('lt', lhs, rhs)
  },

  lteOp(lhs, rhs) {
    return new BinaryOperator('lte', lhs, rhs)
  },

  gtOp(lhs, rhs) {
    return new BinaryOperator('gt', lhs, rhs)
  },

  gteOp(lhs, rhs) {
    return new BinaryOperator('gte', lhs, rhs)
  },

  matchOp(lhs, rhs) {
    return new BinaryOperator('match', lhs, rhs)
  },

  colonOp(lhs, rhs) {
    if (lhs.op != 'literal' || lhs.type != 'string') {
      throw new Error(`Invalid object attribute assignment. Please use string literals`)
    }
    const name = lhs.value
    return new Assignment(name, rhs)
  }
}

function applyBinaryOperator(lhs, rhs, name) {

  // First see if there is a special handler for this operator in this
  // context, and if it returns a defined result for this op.
  const handlerName = `${name}Op`
  if (lhs[handlerName]) {
    const result = lhs[handlerName](rhs)
    if (result !== undefined) {
      return result
    }
  }

  // No? Let's see if we have a default impl for this operator
  if (!defaultOperators[handlerName]) {
    throw new Error(`Operator not supported: ${lhs.op} ${name} ${rhs.op}`)
  }
  return defaultOperators[handlerName](lhs, rhs)
}

function applyPostfixOperator(lhs, name) {
  switch (name) {
    case 'asc':
    case 'desc':
      return new SortDirection({
        expression: lhs,
        direction: name
      })
    case 'arrow':
      // Rewrite foo-> to *[^.foo._ref == _id]
      // T0D0: Assert lhs is accessor
      debug('arrow operator lhs', lhs)
      if (lhs.op == 'accessor') {
        return new Pipeline({
          operations: [
            new Source(),
            new Filter(
              new BinaryOperator('eq',
                new Accessor([new Parent(), ...(lhs.path), new Attribute('_ref')]),
                new Accessor([new Attribute('_id')])
              )
            ),
            new Subscript({
              start: 0,
              end: 1,
              first: true
            })
          ],
          alias: determineUnambiguousAlias(lhs)
        })
      } else if (lhs.op == 'pipe') {
        // Rewrite ref[]->  to  mapJoin(ref[]._ref)
        return new Pipeline({
          alias: determineUnambiguousAlias(lhs),
          operations: [
            new Source(),
            new MapJoin(new Pipeline({
              operations: [
                ...(lhs.operations),
                new Accessor([
                  new Attribute('_ref')
                ])
              ]
            }))
          ]
        })
      }
      return new Pipeline({
        operations: [new Literal({
          value: null
        })]
      })
    default:
      throw new Error(`Unknown postfix operator ${name}`)
  }
}

function applyPrefixOperator(name, rhs) {
  switch (name) {
    case 'not':
      return new PrefixOperator(name, rhs)
    default:
      throw new Error(`Unknown postfix operator ${name}`)
  }
}

module.exports = {
  Source,
  Filter,
  Literal,
  Attribute,
  Accessor,
  ObjectExpr,
  ArrayExpr,
  Assignment,
  Subscript,
  FunctionCall,
  SortDirection,
  Ordering,
  Splat,
  Parent,
  applyBinaryOperator,
  applyPostfixOperator,
  applyPrefixOperator,
  BinaryOperator,
  PrefixOperator,
  Pipeline,
  Range
}