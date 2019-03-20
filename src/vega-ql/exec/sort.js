/* eslint-disable id-length */

import debug from '../debug'

// Coerce a value to be on the comparable form. E.g. rewrites path("a.b.c") => "a.b.c"
// function coerce(value) {
//   if (value === null || value === undefined) {
//     return null
//   }
//   if (value.toJSON) {
//     return value.toJSON()
//   }
//   return value
// }

const TYPE_ORDER = {
  'number': 1,
  'string': 2,
  'boolean': 3,
  'object': 4
}

function compare(a, b, ascending) {
  if (a === b) {
    return 0
  }
  if (typeof a !== typeof b) {
    if (TYPE_ORDER[typeof a] < TYPE_ORDER[typeof b]) {
      return -1
    }
    return 1
  }
  if (a < b) {
    return ascending ? -1 : 1
  }
  return ascending ? 1 : -1
}


async function sortScopes(scopes, searchTerms, executor) {
  debug("sortScopes()", scopes, searchTerms, executor)
  const terms = searchTerms.slice()
  // Map each object into terms sorted by cardinality
  // so [{a: 1, b: "a"}, {a: 2, b: "b"}]|order(a, b)
  // becomes [[1, "a"], [2, "b"]]
  const itemWithTerms = []
  debug('scopes to be sorted', scopes)
  for (let i = 0; i < scopes.length; i++) {
    const scope = scopes[i]
    const termValues = await (Promise.all(terms.map(term => { // eslint-disable-line no-await-in-loop
      return executor.exec(term.expression, scope)
    }))).then(theScopes => theScopes.map(theScope => theScope.value))
    itemWithTerms.push({
      scope,
      terms: termValues
    })
  }
  // const itemWithTerms = scopes.map(async scope => ({
  //   scope: scope,
  //   terms: Promise.all(terms.map(term => {
  //     return executor.exec(term.expression, scope)
  //   }))
  // }))
  debug('itemWithTerms', itemWithTerms)
  const termIsAscending = terms.map(term => term.direction == 'asc')
  debug('term is ascending', termIsAscending)

  const sorted = itemWithTerms.sort((a, b) => {
    for (let i = 0; i < terms.length; i++) {
      const ascending = termIsAscending[i]
      const comparision = compare(a.terms[i], b.terms[i], ascending)
      if (comparision !== 0) {
        return comparision
      }
    }
    return 0
  })

  debug('sorted', sorted)

  return sorted.map(item => item.scope)
}

export default async function sort(input, terms, executor) { // eslint-disable-line require-await
  debug("sort()", input, terms, executor)
  if (Array.isArray(input)) {
    // Input is array of scopes
    debug("Sorting as scopes")
    return sortScopes(input, terms, executor)
  }
  if (Array.isArray(input.value)) {
    debug("Sorting array by unboxing")
    // Input is scoped array
    const scoped = input.value.map(item => {
      return input.clone({
        value: item
      })
    })
    return sortScopes(scoped, terms, executor)
  // Should probably rebox output so that `*|order(ordinal).ordinal` was illegal. Should only
  // be [] that performs unboxing. But we have tests documenting the non-reboxing behavior, so
  // we'll keep it for now. If we re-box you would have to do this instead: `*|order(ordinal)[].ordinal`
  // // Re-box sorted output
  // return input.clone({
  //   value: sorted.map(scope => scope.value)
  // })
  }
  // Item is a plain value, just pass it through
  debug("Plain value, sorting by pass-through, but in an array of scopes")
  return [input]
}
