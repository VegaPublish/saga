import query from '../src/vega-ql/query'

describe('fetch specs', () => {
  it('makes a decent standard spec for a simple query', async () => {
    const mockFetcher = jest.fn()
    mockFetcher.mockReturnValueOnce([])
    await query({
      source: "*[a == 1][1...3]",
      params: {},
      fetcher: mockFetcher
    }).then(result => {
      const fetchSpec = mockFetcher.mock.calls[0][0]
      expect(fetchSpec.start).toBe(1)
      expect(fetchSpec.end).toBe(3)
      return result
    })
  })
})
