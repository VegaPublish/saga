const request = require('supertest')
const uuid = require('uuid/v4')
const {sortBy} = require('lodash')
const {close, getApp, createAdminUser, getSessionCookie} = require('./helpers')

describe('query', () => {
  let app
  let adminUser

  beforeAll(() => {
    app = getApp()
  })

  beforeEach(async () => {
    jest.setTimeout(15000)

    const dataStore = app.services.dataStore
    await Promise.all([
      dataStore.forDataset('saga-test').then(ds => ds.truncate()),
      dataStore.forDataset('saga-system-test').then(ds => ds.truncate())
    ])

    adminUser = await createAdminUser(app)
  })

  afterAll(() => close(app))

  test('can create and query for document', async () => {
    const doc = {
      _id: 'foo',
      _type: 'test',
      random: uuid()
    }
    const transactionId = uuid()
    await request(app)
      .post('/v1/data/mutate/saga-test?returnIds=true')
      .set('Cookie', getSessionCookie(app, adminUser))
      .send({
        mutations: [
          {
            create: doc
          }
        ],
        transactionId
      })
      .expect(200, {
        transactionId,
        results: [
          {
            id: doc._id,
            operation: 'create'
          }
        ]
      })

    await request(app)
      .get(`/v1/data/query/saga-test/?query=${encodeURIComponent(`*[_id == "${doc._id}"]`)}`)
      .set('Cookie', getSessionCookie(app, adminUser))
      .expect(200)
      .expect(res => {
        expect(res.body.result).toHaveLength(1)
        expect(res.body.result[0]).toMatchObject(doc)
      })
  })

  test('can query with joins', async () => {
    const bar = {
      _id: 'bar',
      _type: 'test',
      isBar: true
    }
    const foo = {
      _id: 'foo',
      _type: 'test',
      isBar: false,
      bar: {
        _ref: 'bar'
      }
    }
    const transactionId = uuid()
    await request(app)
      .post('/v1/data/mutate/saga-test?returnIds=true')
      .set('Cookie', getSessionCookie(app, adminUser))
      .send({
        mutations: [
          {
            create: bar
          },
          {
            create: foo
          }
        ],
        transactionId
      })
      .expect(200, {
        transactionId,
        results: [
          {
            id: bar._id,
            operation: 'create'
          },
          {
            id: foo._id,
            operation: 'create'
          }
        ]
      })

    await request(app)
      .get(
        `/v1/data/query/saga-test/?query=${encodeURIComponent(
          `*[_id == "foo"]{isBar, "bar": bar->{isBar}}`
        )}`
      )
      .set('Cookie', getSessionCookie(app, adminUser))
      .expect(200)
      .expect(res => {
        expect(res.body.result).toHaveLength(1)
        expect(res.body.result[0]).toMatchObject({
          isBar: false,
          bar: {
            isBar: true
          }
        })
      })

    await request(app)
      .get(`/v1/data/query/saga-test/?query=${encodeURIComponent('*[references("bar")]{_id}')}`)
      .set('Cookie', getSessionCookie(app, adminUser))
      .expect(200)
      .expect(res => {
        expect(res.body.result).toHaveLength(1)
        expect(res.body.result[0]).toMatchObject({
          _id: 'foo'
        })
      })
  })

  test('can query with array joins', async () => {
    const baz1 = {
      _id: 'baz1',
      _type: 'test',
      isBaz: true
    }
    const baz2 = {
      _id: 'baz2',
      _type: 'test',
      isBaz: true
    }
    const bar1 = {
      _id: 'bar1',
      _type: 'test',
      isBar: true,
      bazs: [
        {
          _ref: 'baz1'
        },
        {
          _ref: 'baz2'
        }
      ]
    }
    const bar2 = {
      _id: 'bar2',
      _type: 'test',
      isBar: true
    }
    const foo = {
      _id: 'foo',
      _type: 'test',
      isBar: false,
      refs: [
        {
          _ref: 'bar1'
        },
        {
          _ref: 'bar2'
        }
      ]
    }
    await request(app)
      .post('/v1/data/mutate/saga-test?returnIds=true')
      .set('Cookie', getSessionCookie(app, adminUser))
      .send({
        mutations: [baz1, baz2, bar1, bar2, foo].map(create => ({
          create
        }))
      })
      .expect(200)

    await request(app)
      .get(
        `/v1/data/query/saga-test/?query=${encodeURIComponent(
          `*[_id == "foo"]{isBar, "refs": refs[]->{
            _id, isBar, "bazs": bazs[]->{_id, isBaz}
          }}`
        )}`
      )
      .set('Cookie', getSessionCookie(app, adminUser))
      .expect(200)
      .expect(res => {
        expect(res.body.result).toHaveLength(1)
        expect(res.body.result[0]).toMatchObject({
          isBar: false,
          refs: [
            {
              _id: 'bar1',
              isBar: true,
              bazs: [
                {
                  _id: 'baz1',
                  isBaz: true
                },
                {
                  _id: 'baz2',
                  isBaz: true
                }
              ]
            },
            {
              _id: 'bar2',
              isBar: true
            }
          ]
        })
      })

    await request(app)
      .get(`/v1/data/query/saga-test/?query=${encodeURIComponent('*[references("bar1")]{_id}')}`)
      .set('Cookie', getSessionCookie(app, adminUser))
      .expect(200)
      .expect(res => {
        expect(res.body.result).toHaveLength(1)
        expect(res.body.result[0]).toMatchObject({
          _id: 'foo'
        })
      })
  })

  test('can query ordering, limit and offset', async () => {
    const documents = [
      {
        _type: 'test',
        i: 88
      },
      {
        _type: 'test',
        i: 3
      },
      {
        _type: 'test',
        i: 1
      },
      {
        _type: 'test',
        i: 1337
      },
      {
        _type: 'test',
        i: 0.55
      },
      {
        _type: 'test',
        i: 16
      },
      {
        _type: 'test',
        i: 0.33
      },
      {
        _type: 'test',
        i: 16
      }
    ]

    const sorted = sortBy(documents, 'i')
      .slice(1, 6)
      .map(doc => doc.i)

    await request(app)
      .post('/v1/data/mutate/saga-test?returnIds=true')
      .set('Cookie', getSessionCookie(app, adminUser))
      .send({
        mutations: documents.map(create => ({
          create
        }))
      })
      .expect(200)

    await request(app)
      .get(
        `/v1/data/query/saga-test/?query=${encodeURIComponent(
          `*[_type == "test"] | order (i asc) [1...6]`
        )}`
      )
      .set('Cookie', getSessionCookie(app, adminUser))
      .expect(200)
      .expect(res => {
        expect(res.body.result).toHaveLength(sorted.length)
        expect(res.body.result.map(doc => doc.i)).toEqual(sorted)
      })
  })

  test('can query with coalesce/ordering', async () => {
    const documents = [
      {
        _id: 'a1',
        _type: 'test',
        i: 88
      },
      {
        _id: 'a2',
        _type: 'test',
        i: 0.66
      },
      {
        _id: 'a3',
        _type: 'test',
        i: 1337
      },
      {
        _id: 'a4',
        _type: 'test'
      },
      {
        _id: 'a5',
        _type: 'test',
        i: 17
      },
      {
        _id: 'a6',
        _type: 'test',
        i: 0.33
      },
      {
        _id: 'a7',
        _type: 'test',
        i: 105
      }
    ]

    const sorted = sortBy(
      documents.map(doc =>
        Object.assign(
          {
            i: 100
          },
          doc
        )
      ),
      'i'
    )
      .slice(1, 6)
      .map(doc => doc.i)

    await request(app)
      .post('/v1/data/mutate/saga-test?returnIds=true')
      .set('Cookie', getSessionCookie(app, adminUser))
      .send({
        mutations: documents.map(create => ({
          create
        }))
      })
      .expect(200)

    await request(app)
      .get(
        `/v1/data/query/saga-test/?query=${encodeURIComponent(
          `*[_type == "test"] | order(coalesce(i,100) asc) [1...6]`
        )}`
      )
      .set('Cookie', getSessionCookie(app, adminUser))
      .expect(200)
      .expect(res => {
        expect(res.body.result).toHaveLength(sorted.length)
        expect(res.body.result.map(doc => doc.i)).toEqual([0.66, 17, 88, undefined, 105])
      })
  })

  test('can use array membership clause', async () => {
    const documents = [
      {
        _id: 'a1',
        _type: 'author',
        name: 'Espen'
      },
      {
        _id: 'a2',
        _type: 'author',
        name: 'Thomas'
      },
      {
        _id: 'a3',
        _type: 'author',
        name: 'Bjørge'
      },
      {
        _id: 'd1',
        _type: 'doc',
        authors: [
          {
            _ref: 'a1'
          },
          {
            _ref: 'a2'
          }
        ]
      },
      {
        _id: 'd2',
        _type: 'doc',
        authors: []
      }
    ]

    await request(app)
      .post('/v1/data/mutate/saga-test?returnIds=true')
      .set('Cookie', getSessionCookie(app, adminUser))
      .send({mutations: documents.map(create => ({create}))})
      .expect(200)

    await request(app)
      .get(`/v1/data/query/saga-test/?query=${encodeURIComponent(`*["a1" in authors[]._ref]`)}`)
      .set('Cookie', getSessionCookie(app, adminUser))
      .expect(200)
      .expect(res => {
        expect(res.body.result).toHaveLength(1)
        expect(res.body.result[0]).toMatchObject(documents[3])
      })
  })
})
