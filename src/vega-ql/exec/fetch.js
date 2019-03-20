import { BinaryOperator, Literal, Attribute, Accessor } from '../plan/operations'
import Scope from './Scope'
import debug from '../debug'
import generalizeJoinFilter from './generalizeJoinFilter'
import { asPlainValue } from './scopeTools'
import util from 'util'

// Given a pipeline, fetch will make sure the source value for that pipeline
// gets cached in the parentScope. It does not actually return the retrieved
// value, but the same value with the fetch result cached into the sourceId
// of the provided pipeline.
// The fetcher is expected to return an object that looks something like this
// {
//   results: [{_id: 'doc4', _type: 'document'}, {_id: 'doc5', _type: 'document'}, ref: {_ref: 'doc4', weak: true}],
//   start: 3,
//   refs: {'doc5': [{id: 'doc3', weak: true}]}
// }
// `results` is required, `start` is used to signal that this set is allready offset by the fetcher so that the
// execution engine will not double-offset it, `refs` is a flattened list of all refs in every included document.
// This is optional and will be generated on demand if missing.

export default async function fetch(scope, pipeline, fetcher, executor) {
  debug('fetch()', scope, pipeline)
  const sourceId = extractSourceId(pipeline)
  // Is it a fetchable source, and did we not fetch it allready?
  if (!sourceId || scope.sourceIsCached(sourceId)) {
    debug('fetch() short circuit', sourceId, scope.sourceIsCached(sourceId))
    return scope
  }
  // We need to actually go get it
  const responder = scope.claimSource(sourceId)
  const fetchSpec = await compile(scope, pipeline, executor)
  const response = await fetcher(fetchSpec)
  // Cache the result on the scope so it will bind to the source
  // when it comes up later
  debug('fetch() scope:', scope, 'pipeline:', util.inspect(pipeline, {
    depth: 20
  }))
  debug('fetch() =>', response)
  scope.cacheRefs(response.refs)
  responder.resolve({
    documents: response.results,
    start: response.start || 0
  })
  return scope
}

// Keeps track of the central parameters of a fetch operation.
// Since pipelines are computed in reverse order, filters,
// orderings and windows are expected to be applied in reverse order
// last to first.
class FetchSpec {
  constructor(parentScope, sourceId) {
    this.parentScope = parentScope
    this.sourceId = sourceId
    this.clear()
  }

  applyFilter(constraint) {
    if (!this.filter) {
      this.filter = constraint
      return
    }
    this.filter = new BinaryOperator('and', this.filter, constraint)
  }

  project(objectOperations) { // eslint-disable-line class-methods-use-this
    // T0D0: Remap the values of the filter and orderings collected so far
    // by substituting expressions according to the projection
  }

  applyWindow(start, end) {
    debug("applyWindow()", start, end)
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      throw new Error("start and end must be finite when applying window")
    }
    if (this.start === null) {
      this.start = start
      this.end = end
      return
    }
    this.start += start
    this.end = Math.min(this.end + start, end)
  }

  applyOrdering(terms) {
    this.ordering = terms.concat(this.ordering)
  }

  clear() {
    this.filter = null
    this.start = null
    this.end = null
    this.ordering = []
  }
}

function extractSourceId(pipeline) {
  const operations = pipeline.operations
  if (operations.length == 0) {
    debug('extractSourceId: empty pipeline')
    return null
  }
  if (operations[0].op != 'source') {
    debug('extractSourceId: op 0 is not source', operations[0])
    return null
  }
  return operations[0].id
}

// Given a pipeline, collapses it to a filter, a window and an ordering
async function compile(scope, pipeline, executor) { // eslint-disable-line complexity
  const operations = pipeline.operations
  if (operations.length == 0) {
    throw new Error("Empty pipelines can't be collapsed")
  }
  if (operations[0].op != 'source') {
    throw new Error("Can't collapse pipelines that does not start with an *")
  }

  const sourceId = operations[0].id

  const fetchSpec = new FetchSpec(scope, sourceId)
  const ops = operations.slice(1)
  while (ops.length > 0) {
    const operation = ops.pop()
    debug('compiling', operation)
    switch (operation.op) {
      case 'filter':
        fetchSpec.applyFilter(operation.filter)
        break
      case 'mapJoin': {
        const filter = await generalizeMapJoin(operation, scope, executor) // eslint-disable-line no-await-in-loop
        fetchSpec.applyFilter(filter)
        break
      }
      case 'object':
        fetchSpec.project(operation.operations)
        break
      case 'subscript':
        fetchSpec.applyWindow(operation.start, operation.end)
        break
      case 'ordering':
        fetchSpec.applyOrdering(operation.terms)
        break
      case 'accessor':
        fetchSpec.project(operation.operations)
        break
      default:
        throw new Error(`Unknown pipeline operation ${operation.op} when compiling fetch-operation`)
    }
  }

  const generalizedFilter = await generalizeJoinFilter(fetchSpec.filter, scope)
  const wasJoin = generalizedFilter !== fetchSpec.filter

  // If this was a join, replace fetch with a join-fetch
  if (wasJoin) {
    const joinFetch = new FetchSpec(scope, sourceId)
    joinFetch.filter = generalizedFilter
    return joinFetch
  }

  // T0D0: Now the filter needs to be expanded in case it requires anything
  // to be fetched in order to be executed.
  debug('fetchSpec => ', fetchSpec)
  return fetchSpec
}

// Given a map join, generates a filter that will fetch all possible source values for that
// join.
async function generalizeMapJoin(operation, scope, executor) {
  if (!scope) {
    debug("mapJoin over null short circuited")
    return new Literal({
      type: 'boolean',
      value: false
    })
  }
  let ids
  if (scope.sourceId) {
    const source = await scope.dataForSource(scope.sourceId)
    debug('expanding mapJoin', scope, scope.sourceId)
    const idPromises = source.documents.map(async document => {
      const scopedDocument = new Scope({
        value: document
      })
      const resolved = asPlainValue(await executor.exec(operation.pipeline, scopedDocument)).filter(Boolean)
      debug('resolved', resolved)
      if (resolved) {
        return resolved
      }
      return null
    })
    const idMap = {}
    ids = (await Promise.all(idPromises))
      .forEach(idSet => idSet.forEach(id => {
        idMap[id] = true
      }))
    ids = Object.keys(idMap)
  } else {
    return (new Literal({
      value: false
    }))
  }
  debug('expanded mapJoin', ids)
  return new BinaryOperator('in',
    new Accessor([new Attribute('_id')]),
    new Literal({
      value: ids
    })
  )
}