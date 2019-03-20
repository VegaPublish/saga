import Scope from './Scope'
import fetch from './fetch'
import debug from '../debug'
import * as functions from './functions'
import * as types from './types'
import sort from './sort'
import match from './match'
import { asPlainValue } from './scopeTools'

// Implementation of equals that do not respect object equality and eschews deep compare
function equals(lhs, rhs) {
  if (typeof lhs === 'object' || typeof rhs === 'object') {
    if (lhs && rhs && lhs.toJSON && rhs.toJSON) {
      return lhs.toJSON() == rhs.toJSON()
    }
    return false
  }
  return lhs == rhs
}

function lt(lhs, rhs) {
  if (typeof lhs === 'object' || typeof rhs === 'object') {
    if (lhs && rhs && lhs.toJSON && rhs.toJSON) {
      return lhs.toJSON() < rhs.toJSON()
    }
    return false
  }
  return lhs < rhs
}

function gt(lhs, rhs) {
  if (typeof lhs === 'object' || typeof rhs === 'object') {
    if (lhs && rhs && lhs.toJSON && rhs.toJSON) {
      return lhs.toJSON() > rhs.toJSON()
    }
    return false
  }
  return lhs > rhs
}

// Slices an input. If the input is an array of scopes: slices each scope individually. If the
// input is a scope with an array: slices the scope
function slice(input, start, end) {
  // if (Array.isArray(input)) {
  //   return input.map(scope => scope.slice(start, end))
  // }
  if (Array.isArray(input)) {
    return input.slice(start, end)
  }
  // Input is a single scope
  return input.slice(start, end)
}


function first(input, offset) {
  // if (Array.isArray(input)) {
  //   return input.map(scope => scope.first(offset))
  // }
  if (Array.isArray(input)) {
    const result = input[offset]
    if (!result) {
      return new Scope({
        value: null
      })
    }
    return result
  }
  // Input is a single scope
  return input.first(offset)
}

// function shallowFlatten(value) {
//   if (!Array.isArray(value)) {
//     return value
//   }
//   const result = []
//   value.forEach(item => {
//     if (Array.isArray(item)) {
//       result.push(...item)
//     } else {
//       result.push(item)
//     }
//   })
//   return result
// }

module.exports = class Executor {

  constructor(options) {
    const {operations, scope, fetcher} = options
    this.scope = scope || new Scope({
      parent: null,
      value: {}
    })
    this.fetcher = fetcher
    this.operations = operations
  }

  async run() { // eslint-disable-line require-await
    return this.exec(this.operations, this.scope)
  }

  /* eslint-disable complexity */
  async exec(operation, scope) {
    debug('exec() op:', operation, 'scope:', scope)
    if (scope instanceof Promise) {
      throw new Error('scopes should be plain values, not promises')
    }
    switch (operation.op) {
      case 'pipe':
        return this.execPipeline(operation, scope)
      case 'source': {
        const data = await scope.dataForSource(operation.id)
        debug("sourceId will be", operation.id)
        return scope.child({
          sourceId: operation.id,
          value: data.documents,
          start: data.start
        })
      }
      case 'filter':
        return this.execFilter(operation, scope)
      case 'and':
        return this.execAnd(operation, scope)
      case 'or':
        return this.execOr(operation, scope)
      case 'eq':
        return this.execEq(operation, scope)
      case 'neq':
        return this.execNEq(operation, scope)
      case 'lt':
        return this.execLT(operation, scope)
      case 'lte':
        return this.execLTE(operation, scope)
      case 'gt':
        return this.execGT(operation, scope)
      case 'gte':
        return this.execGTE(operation, scope)
      case 'not':
        return this.execNOT(operation, scope)
      case 'accessor':
        return this.execAccessor(operation, scope)
      case 'literal':
        return this.execLiteral(operation, scope)
      case 'object':
        return this.execObjectExpr(operation, scope)
      case 'array':
        return this.execArray(operation, scope)
      case 'in':
        return this.execIn(operation, scope)
      case 'functionCall':
        return this.execFunctionCall(operation, scope)
      case 'match':
        return this.execMatch(operation, scope)
      case 'mapJoin':
        return this.execMapJoin(operation, scope)
      default:
        throw new Error(`(exec) Unknown operation ${operation.op}`)
    }
  }
  /* eslint-enable complexity */

  async execFunctionCall(operation, scope) {
    const fn = functions[operation.name]
    if (!fn) {
      throw new Error(`Unknown function ${operation.name}`)
    }
    const scopedArgs = await Promise.all(
      operation.arguments.map(arg => this.exec(arg, scope))
    )
    return scope.clone({
      value: fn(scope, ...scopedArgs)
    // value: fn(...(scopedArgs.map(scopedArg => scopedArg.value)))
    })
  }

  // Exec an array of operations and return their plain values as an array
  async execEval(operations, scope) { // eslint-disable-line require-await
    return Promise.all(operations.map(op => this.exec(op, scope))).then(scopes => {
      return scopes.map(scopedValue => scopedValue.value)
    })
  }

  async execMatch(operation, scope) {
    const [lhs, rhs] = await Promise.all([
      this.exec(operation.lhs, scope),
      this.exec(operation.rhs, scope)
    ])
    const terms = Array.isArray(rhs.value) ? rhs.value : [rhs.value]
    return scope.clone({
      value: match(lhs.value, terms)
    })

  }

  /* eslint-disable complexity, max-depth */
  async execIn(operation, scope) {
    const [lhs, rhs] = await Promise.all([
      this.exec(operation.lhs, scope),
      this.exec(operation.rhs, scope)
    ])
    const lhsValue = asPlainValue(lhs)
    const rhsValue = asPlainValue(rhs)
    if (lhsValue === null || lhsValue === undefined || rhsValue === null || rhsValue === undefined) {
      return scope.clone({
        value: null
      })
    }
    if (Array.isArray(rhsValue)) {
      for (let i = 0; i < rhsValue.length; i++) {
        const candidate = rhsValue[i]
        if (lhsValue == candidate) {
          return scope.clone({
            value: true
          })
        }
        if (candidate instanceof types.Path) {
          if (candidate.contains(lhsValue)) {
            return scope.clone({
              value: true
            })
          }
        }
      }
      return scope.clone({
        value: false
      })
    }
    if (rhsValue instanceof types.Path) {
      debug('path containment', lhsValue, rhsValue)
      return scope.clone({
        value: rhsValue.contains(lhsValue)
      })
    }
    throw new Error(`in-operator does not apply to rhs value ${rhs.value}`)
  }
  /* eslint-enable complexity, max-depth */


  async execArray(operation, scope) { // eslint-disable-line require-await
    return Promise.all(operation.operations.map(op => this.exec(op, scope))).then(elements => {
      return scope.clone({
        value: elements.map(element => asPlainValue(element))
      })
    })
  }

  async execObjectExpr(operation, scope) { // eslint-disable-line require-await
    debug('execObjectExpr()', operation, scope)
    const evalObjOp = async (objOp) => { // eslint-disable-line require-await
      debug('objOp:', objOp)
      switch (objOp.op) {
        case 'assignment':
          return this.exec(objOp.value, scope).then(resultScope => {
            const value = asPlainValue(resultScope)
            debug(`objOp assignment [${objOp.name}] = ${value}`, value)
            // Don't assign null values to the object
            if (value === null || value == undefined) {
              return {}
            }
            return {
              [objOp.name]: value
            }
          })
        case 'splat':
          return scope.value
        default:
          debug('Unknown object expr', objOp.op, objOp)
          throw new Error(`Unknown object expression operation ${objOp.op}`)
      }
    }

    return Promise.all(operation.operations.map(evalObjOp)).then(fragments => {
      debug('object fagments:', fragments)
      const value = Object.assign({}, ...fragments)
      const result = scope.clone({
        value
      })
      debug('projected object:', result)
      return result
    })
  }

  async pipeMap(operation, lhs) { // eslint-disable-line require-await
    const input = Array.isArray(lhs) ? lhs : [lhs]
    return Promise.all(input.map(item => {
      return this.exec(operation, item)
    }))
  }

  async pipeFilter(operation, lhs) { // eslint-disable-line require-await
    let input
    if (Array.isArray(lhs)) {
      debug("LHS is array")
      // If lhs is an array of scopes, we perform flattening on each scope before proceeding
      input = lhs
      debug('flatten', lhs)
      input = lhs.reduce((sum, item) => {
        if (Array.isArray(item.value)) {
          return sum.concat(item.value.map(element => item.clone({
            value: element
          })))
        }
        return sum.concat(item)
      }, [])
      debug('flattened to', input)
    } else {
      // If lhs is a single array value, explode it to an array of scopes
      if (Array.isArray(lhs.value)) { // eslint-disable-line no-lonely-if
        debug("LHS is single array value (explode)")
        input = lhs.value.map(item => lhs.clone({
          value: item
        }))
      } else {
        // If lhs is a single non-array value, wrap it in an array
        debug("LHS is single non-array value (wrap)")
        input = [lhs]
      }
    }
    debug('mapped lhs for filter, lhs:', lhs, 'input:', input)
    const filterPromises = input.map(item => {
      return this.exec(operation, item)
    })
    return Promise.all(filterPromises).then(
      filterValues => {
        debug('filter result:', filterValues)
        return input.filter(((element, index) => filterValues[index].value === true))
      }
    )
  }

  async pipe(operation, lhs) {
    const inputIsArray = Array.isArray(lhs)
    let result
    switch (operation.op) {
      case 'subscript':
        if (operation.first) {
          debug('first()', lhs, operation.start)
          debug('=>', first(lhs, operation.start))
          return first(lhs, operation.start)
        }
        debug('slice()', lhs, operation.start, operation.end)
        debug('=>', slice(lhs, operation.start, operation.end))
        return slice(lhs, operation.start, operation.end)
      case 'ordering':
        return sort(lhs, operation.terms, this)
      case 'filter':
        return this.pipeFilter(operation, lhs)
      default:
        debug('mapping:', lhs)
        result = await this.pipeMap(operation, lhs)
        break
    }
    debug('input was array:', inputIsArray, result)
    if (inputIsArray) {
      return result
    }
    if (!result.then) {
      debug("Un-arrayifying plain value", result)
      return Array.isArray(result) ? result[0] : result
    }
    return result.then(arrayResult => {
      debug("Un-arrayifying promised value", arrayResult)
      return arrayResult[0]
    })
  }

  // NOTE: Consider keeping the pipeline value as an array of scope, not a scope
  // containing an array. Have a feeling each value in the mapping chain needs
  // the ability to keep track of it's own parents etc.
  async execPipeline(operation, scope) {
    scope = await fetch(scope, operation, this.fetcher, this) // eslint-disable-line no-param-reassign
    const ops = operation.operations.slice()
    const firstOp = ops.shift()
    debug('first op', firstOp)
    let current = await this.exec(firstOp, scope)
    debug('first op result:', current)
    while (ops.length > 0) {
      debug('current:', current)
      const nextOp = ops.shift()
      debug('nextOp:', nextOp)
      current = await this.pipe(nextOp, current) // eslint-disable-line no-await-in-loop
    }
    debug('current:', current)
    return current
  }

  async execBinaryOp(operation, scope, impl) {
    const lhs = await this.exec(operation.lhs, scope)
    const rhs = await this.exec(operation.rhs, scope)
    return new Scope({
      parent: scope.parent,
      value: impl(lhs.value, rhs.value)
    })
  }

  async execPrefixOp(operation, scope, impl) {
    const rhs = await this.exec(operation.rhs, scope)
    return new Scope({
      parent: scope.parent,
      value: impl(rhs.value)
    })
  }

  async execAnd(operation, scope) { // eslint-disable-line require-await
    return this.execBinaryOp(operation, scope, (lhs, rhs) => {
      if (lhs === false || rhs === false) {
        return false
      }
      if (typeof lhs !== 'boolean' || typeof rhs !== 'boolean') {
        return null
      }
      return lhs && rhs
    })
  }

  async execOr(operation, scope) { // eslint-disable-line require-await
    return this.execBinaryOp(operation, scope, (lhs, rhs) => {
      if (lhs === true || rhs === true) {
        return true
      }
      if (typeof lhs !== 'boolean' || typeof rhs !== 'boolean') {
        return null
      }
      return lhs || rhs
    })
  }

  async execEq(operation, scope) { // eslint-disable-line require-await
    return this.execBinaryOp(operation, scope, (lhs, rhs) => equals(lhs, rhs))
  }

  async execNEq(operation, scope) { // eslint-disable-line require-await
    return this.execBinaryOp(operation, scope, (lhs, rhs) => !equals(lhs, rhs))
  }

  async execLT(operation, scope) { // eslint-disable-line require-await
    return this.execBinaryOp(operation, scope, (lhs, rhs) => lt(lhs, rhs))
  }

  async execLTE(operation, scope) { // eslint-disable-line require-await
    return this.execBinaryOp(operation, scope, (lhs, rhs) => lt(lhs, rhs) || equals(lhs, rhs))
  }

  async execGT(operation, scope) { // eslint-disable-line require-await
    return this.execBinaryOp(operation, scope, (lhs, rhs) => gt(lhs, rhs))
  }

  async execGTE(operation, scope) { // eslint-disable-line require-await
    return this.execBinaryOp(operation, scope, (lhs, rhs) => gt(lhs, rhs) || equals(lhs, rhs))
  }

  async execNOT(operation, scope) { // eslint-disable-line require-await
    return this.execPrefixOp(operation, scope, rhs => {
      if (typeof rhs !== 'boolean') {
        return null
      }
      return !rhs
    })
  }

  async execMapJoin(operation, scope) {
    debug('execMapJoin', operation)
    const source = asPlainValue(scope)
    const parent = scope.parent
    let mapValues = asPlainValue((await this.exec(operation.pipeline, parent)))
    debug('execMapJoin mapValues', mapValues)
    debug('execMapJoin source', source)
    const mapOverArray = Array.isArray(mapValues)
    mapValues = mapOverArray ? mapValues : [mapValues]
    const joinResult = mapValues.map(id => scope.child({
      value: source.find(item => item._id == id)
    }))
    debug('joinResult', joinResult)
    return mapOverArray ? joinResult : joinResult[0]
  }

  async execAccessor(operation, scope) { // eslint-disable-line require-await, class-methods-use-this
    debug('execAccessor()', operation.path, scope)
    if (!scope) {
      return new Scope({
        value: null
      })
    }
    return scope.resolveAccessor(operation.path)
  }

  async execLiteral(operation, scope) { // eslint-disable-line require-await, class-methods-use-this
    return new Scope({
      parent: null,
      value: operation.value
    })
  }

  async execFilter(operation, scope) { // eslint-disable-line require-await
    return this.exec(operation.filter, scope)
  }
}
