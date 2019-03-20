/* eslint-disable max-depth */

import { Assignment } from './operations'
import debug from '../debug'

// determineUnambiguousAlias derives an alias from an expression. An alias is a name
// which is, unambiguously, the first name addressed by an expression. The following
// expressions all return "foo" as the alias:
//
//   foo
//   foo[]
//   foo->
//   foo[]->
//   foo[bar == 1]
//   foo[0]
//   foo[0..10]
//
// More complicated expressions such as foo.bar where the name is ambiguous are
// not allowed.
export function determineUnambiguousAlias(operation) {
  debug('determineUnambiguousAlias()', operation)
  switch (operation.op) {
    case 'accessor':
      if (operation.path.length == 1) {
        if (operation.path[0].op == 'attribute') {
          return operation.path[0].name
        }
      }
      break
    case 'pipe':
      // Pipelines may specify an explicit alias (to preserve aliasing information in case of severe rewritage
      // during planning)
      if (operation.alias) {
        return operation.alias
      }
      return determineUnambiguousAlias(operation.operations[0])
    default:
      return null
  }
  return null
}


export function toObjectOperations(expressions) {
  // T0D0: Convert a list of expressions to object operations

  return expressions.map(expr => {
    const alias = determineUnambiguousAlias(expr)
    if (alias) {
      debug('=> alias:', alias)
      return new Assignment(alias, expr)
    }
    debug('no  alias')
    return expr
  })
}
