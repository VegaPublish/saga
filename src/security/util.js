const performQuery = async (query, queryParams, scopedDataStore) => {
  try {
    const results = await scopedDataStore.fetch(query, queryParams)
    return typeof results === 'undefined' ? [] : results
  } catch (err) {
    console.error('☠ performQuery failed', query, queryParams, err) // eslint-disable-line no-console
    throw err
  }
}

const getScopedDataStore = async (dataStore, venueId) => {
  const store = await (venueId ? dataStore.forDataset(venueId) : dataStore.connect())
  return store
}

const fetchCurrentUser = async (userId, dataStore, venueId) => {
  const query = `*[_type=="user" && _id == $userId][0]{...}`
  const scopedDataStore = await getScopedDataStore(dataStore, venueId)
  const user = await performQuery(query, {userId: userId}, scopedDataStore)
  return user
}

module.exports = {
  fetchCurrentUser,
  performQuery
}
