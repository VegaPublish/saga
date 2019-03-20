// Converts a scope or an array of scopes to a plain value
export function asPlainValue(input) {
  if (!input) {
    return input
  }
  if (Array.isArray(input)) {
    return input.map(item => item.value)
  }
  return input.value
}
