/* eslint-disable max-depth */

function tokenizer(text) {
  const regexp = /(?:\s*)([^\s]+)(?:\s*)/y
  return {
    next() {
      const matches = text.match(regexp)
      if (!matches) {
        return null
      }
      return matches[1].toLowerCase()
    }
  }
}


/* eslint-disable no-param-reassign */
function matcherForTerm(term) {
  term = term.replace(/^\s+/g, '').replace(/\s+$/, '').toLowerCase()
  if (term[term.length - 1] == '*') {
    term = term.slice(0, -1)
    return (word) => {
      if (term.length > word.length) {
        return false
      }
      return word.slice(0, term.length) == term
    }
  }
  return (word) => word == term
}
/* eslint-enable no-param-reassign */

function matchString(source, terms) {
  if (typeof source !== 'string') {
    return null
  }
  const matchers = terms.map(matcherForTerm)
  const stream = tokenizer(source)
  let word = stream.next()
  const matched = {}
  while (word) {
    let allMatched = true
    for (let i = 0; i < matchers.length; i++) {
      if (matched[i]) continue
      if (matchers[i](word)) {
        matched[i] = true
        continue
      }
      allMatched = false
    }
    if (allMatched) {
      return true
    }
    word = stream.next()
  }
  return false
}

export default function match(source, terms) {
  if (Array.isArray(source)) {
    for (let i = 0; i < source.length; i++) {
      const result = matchString(source[i], terms)
      if (result) {
        return true
      }
      if (result === null) {
        return null
      }
    }
    return false
  }
  return matchString(source, terms)
}