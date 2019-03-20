/* eslint-disable complexity, class-methods-use-this */

import {toObjectOperations} from './objectExpressionOps'
import {newFunctionCall} from './functions'
import debug from '../debug'
import rewrite from './rewrite'

const ops = require('./operations')

export default class Composer {
  constructor(rootNode) {
    this.operations = this.compose(rootNode)
  }

  // Applies a filter to every source occurring in the query. For security.
  applyGlobalFilter(filterNode) {
    debug('Applying global filter', filterNode)
    const filterOperations = this.compose(filterNode)
    this.operations = rewrite(this.operations, operation => {
      switch (operation.op) {
        case 'pipe':
          return new ops.Pipeline({
            alias: operation.alias,
            operations: operation.operations.reduce((result, element) => {
              if (element.op == 'source') {
                return result.concat([element, new ops.Filter(filterOperations)])
              }
              return result.concat(element)
            }, [])
          })
        default:
          return operation
      }
    })
    debug('halo halo', JSON.stringify(this.operations))
  }

  result() {
    return this.operations
  }

  compose(node) {
    if (!node) {
      return null
    }
    const kind = node.node
    if (Array.isArray(node)) {
      return node.map(item => this.compose(item))
    }
    switch (kind) {
      case 'pipeOperator':
        return this.nodePipeOperator(node)
      case 'dotOperator':
        return this.nodeDotOperator(node)
      case 'everything':
        return this.nodeEverything(node)
      case 'constraint':
        return this.nodeConstraint(node)
      case 'binaryOperator':
        return this.nodeBinaryOperator(node)
      case 'attribute':
        return this.nodeAttribute(node)
      case 'object':
        return this.nodeObject(node)
      case 'array':
        return this.nodeArray(node)
      case 'subscript':
        return this.nodeSubscript(node)
      case 'ellipsis':
        return new ops.Splat()
      case 'functionCall':
        return this.nodeFunctionCall(node)
      case 'postfixOperator':
        return this.nodePostfixOperator(node)
      case 'prefixOperator':
        return this.nodePrefixOperator(node)
      case 'parent':
        return new ops.Accessor([new ops.Parent()])
      case 'range':
        return this.nodeRange(node)
      case 'integer':
      case 'string':
      case 'float':
      case 'bool':
        return this.nodeLiteral(node)
      default:
        throw new Error(`Unknown node type ${kind}`)
    }
  }

  nodePostfixOperator(node) {
    const lhs = this.compose(node.lhs)
    const name = node.operator
    return ops.applyPostfixOperator(lhs, name)
  }

  nodePrefixOperator(node) {
    const rhs = this.compose(node.rhs)
    const name = node.operator
    return ops.applyPrefixOperator(name, rhs)
  }

  nodeFunctionCall(node) {
    const args = this.compose(node.arguments)
    return newFunctionCall(node.name, args)
  }

  nodeRange(node) {
    return new ops.Range({
      start: node.start,
      end: node.end,
      inclusive: node.inclusive
    })
  }

  // T0D0: Check that subscript indicies are literal constants
  nodeSubscript(node) {
    switch (node.value.node) {
      case 'range':
        return new ops.Subscript({
          start: this.compose(node.value.start).value,
          end: node.value.inclusive
            ? this.compose(node.value.end).value + 1
            : this.compose(node.value.end).value,
          first: false
        })
      default: {
        const index = this.compose(node.value).value
        return new ops.Subscript({
          start: index,
          end: index + 1,
          first: true
        })
      }
    }
  }

  nodeObject(node) {
    const rawOps = this.compose(node.expressions) || []
    const operations = toObjectOperations(rawOps)
    return new ops.ObjectExpr({
      operations
    })
  }

  nodeArray(node) {
    const operations = this.compose(node.expressions) || []
    return new ops.ArrayExpr({
      operations
    })
  }

  nodePipeOperator(node) {
    const lhs = this.compose(node.lhs)
    const rhs = this.compose(node.rhs, lhs.source)
    return ops.applyBinaryOperator(lhs, rhs, 'pipe')
  }

  nodeDotOperator(node) {
    const lhs = this.compose(node.lhs)
    const rhs = this.compose(node.rhs)
    return ops.applyBinaryOperator(lhs, rhs, 'dot')
  }

  nodeEverything(node) {
    return new ops.Pipeline({
      operations: [new ops.Source()]
    })
  }

  nodeConstraint(node, source) {
    let filter = this.compose(node.expression)
    if (!filter) {
      filter = new ops.Literal({
        type: 'boolean',
        value: true
      })
    }
    return new ops.Filter(filter)
  }

  nodeBinaryOperator(node) {
    const lhs = this.compose(node.lhs)
    const rhs = this.compose(node.rhs)
    return ops.applyBinaryOperator(lhs, rhs, node.operator)
  }

  nodeAttribute(node) {
    return new ops.Accessor([new ops.Attribute(node.path)])
  }

  nodeLiteral(node) {
    return new ops.Literal({
      type: node.node,
      value: node.value
    })
  }
}
