const request = require('supertest')
const {close, createSession, getApp, getSessionCookie} = require('../helpers')
const getId = require('randomstring').generate

describe('fullStack', () => {
  const identityTemplate = {
    provider: 'google',
    providerId: 'xyzzy',
    name: 'Test User',
    email: 'test@example.com'
  }

  let app
  let scopedDataStore

  async function getScopedDataStore() {
    if (!scopedDataStore) {
      scopedDataStore = await app.services.dataStore.forDataset('saga-test')
    }
    return scopedDataStore
  }

  async function createUser(options = {}) {
    const userStore = app.services.userStore
    const identity = await userStore.createIdentity(identityTemplate)
    const user = await userStore.createUser(identity, 'saga-test', options)
    const sessionId = getId()
    await createSession(app, sessionId, identity._id)
    user.sessionId = sessionId
    return user
  }

  async function createDocument(doc) {
    const dataStore = await getScopedDataStore()
    const createdDocument = await dataStore
      .newTransaction({identity: '_system_'})
      .create(doc)
      .commit()
    return createdDocument.results[0].document
  }

  beforeAll(() => {
    app = getApp()
  })

  beforeEach(() => {
    jest.setTimeout(15000)
  })

  afterAll(() => close(app))

  afterEach(() =>
    Promise.all(
      ['saga-system-test', 'saga-test'].map(dsName =>
        app.services.dataStore.forDataset(dsName).then(ds => ds.truncate())
      )
    ))

  test('allows any logged in user to read venue', async () => {
    const unprivilegedUser = await createUser()
    const venue = await createDocument({
      _type: 'venue',
      name: 'journal-of-snah'
    })
    const query = `*[_id == "${venue._id}"]`
    await request(app)
      .get(`/v1/data/query/saga-test/?query=${encodeURIComponent(query)}`)
      .set('Cookie', getSessionCookie(app, unprivilegedUser))
      .expect(200)
      .expect(res => {
        const {result} = res.body
        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject(venue)
      })
  })

  test('grants article read access to submitter but not to unprivileged user', async () => {
    const submitter = await createUser()
    const unprivilegedUser = await createUser()
    const article = await createDocument({
      _type: 'article',
      title: 'Bubblegum',
      submitters: [{_type: 'reference', _ref: submitter._id}]
    })

    const query = '*[_type == "article"]'

    await request(app)
      .get(`/v1/data/query/saga-test/?query=${encodeURIComponent(query)}`)
      .set('Cookie', getSessionCookie(app, submitter))
      .expect(200)
      .expect(res => {
        const {result} = res.body
        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject(article)
      })

    await request(app)
      .get(`/v1/data/query/saga-test/?query=${encodeURIComponent(query)}`)
      .set('Cookie', getSessionCookie(app, unprivilegedUser))
      .expect(200)
      .expect(res => {
        const {result} = res.body
        expect(result).toHaveLength(0)
      })
  })

  test('grants comment update access to author', async () => {
    const author = await createUser()

    const comment = await createDocument({
      _type: 'comment',
      title: 'Stuff I chew on',
      author: {_type: 'reference', _ref: author._id}
    })
    const transactionId = getId()
    await request(app)
      .post('/v1/data/mutate/saga-test?returnIds=true')
      .set('Cookie', getSessionCookie(app, author))
      .send({
        mutations: [{patch: {id: comment._id, set: {title: 'Other stuff'}}}],
        transactionId
      })
      .expect(200, {
        transactionId,
        results: [{id: comment._id, operation: 'update'}]
      })
  })

  test('grants comment update access to venueEditor', async () => {
    const venueEditor = await createUser()

    const comment = await createDocument({
      _type: 'comment',
      title: 'Stuff I chew on'
    })
    await createDocument({
      _type: 'venue',
      name: 'journal-of-snah',
      editors: [{_type: 'reference', _ref: venueEditor._id}]
    })

    const transactionId = getId()
    await request(app)
      .post('/v1/data/mutate/saga-test?returnIds=true')
      .set('Cookie', getSessionCookie(app, venueEditor))
      .send({
        mutations: [{patch: {id: comment._id, set: {title: 'We could make pasta'}}}],
        transactionId
      })
      .expect(200, {
        transactionId,
        results: [{id: comment._id, operation: 'update'}]
      })
  })

  test('denies comment update access to the unprivileged', async () => {
    const unprivilegedUser = await createUser()

    const comment = await createDocument({
      _type: 'comment',
      title: 'Stuff I chew on'
    })

    const transactionId = getId()
    await request(app)
      .post('/v1/data/mutate/saga-test?returnIds=true')
      .set('Cookie', getSessionCookie(app, unprivilegedUser))
      .send({
        mutations: [{patch: {id: comment._id, set: {title: 'LOLZ'}}}],
        transactionId
      })
      .expect(403)
      .expect(result => {
        expect(result.body).toMatchObject({error: 'Forbidden', type: 'mutationError'})
      })
  })

  test('grants article delete access to track editor', async () => {
    const trackEditor = await createUser()

    const track = await createDocument({
      _id: 'TRACKID1234',
      _type: 'track',
      editors: [{_type: 'reference', _ref: trackEditor._id}]
    })

    const article = await createDocument({
      _id: 'ARTICLEID1234',
      _type: 'article',
      track: {_type: 'reference', _ref: track._id}
    })

    const transactionId = getId()
    await request(app)
      .post('/v1/data/mutate/saga-test?returnIds=true')
      .set('Cookie', getSessionCookie(app, trackEditor))
      .send({mutations: [{delete: {id: article._id}}], transactionId})
      .expect(200, {
        transactionId,
        results: [{id: article._id, operation: 'delete'}]
      })
  })

  test('grants article create access to venue editor', async () => {
    const venueEditor = await createUser()
    await createDocument({
      _type: 'venue',
      editors: [{_type: 'reference', _ref: venueEditor._id}]
    })

    const article = {
      _id: 'ARTICLEID1234',
      _type: 'article'
    }

    const transactionId = getId()
    await request(app)
      .post('/v1/data/mutate/saga-test?returnIds=true')
      .set('Cookie', getSessionCookie(app, venueEditor))
      .send({mutations: [{create: article}], transactionId})
      .expect(200, {
        transactionId,
        results: [{id: article._id, operation: 'create'}]
      })
  })

  test('grants user access to update self', async () => {
    const user = await createUser()
    const transactionId = getId()
    await request(app)
      .post('/v1/data/mutate/saga-test?returnIds=true')
      .set('Cookie', getSessionCookie(app, user))
      .send({
        mutations: [{patch: {id: user._id, set: {name: 'Doctor Newname'}}}],
        transactionId
      })
      .expect(200, {
        transactionId,
        results: [{id: user._id, operation: 'update'}]
      })
  })

  test('denies user access to update another user', async () => {
    const user = await createUser()
    const otherUser = await createUser()
    const transactionId = getId()
    await request(app)
      .post('/v1/data/mutate/saga-test?returnIds=true')
      .set('Cookie', getSessionCookie(app, user))
      .send({
        mutations: [{patch: {id: otherUser._id, set: {name: 'Doctor Newname'}}}],
        transactionId
      })
      .expect(403)
      .expect(result => {
        expect(result.body).toMatchObject({error: 'Forbidden', type: 'mutationError'})
      })
  })

  test('grants admin access to promote another user to admin', async () => {
    const admin = await createUser({isAdmin: true})
    const otherUser = await createUser()
    const transactionId = getId()
    await request(app)
      .post('/v1/data/mutate/saga-test?returnIds=true')
      .set('Cookie', getSessionCookie(app, admin))
      .send({
        mutations: [{patch: {id: otherUser._id, set: {isAdmin: true}}}],
        transactionId
      })
      .expect(200, {
        transactionId,
        results: [{id: otherUser._id, operation: 'update'}]
      })
  })

  test('denies user ability to promote herself to admin', async () => {
    const user = await createUser()
    const transactionId = getId()
    await request(app)
      .post('/v1/data/mutate/saga-test?returnIds=true')
      .set('Cookie', getSessionCookie(app, user))
      .send({
        mutations: [{patch: {id: user._id, set: {isAdmin: true}}}],
        transactionId
      })
      .expect(403)
      .expect(result => {
        expect(result.body).toMatchObject({error: 'Forbidden', type: 'mutationError'})
      })
  })
})
