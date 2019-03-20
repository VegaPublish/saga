/* eslint-disable complexity, max-depth, id-length */

import debug from '../debug'

export class Path {
  constructor(spec) {
    debug("Path()", spec)
    if (spec instanceof Path) {
      this.elements = spec.elements.slice()
    } else if (Array.isArray(spec)) {
      this.elements = spec
    } else {
      this.elements = spec.split('.')
    }
  }

  concat(otherPath) {
    return new Path([...this.elements, ...otherPath.elements])
  }

  inspect() {
    return `path(${this.elements.join('.')})`
  }

  toJSON() {
    return this.elements.join('.')
  }

  contains(pathSpec) {
    if (typeof pathSpec !== 'string' && !(pathSpec instanceof Path)) {
      throw new Error(`${pathSpec} in ${this.elements.join('.')} is only valid when lhs is a string or path`)
    }
    const pattern = this.elements.slice()
    const candidate = new Path(pathSpec).elements

    while (true) { // eslint-disable-line no-constant-condition
      const p = pattern.shift()
      const c = candidate.shift()
      if (p == '**') {
        return true
      }
      if (p == '*') {
        if (candidate.length == 0) {
          return true
        }
        return false
      }
      if (p != c) {
        return false
      }
      if (pattern.length == 0 || candidate.length == 0) {
        return false
      }
    }
  }
}
