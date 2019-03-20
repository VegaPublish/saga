import { FunctionCall, SortDirection, Ordering } from './operations'

// Creates a function call, potentially rewriting it to another, more specific operation if applicable
export function newFunctionCall(name, args) {
  switch (name) {
    case 'order':
      return newOrdering(args)
    default:
      return new FunctionCall(name, args)
  }
}

function newOrdering(args) {
  const terms = args.map(arg => {
    if (arg.op != 'sortDirection') {
      return new SortDirection({
        expression: arg,
        direction: 'asc'
      })
    }
    return arg
  })
  return new Ordering(terms)
}