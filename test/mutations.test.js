const request = require('supertest')
const uuid = require('uuid/v4')
const promiseEvent = require('p-event')
const {close, getApp, createAdminUser, getSessionCookie} = require('./helpers')

describe('mutations', () => {
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

  test('can create and fetch document', async () => {
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
        mutations: [{
          create: doc
        }],
        transactionId
      })
      .expect(200, {
        transactionId,
        results: [{
          id: doc._id,
          operation: 'create'
        }]
      })

    await request(app)
      .get(`/v1/data/doc/saga-test/${doc._id}`)
      .set('Cookie', getSessionCookie(app, adminUser))
      .expect(200)
      .expect(res => {
        expect(res.body.documents).toHaveLength(1)
        expect(res.body.documents[0]).toMatchObject(doc)
      })
  })

  test('can create and fetch document using bearer token', async () => {
    const doc = {
      _id: 'foo',
      _type: 'test',
      random: uuid()
    }
    const transactionId = uuid()
    await request(app)
      .post('/v1/data/mutate/saga-test?returnIds=true')
      .set('Authorization', `Bearer ${getSessionCookie(app, adminUser, true)}`)
      .send({
        mutations: [{
          create: doc
        }],
        transactionId
      })
      .expect(200, {
        transactionId,
        results: [{
          id: doc._id,
          operation: 'create'
        }]
      })

    await request(app)
      .get(`/v1/data/doc/saga-test/${doc._id}`)
      .set('Authorization', `Bearer ${getSessionCookie(app, adminUser, true)}`)
      .expect(200)
      .expect(res => {
        expect(res.body.documents).toHaveLength(1)
        expect(res.body.documents[0]).toMatchObject(doc)
      })
  })

  test('can create, replace and delete document', async () => {
    let random = uuid()
    const doc = {
      _id: uuid(),
      _type: 'test',
      random
    }
    const transactionId = uuid()

    // Create
    await request(app)
      .post('/v1/data/mutate/saga-test?returnIds=true')
      .set('Cookie', getSessionCookie(app, adminUser))
      .send({
        mutations: [{
          create: doc
        }],
        transactionId
      })
      .expect(200, {
        transactionId,
        results: [{
          id: doc._id,
          operation: 'create'
        }]
      })

    await request(app)
      .get(`/v1/data/doc/saga-test/${doc._id}`)
      .set('Cookie', getSessionCookie(app, adminUser))
      .expect(200)
      .expect(res => {
        expect(res.body.documents).toHaveLength(1)
        expect(res.body.documents[0]).toMatchObject(doc)
      })

    // Replace
    random = uuid()
    await request(app)
      .post('/v1/data/mutate/saga-test?returnIds=true')
      .set('Cookie', getSessionCookie(app, adminUser))
      .send({
        mutations: [{
          createOrReplace: {
            ...doc,
            random
          }
        }],
        transactionId
      })
      .expect(200, {
        transactionId,
        results: [{
          id: doc._id,
          operation: 'update'
        }]
      })

    await request(app)
      .get(`/v1/data/doc/saga-test/${doc._id}`)
      .set('Cookie', getSessionCookie(app, adminUser))
      .expect(200)
      .expect(res => {
        expect(res.body.documents).toHaveLength(1)
        expect(res.body.documents[0]).toMatchObject({
          ...doc,
          random
        })
      })

    // Delete
    await request(app)
      .post('/v1/data/mutate/saga-test?returnIds=true')
      .set('Cookie', getSessionCookie(app, adminUser))
      .send({
        mutations: [{
          delete: {
            id: doc._id
          }
        }],
        transactionId
      })
      .expect(200, {
        transactionId,
        results: [{
          id: doc._id,
          operation: 'delete'
        }]
      })

    await request(app)
      .get(`/v1/data/doc/saga-test/${doc._id}`)
      .set('Cookie', getSessionCookie(app, adminUser))
      .expect(200)
      .expect(res => {
        expect(res.body.documents).toHaveLength(0)
      })
  })

  test('can use createOrReplace to both create and replace a document', async () => {
    let random = uuid()
    const doc = {
      _id: uuid(),
      _type: 'test',
      random
    }
    const transactionId = uuid()

    // Create
    await request(app)
      .post('/v1/data/mutate/saga-test?returnIds=true')
      .set('Cookie', getSessionCookie(app, adminUser))
      .send({
        mutations: [{
          createOrReplace: doc
        }],
        transactionId
      })
      .expect(200, {
        transactionId,
        results: [{
          id: doc._id,
          operation: 'create'
        }]
      })

    await request(app)
      .get(`/v1/data/doc/saga-test/${doc._id}`)
      .set('Cookie', getSessionCookie(app, adminUser))
      .expect(200)
      .expect(res => {
        expect(res.body.documents).toHaveLength(1) // Create
        expect(res.body.documents[0]).toMatchObject(doc)
      })

    // Replace
    random = uuid()
    await request(app)
      .post('/v1/data/mutate/saga-test?returnIds=true')
      .set('Cookie', getSessionCookie(app, adminUser))
      .send({
        mutations: [{
          createOrReplace: {
            ...doc,
            random
          }
        }],
        transactionId
      })
      .expect(200, {
        transactionId,
        results: [{
          id: doc._id,
          operation: 'update'
        }]
      })

    await request(app)
      .get(`/v1/data/doc/saga-test/${doc._id}`)
      .set('Cookie', getSessionCookie(app, adminUser))
      .expect(200)
      .expect(res => {
        expect(res.body.documents).toHaveLength(1) // Replace
        expect(res.body.documents[0]).toMatchObject({
          ...doc,
          random
        })
      })
  })

  test('can create and patch document', async () => {
    const doc = {
      _id: 'datpatch',
      _type: 'test',
      random: uuid(),
      counter: 1
    }
    const transactionId = uuid()
    await request(app)
      .post('/v1/data/mutate/saga-test?returnIds=true')
      .set('Cookie', getSessionCookie(app, adminUser))
      .send({
        mutations: [{
          create: doc
        }],
        transactionId
      })
      .expect(200, {
        transactionId,
        results: [{
          id: doc._id,
          operation: 'create'
        }]
      })

    const random = uuid()
    await request(app)
      .post('/v1/data/mutate/saga-test?returnIds=true')
      .set('Cookie', getSessionCookie(app, adminUser))
      .send({
        mutations: [{
          patch: {
            id: doc._id,
            set: {
              random
            },
            inc: {
              counter: 1
            }
          }
        }],
        transactionId
      })
      .expect(200, {
        transactionId,
        results: [{
          id: doc._id,
          operation: 'update'
        }]
      })

    await request(app)
      .get(`/v1/data/doc/saga-test/${doc._id}`)
      .set('Cookie', getSessionCookie(app, adminUser))
      .expect(200)
      .expect(res => {
        expect(res.body.documents).toHaveLength(1)
        expect(res.body.documents[0]).toMatchObject({
          ...doc,
          random,
          counter: doc.counter + 1
        })
      })
  })

  test('can create and patch document with multiple patches in one transaction', async () => {
    const doc = {
      _id: 'datpatch2',
      _type: 'test',
      random: uuid(),
      counter: 1
    }
    const transactionId = uuid()
    await request(app)
      .post('/v1/data/mutate/saga-test?returnIds=true')
      .set('Cookie', getSessionCookie(app, adminUser))
      .send({
        mutations: [{
          create: doc
        }],
        transactionId
      })
      .expect(200, {
        transactionId,
        results: [{
          id: doc._id,
          operation: 'create'
        }]
      })

    const random = uuid()
    await request(app)
      .post('/v1/data/mutate/saga-test?returnIds=true')
      .set('Cookie', getSessionCookie(app, adminUser))
      .send({
        mutations: [{
          patch: {
            id: doc._id,
            set: {
              random
            },
            inc: {
              counter: 1
            }
          }
        }, {
          patch: {
            id: doc._id,
            inc: {
              counter: 1
            }
          }
        }],
        transactionId
      })
      .expect(200, {
        transactionId,
        results: [{
          id: doc._id,
          operation: 'update'
        }]
      })

    await request(app)
      .get(`/v1/data/doc/saga-test/${doc._id}`)
      .set('Cookie', getSessionCookie(app, adminUser))
      .expect(200)
      .expect(res => {
        expect(res.body.documents).toHaveLength(1)
        expect(res.body.documents[0]).toMatchObject({
          ...doc,
          random,
          counter: doc.counter + 2
        })
      })
  })
  test('performs mutations in the order they are received', async () => {
    const doc = {
      _id: 'target-race',
      _type: 'test',
      counter: 1
    }
    await request(app)
      .post('/v1/data/mutate/saga-test?returnIds=true')
      .set('Cookie', getSessionCookie(app, adminUser))
      .send({
        mutations: [{
          create: doc
        }]
      })
      .expect(200)

    const ops = []
    for (let i = 0; i <= 20; i++) {
      ops.push(
        request(app)
          .post('/v1/data/mutate/saga-test?returnIds=true&returnDocuments=true')
          .set('Cookie', getSessionCookie(app, adminUser))
          .send({
            mutations: [{
              patch: {
                id: doc._id,
                set: {
                  counter: i
                }
              }
            }]
          })
          .expect(200)
          .then(res => expect(res.body.results[0]).toHaveProperty('document._id'))
      )

      // eslint-disable-next-line no-await-in-loop
      await promiseEvent(app.services.dataStore, 'queue-mutation')
    }

    await Promise.all(ops)

    await request(app)
      .get(`/v1/data/doc/saga-test/${doc._id}`)
      .set('Cookie', getSessionCookie(app, adminUser))
      .expect(200)
      .expect(res => {
        expect(res.body.documents).toHaveLength(1)
        expect(res.body.documents[0]).toMatchObject({
          ...doc,
          counter: 20
        })
      })
  })

  test('generates document ID if none is given', async () => {
    const doc = {
      _type: 'test',
      random: uuid()
    }
    await request(app)
      .post('/v1/data/mutate/saga-test?returnIds=true')
      .set('Cookie', getSessionCookie(app, adminUser))
      .send({
        mutations: [{
          create: doc
        }]
      })
      .expect(200)
      .then(res => {
        expect(res.body.results[0]).toHaveProperty('id')
        doc._id = res.body.results[0].id
      })

    await request(app)
      .get(`/v1/data/doc/saga-test/${doc._id}`)
      .set('Cookie', getSessionCookie(app, adminUser))
      .expect(200)
      .expect(res => {
        expect(res.body.documents).toHaveLength(1)
        expect(res.body.documents[0]).toMatchObject(doc)
      })
  })

  test('generates document ID if prefix given', async () => {
    const doc = {
      _id: 'test.',
      _type: 'test',
      random: uuid()
    }
    await request(app)
      .post('/v1/data/mutate/saga-test?returnIds=true')
      .set('Cookie', getSessionCookie(app, adminUser))
      .send({
        mutations: [{
          create: doc
        }]
      })
      .expect(200)
      .then(res => {
        expect(res.body.results[0]).toHaveProperty('id')
        doc._id = res.body.results[0].id
        expect(doc._id).toMatch(/^test\.[a-zA-Z0-9]{16,}$/)
      })

    await request(app)
      .get(`/v1/data/doc/saga-test/${doc._id}`)
      .set('Cookie', getSessionCookie(app, adminUser))
      .expect(200)
      .expect(res => {
        expect(res.body.documents).toHaveLength(1)
        expect(res.body.documents[0]).toMatchObject(doc)
      })
  })

  test('can create and patch document in the same transaction', async () => {
    const create = {
      _id: 'createpatch',
      _type: 'test',
      counter: 1
    }
    const patch = {
      id: 'createpatch',
      set: {
        counter: 2
      }
    }
    const transactionId = uuid()
    await request(app)
      .post('/v1/data/mutate/saga-test?returnIds=true')
      .set('Cookie', getSessionCookie(app, adminUser))
      .send({
        mutations: [{
          create
        }, {
          patch
        }],
        transactionId
      })
      .expect(200, {
        transactionId,
        results: [{
          id: create._id,
          operation: 'create'
        }, {
          id: create._id,
          operation: 'update'
        }]
      })

    await request(app)
      .get(`/v1/data/doc/saga-test/${create._id}`)
      .set('Cookie', getSessionCookie(app, adminUser))
      .expect(200)
      .expect(res => {
        expect(res.body.documents).toHaveLength(1)
        expect(res.body.documents[0]).toMatchObject({
          ...create,
          counter: 2
        })
      })
  })

  test('can create documents with references to existing documents', async () => {
    const target = {
      _id: 'target',
      _type: 'test',
      is: 'target'
    }
    const source = {
      _id: 'source',
      _type: 'test',
      is: 'source',
      target: {
        _ref: 'target'
      }
    }
    await request(app)
      .post('/v1/data/mutate/saga-test?returnIds=true')
      .set('Cookie', getSessionCookie(app, adminUser))
      .send({
        mutations: [{
          create: target
        }]
      })
      .expect(200)

    await request(app)
      .post('/v1/data/mutate/saga-test?returnIds=true')
      .set('Cookie', getSessionCookie(app, adminUser))
      .send({
        mutations: [{
          create: source
        }]
      })
      .expect(200)

    await request(app)
      .get(`/v1/data/doc/saga-test/${source._id}`)
      .set('Cookie', getSessionCookie(app, adminUser))
      .expect(200)
      .expect(res => {
        expect(res.body.documents).toHaveLength(1)
        expect(res.body.documents[0]).toMatchObject(source)
        expect(res.body.documents[0]).not.toHaveProperty('@refs')
      })

    await request(app)
      .get(`/v1/data/query/saga-test?query=${encodeURIComponent('*[references("target")]')}`)
      .set('Cookie', getSessionCookie(app, adminUser))
      .expect(200)
      .expect(res => {
        expect(res.body.result).toHaveLength(1)
        expect(res.body.result[0]).toMatchObject(source)
        expect(res.body.result[0]).not.toHaveProperty('@refs')
      })
  })

  test('cannot create documents with references to non-existing documents', async () => {
    const source = {
      _id: 'source',
      _type: 'test',
      is: 'source',
      target: {
        _ref: 'target404'
      }
    }
    await request(app)
      .post('/v1/data/mutate/saga-test?returnIds=true')
      .set('Cookie', getSessionCookie(app, adminUser))
      .send({
        mutations: [{
          create: source
        }]
      })
      .expect(409)
      .then(res => {
        expect(res.body).toMatchObject({
          statusCode: 409,
          error: 'Conflict',
          description: 'The mutation(s) failed: Document "source" references non-existent document "target404"',
          type: 'mutationError'
        })

        expect(res.body.items).toHaveLength(1)
      })
  })

  test('cannot delete documents with strong references', async () => {
    const mutations = [
      {
        create: {
          _id: 'ref-foo',
          _type: 'test'
        }
      },
      {
        create: {
          _id: 'ref-bar',
          _type: 'test',
          parent: {
            _ref: 'ref-foo'
          }
        }
      },
      {
        create: {
          _id: 'ref-baz',
          _type: 'test',
          refs: [{
            _ref: 'ref-foo'
          }, {
            _ref: 'ref-bar'
          }]
        }
      }
    ]

    await request(app)
      .post('/v1/data/mutate/saga-test')
      .set('Cookie', getSessionCookie(app, adminUser))
      .send({
        mutations
      })
      .expect(200)

    await request(app)
      .post('/v1/data/mutate/saga-test?returnIds=true')
      .set('Cookie', getSessionCookie(app, adminUser))
      .send({
        mutations: [{
          delete: {
            id: 'ref-foo'
          }
        }]
      })
      .expect(409)
      .then(res => {
        expect(res.body).toMatchObject({
          statusCode: 409,
          error: 'Conflict',
          description: 'The mutation(s) failed: Document "ref-foo" cannot be deleted as there are references to it from "ref-bar"',
          type: 'mutationError'
        })

        expect(res.body.items).toHaveLength(1)
      })
  })
})
