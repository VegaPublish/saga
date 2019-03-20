/* eslint-disable id-length */

import * as types from './types'
import { asPlainValue } from './scopeTools'

export function path(_, spec) {
  return new types.Path(spec.value)
}

export function joinPaths(_, a, b) {
  const aPath = new types.Path(a.value)
  const bPath = new types.Path(b.value)
  return aPath.concat(bPath)
}

export function coalesce(_, ...args) {
  const result = args.find(arg => arg.value !== null && arg.value !== undefined)
  if (result === undefined) {
    return null
  }
  return result.value
}

export function count(_, input) {
  const value = asPlainValue(input)
  if (Array.isArray(value)) {
    return value.length
  }
  return (input.value !== null && input.value !== undefined) ? 1 : 0
}

export function length(_, input) {
  const value = asPlainValue(input)
  if (value === null || value === undefined) {
    return null
  }
  if (Array.isArray(value)) {
    return value.length
  }
  if (typeof value === 'string') {
    return value.length
  }
  if (value && typeof value === 'object') {
    return Object.keys(value).length
  }
  return (value !== null && value !== undefined) ? 1 : 0
}

export function defined(_, input) {
  if (Array.isArray(input.value)) {
    return input.value.length > 0
  }
  if (input.value && typeof input.value === 'object') {
    return Object.keys(input.value).length > 0
  }
  return input.value !== undefined && input.value !== null
}

export function references(scope, input) {
  const ids = input.value
  return scope.doesReference(ids)
}
