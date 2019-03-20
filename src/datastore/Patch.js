const {merge} = require('lodash')
const validators = require('./validators')
const getSelection = require('./getSelection')

module.exports = class Patch {
  constructor(selection, operations = {}) {
    this.selection = selection
    this.operations = operations || {}
  }

  merge(props) {
    return this._assign('merge', merge(this.operations.merge || {}, props))
  }

  set(props) {
    return this._assign('set', props)
  }

  diffMatchPatch(props) {
    validators.validateObject('diffMatchPatch', props)
    return this._assign('diffMatchPatch', props)
  }

  unset(attrs) {
    if (!Array.isArray(attrs)) {
      throw new Error('unset(attrs) takes an array of attributes to unset, non-array given')
    }

    this.operations = {...this.operations, unset: attrs}
    return this
  }

  setIfMissing(props) {
    return this._assign('setIfMissing', props)
  }

  replace(props) {
    validators.validateObject('replace', props)
    return this._set('set', {$: props}) // eslint-disable-line id-length
  }

  inc(props) {
    return this._assign('inc', props)
  }

  dec(props) {
    return this._assign('dec', props)
  }

  insert(at, selector, items) {
    validators.validateInsert(at, selector, items)
    return this._assign('insert', {[at]: selector, items})
  }

  append(selector, items) {
    return this.insert('after', `${selector}[-1]`, items)
  }

  prepend(selector, items) {
    return this.insert('before', `${selector}[0]`, items)
  }

  splice(selector, start, deleteCount, items) {
    // Negative indexes doesn't mean the same in Saga as they do in JS;
    // -1 means "actually at the end of the array", which allows inserting
    // at the end of the array without knowing its length. We therefore have
    // to substract negative indexes by one to match JS. If you want Saga-
    // behaviour, just use `insert('replace', selector, items)` directly
    const delAll = typeof deleteCount === 'undefined' || deleteCount === -1
    const startIndex = start < 0 ? start - 1 : start
    const delCount = delAll ? -1 : Math.max(0, start + deleteCount)
    const delRange = startIndex < 0 && delCount >= 0 ? '' : delCount
    const rangeSelector = `${selector}[${startIndex}:${delRange}]`
    return this.insert('replace', rangeSelector, items || [])
  }

  ifRevisionId(rev) {
    this.operations.ifRevisionID = rev
    return this
  }

  serialize() {
    return {...getSelection(this.selection), ...this.operations}
  }

  toJSON() {
    return this.serialize()
  }

  reset() {
    this.operations = {}
    return this
  }

  _set(op, props) {
    return this._assign(op, props, false)
  }

  _assign(op, props, mergeProps = true) {
    validators.validateObject(op, props)
    this.operations = {
      ...this.operations,
      [op]: mergeProps ? {...(this.operations[op] || {}), ...props} : props
    }
    return this
  }
}
