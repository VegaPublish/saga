/* eslint-disable max-depth */

import debug from '../debug'

export default class Scope {
  constructor(options) {
    const {value, parent, sourceId, sources, refs, start, path} = options
    // A single source cahce shared between all scopes in the same
    // execution chain.
    this.sources = sources || {}
    // The source this value came from (used when joins are encountered
    // to get at the entire collection)
    this.sourceId = sourceId
    // The parent scope of this scope
    this.parent = parent
    // The specific value of this scope
    this.value = value
    // The path of this specific value from source
    this.path = path || []
    // A cache of all refs seen in all documents fetched so far, shared between all scopes in
    // the same execution chain
    this.refs = refs || {}
    // Start offset of an array, used to represent partial sets, like e.g. the response
    // to *[100..102] will most likely be a two item array with start == 100 if the fetcher
    // is able to only fetch the relevant subset of the collection
    this.start = start
  }

  claimSource(id) {
    const result = {}
    this.sources[id] = new Promise(((resolve, reject) => {
      result.resolve = resolve
      result.reject = reject
    }))
    return result
  }

  cacheRefs(refs) {
    if (!refs) return
    Object.keys(refs).forEach(id => {
      this.refs[id] = refs[id]
    })
  }

  slice(start, end) {
    if (!Array.isArray(this.value)) {
      return this.clone({
        value: null
      })
    }
    const collectionStart = this.start || 0
    return this.clone({
      path: this.path.concat({
        op: 'subscript',
        start: start,
        end: end,
        first: false
      }),
      value: this.value.slice(start + collectionStart, end + collectionStart),
      start: 0
    })
  }

  first(offset) {
    if (!Array.isArray(this.value)) {
      return this.clone({
        value: null
      })
    }
    const collectionStart = this.start || 0
    return this.clone({
      path: this.path.concat({
        op: 'subscript',
        start: offset,
        end: offset + 1,
        first: true
      }),
      value: this.value.slice(offset + collectionStart)[0],
      start: 0
    })
  }

  // Returns true if the provided document references any of the ids
  doesReference(idsParam) {
    const ids = Array.isArray(idsParam) ? idsParam : [idsParam]

    const document = this.value

    debug('doesReference()', document, ids)

    if (!document || !typeof document === 'object' || !document._id) {
      return false
    }

    let refs = this.refs[document._id]
    if (!refs) {
      refs = mapReferences(document)
      debug('mapReferences()', refs, document)
      this.cacheRefs({
        [document._id]: refs
      })
    }

    return !!refs.find(ref => ids.indexOf(ref.id) !== -1)
  }

  sourceIsCached(sourceId) {
    return sourceId in this.sources
  }

  dataForSource(sourceId) {
    return this.sources[sourceId]
  }

  clone(options) {
    return new Scope(Object.assign({
      sources: this.sources,
      parent: this.parent,
      value: this.value,
      path: this.path,
      sourceId: this.sourceId,
      refs: this.refs,
      start: this.start
    }, options || {}))
  }

  child(options) {
    return new Scope(Object.assign({
      parent: this,
      sources: this.sources,
      sourceId: this.sourceId,
      refs: this.refs
    }, options || {}))
  }

  resolveAccessor(path) {
    debug('resolve accessor:', this.value, path)
    let scope = this // eslint-disable-line consistent-this
    if (scope.value) {
      for (let i = 0; i < path.length; i++) {
        const operation = path[i]
        switch (operation.op) {
          case 'parent':
            scope = scope.parent
            debug('^ =>', scope.value)
            break
          case 'attribute':
            scope = scope.child({
              parent: scope,
              value: scope.value[operation.name],
              path: scope.path.concat(operation)
            })
            debug(operation.name, '=>', scope.value, 'path:', scope.path)
            break
          default:
            throw new Error(`Unkown accessor path element ${operation.op}`)
        }
        if (!scope.value) {
          break
        }
      }
    }

    // Unresolved attributes should return null, not undefined?
    if (scope.value === undefined) {
      scope = scope.clone({
        value: null
      })
    }
    return scope
  }

  // Used in joins to find every possible value for this scope in every other document
  // from the same source
  async allSiblings() {
    debug("sourceId", this.sourceId, "sources", this.sources)
    const source = await this.dataForSource(this.sourceId)
    if (!source) {
      return []
    }
    return source.documents.map(item => {
      const scope = this.clone({
        path: [],
        value: item
      })
      debug('resolving', scope.value, this.pathAsString())
      return scope.resolveAccessor(this.path)
    }).filter(scope => !!scope.value)
  }

  // Resolves an accessor for all possible values of that accessor. Used
  // to expand join expressions so that i.e. ^.foo._ref resolves to all
  // foo._refs of the parent expression. Always returns an array of scopes
  async resolveAccessorForAll(path) {
    debug('resolve accessor (all):', this.value, path)
    let scope = this // eslint-disable-line consistent-this
    for (let i = 0; i < path.length; i++) {
      const operation = path[i]
      debug('resolve accessor: next op:', operation)
      switch (operation.op) {
        case 'parent':
          scope = scope.parent
          debug('resolve accessor: ^ =>', scope)
          break
        case 'attribute':
          if (scope.sourceId) {
            const source = (await scope.dataForSource(scope.sourceId)).documents // eslint-disable-line no-await-in-loop
            debug('resolve accessor: (source)', source)
            // Resolve the path to the source item for every document
            const sourceScopes = source.map(item => scope.clone({
              value: item
            }).resolveAccessor(scope.path))

            const flattenedSourceScopes = []

            // Flatten any arrays we might have seen
            sourceScopes.forEach(itemScope => {
              if (Array.isArray(itemScope.value)) {
                itemScope.value.forEach(itemValue => {
                  flattenedSourceScopes.push(scope.clone({
                    value: itemValue
                  }))
                })
              } else {
                flattenedSourceScopes.push(itemScope)
              }
            })


            debug('resolve accessor: (expanded scopes)', source)
            // Now resolve the rest of the path for each item
            const subPath = path.slice(i)
            const result = []
            flattenedSourceScopes.forEach(itemScope => { // eslint-disable-line no-loop-func, no-await-in-loop
              // const itemScope = scope.clone({
              //   value: item
              // })
              const resolvedScope = itemScope.resolveAccessor(subPath)
              if (resolvedScope.value !== null) {
                result.push(resolvedScope)
              }
            })
            return result
          }

          if (scope.value === null || scope.value === undefined) {
            return scope.clone({
              value: null
            })
          }

          scope = scope.child({
            parent: scope,
            value: scope.value[operation.name]
          })
          debug('resolve accessor:', operation.name, '=>', scope.value)
          break
        default:
          throw new Error(`Unkown accessor path element ${operation.op}`)
      }
      if (!scope.value) {
        break
      }
    }
    // Unresolved attributes should return null, not undefined?
    if (scope.value === undefined) {
      scope = scope.clone({
        value: null
      })
    }
    debug('resolve accessor (all, result):', this.value, path, scope)
    return [scope]
  }

  pathAsString() {
    return this.path.map(element => {
      switch (element.op) {
        case 'attribute':
          return element.name
        case 'subscript':
          if (element.first) {
            return `[${element.start}]`
          }
          return `[${element.start}...${element.end}]`
        default:
          throw new Error(`Unknown path op ${element.op}`)
      }
    }).join('.')
  }

  inspect() {
    const sourceIdStr = this.sourceId ? `#${this.sourceId} ` : ''
    return `Scope<${sourceIdStr}${this.pathAsString()}: ${JSON.stringify(this.value)}>`
  }

}
// A small function to extract all refs in a document as an array
function mapReferences(value) {
  debug('mapping', value)
  if (value === null || value === undefined) return []
  if (typeof value === 'object') {
    if (value._ref) {
      return [{
        id: value._ref
      }]
    }
    return Object.keys(value).reduce((result, key) => result.concat(mapReferences(value[key])), [])
  }
  if (Array.isArray(value)) {
    return value.reduce((result, item) => result.concat(mapReferences(item)), [])
  }
  return []
}
