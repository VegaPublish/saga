const {close, getApp} = require('../helpers')
const UserCapabilityDiviner = require('../../src/security/UserCapabilityDiviner')

describe('userCapabilityDiviner', () => {
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

  async function capabilitiesForUser(userId) {
    const ucd = new UserCapabilityDiviner(userId, app.services.dataStore, 'saga-test')
    const capabilities = await ucd.runAll()
    return capabilities
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

  test('recognizes an unprivileged user', async () => {
    const unprivilegedUser = await createUser()
    await createDocument({
      _type: 'venue',
      name: 'journal-of-snah'
    })
    const capabilities = await capabilitiesForUser(unprivilegedUser._id)

    expect(capabilities).toMatchObject({
      isEditorInVenue: [false]
    })
  })

  test('recognizes a venue editor', async () => {
    const venueEditor = await createUser()
    await createDocument({
      _type: 'venue',
      name: 'journal-of-snah',
      editors: [{_type: 'reference', _ref: venueEditor._id}]
    })
    const capabilities = await capabilitiesForUser(venueEditor._id)
    expect(capabilities).toMatchObject({
      isEditorInVenue: [true]
    })
  })

  test('recognizes a venue admin', async () => {
    const admin = await createUser({isAdmin: true})
    const capabilities = await capabilitiesForUser(admin._id)
    expect(capabilities).toMatchObject({
      isAdminUser: [true]
    })
  })

  test('recognizes article track editor', async () => {
    const trackEditor = await createUser()

    const track = await createDocument({
      _id: 'TRACKID1234',
      _type: 'track',
      editors: [{_type: 'reference', _ref: trackEditor._id}]
    })

    await createDocument({
      _type: 'article',
      title: 'Bubblegum',
      track: {_type: 'reference', _ref: track._id}
    })

    const capabilities = await capabilitiesForUser(trackEditor._id)
    expect(capabilities).toMatchObject({isEditorInTrackWithArticle: ['track._ref', [track._id]]})
  })

  test('recognizes issue editor', async () => {
    const issueEditor = await createUser()

    const article = await createDocument({
      _id: 'ARTICLEID1234',
      _type: 'article'
    })

    await createDocument({
      _id: 'ISSUEID1234',
      _type: 'issue',
      content: [
        {
          _type: 'section',
          title: 'A Section',
          articles: [{_type: 'reference', _ref: 'ARTICLEID1234'}]
        }
      ],
      editors: [{_type: 'reference', _ref: issueEditor._id}]
    })

    const capabilities = await capabilitiesForUser(issueEditor._id)
    expect(capabilities).toMatchObject({isEditorInIssueWithArticle: ['_id', [article._id]]})
  })

  test('recognizes article submitter', async () => {
    const submitter = await createUser()

    const article = await createDocument({
      _id: 'ARTICLEID1234',
      _type: 'article',
      submitters: [{_type: 'reference', _ref: submitter._id}]
    })

    const capabilities = await capabilitiesForUser(submitter._id)
    expect(capabilities).toMatchObject({isSubmitterInArticle: ['_id', [article._id]]})
  })

  test('recognizes comment owner', async () => {
    const creator = await createUser()

    await createDocument({
      _id: 'COMMENTID1234',
      _type: 'comment',
      author: {_type: 'reference', _ref: creator._id}
    })

    const capabilities = await capabilitiesForUser(creator._id)
    expect(capabilities).toMatchObject({isAuthorInComment: ['author._ref', [creator._id]]})
  })

  test('recognizes track editors in comment', async () => {
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

    await createDocument({
      _id: 'COMMENTID1234',
      _type: 'comment',
      subject: {_type: 'reference', _ref: article._id}
    })

    const capabilities = await capabilitiesForUser(trackEditor._id)
    expect(capabilities).toMatchObject({
      isEditorInTrackWithArticleWithComment: ['subject._ref', [article._id]]
    })
  })

  test('recognizes issue editors in comment on article', async () => {
    const issueEditor = await createUser()

    const article = await createDocument({
      _id: 'ARTICLEID1234',
      _type: 'article'
    })

    const anotherArticle = await createDocument({
      _id: 'ARTICLEID12345',
      _type: 'article'
    })

    await createDocument({
      _id: 'ARTICLEID123456',
      _type: 'article'
    })

    await createDocument({
      _id: 'ISSUEID1234',
      _type: 'issue',
      content: [
        {
          _type: 'section',
          title: 'A Section',
          articles: [
            {_type: 'reference', _ref: article._id},
            {_type: 'reference', _ref: anotherArticle._id}
          ]
        }
      ],
      editors: [{_type: 'reference', _ref: issueEditor._id}]
    })

    await createDocument({
      _id: 'COMMENTID1234',
      _type: 'comment',
      subject: {_type: 'reference', _ref: article._id}
    })

    const capabilities = await capabilitiesForUser(issueEditor._id)
    expect(capabilities).toMatchObject({
      isEditorInIssueWithArticleWithComment: ['subject._ref', ['ARTICLEID1234', 'ARTICLEID12345']]
    })
  })

  test('recognizes issue editors in comment on issue', async () => {
    const issueEditor = await createUser()

    const issue = await createDocument({
      _id: 'ISSUEID1234',
      _type: 'issue',
      content: [
        {
          _type: 'section',
          title: 'A Section'
        }
      ],
      editors: [{_type: 'reference', _ref: issueEditor._id}]
    })

    await createDocument({
      _id: 'COMMENTID1234',
      _type: 'comment',
      subject: {_type: 'reference', _ref: issue._id}
    })

    const capabilities = await capabilitiesForUser(issueEditor._id)
    expect(capabilities).toMatchObject({
      isEditorInIssueWithComment: ['subject._ref', ['ISSUEID1234']]
    })
  })

  test('recognizes issue editors in reviewProcess', async () => {
    const issueEditor = await createUser()

    const article = await createDocument({
      _id: 'ARTICLEID1234',
      _type: 'article'
    })

    await createDocument({
      _id: 'ISSUEID1234',
      _type: 'issue',
      content: [
        {
          _type: 'section',
          title: 'A Section',
          articles: [{_type: 'reference', _ref: 'ARTICLEID1234'}]
        }
      ],
      editors: [{_type: 'reference', _ref: issueEditor._id}]
    })

    await createDocument({
      _id: 'REVIEWPROCESSID1234',
      _type: 'reviewProcess',
      article: {_type: 'reference', _ref: 'ARTICLEID1234'}
    })

    const capabilities = await capabilitiesForUser(issueEditor._id)
    expect(capabilities).toMatchObject({
      isEditorInIssueWithArticleInReviewProcess: ['article._ref', [article._id]]
    })
  })

  test('recognizes track editors in reviewProcess', async () => {
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

    await createDocument({
      _id: 'REVIEWPROCESSID1234',
      _type: 'reviewProcess',
      article: {_type: 'reference', _ref: 'ARTICLEID1234'}
    })

    const capabilities = await capabilitiesForUser(trackEditor._id)
    expect(capabilities).toMatchObject({
      isEditorInTrackWithArticleInReviewProcess: ['article._ref', [article._id]]
    })
  })

  test('recognizes track editor in reviewItem', async () => {
    const trackEditor = await createUser()

    const track = await createDocument({
      _id: 'TRACKID1234',
      _type: 'track',
      editors: [{_type: 'reference', _ref: trackEditor._id}]
    })

    await createDocument({
      _id: 'ARTICLEID1234',
      _type: 'article',
      track: {_type: 'reference', _ref: track._id}
    })

    const reviewProcess = await createDocument({
      _id: 'REVIEWPROCESSID1234',
      _type: 'reviewProcess',
      article: {_type: 'reference', _ref: 'ARTICLEID1234'}
    })

    await createDocument({
      _id: 'REVIEWITEMID1234',
      _type: 'reviewItem',
      reviewProcess: {_type: 'reference', _ref: 'REVIEWPROCESSID1234'}
    })

    const capabilities = await capabilitiesForUser(trackEditor._id)
    expect(capabilities).toMatchObject({
      isEditorInTrackWithArticleInReviewItem: ['reviewProcess._ref', [reviewProcess._id]]
    })
  })

  test('recognizes issue editors in reviewItem', async () => {
    const issueEditor = await createUser()

    await createDocument({
      _id: 'ARTICLEID1234',
      _type: 'article'
    })

    await createDocument({
      _id: 'ISSUEID1234',
      _type: 'issue',
      content: [
        {
          _type: 'section',
          title: 'A Section',
          articles: [{_type: 'reference', _ref: 'ARTICLEID1234'}]
        }
      ],
      editors: [{_type: 'reference', _ref: issueEditor._id}]
    })

    const reviewProcess = await createDocument({
      _id: 'REVIEWPROCESSID1234',
      _type: 'reviewProcess',
      article: {_type: 'reference', _ref: 'ARTICLEID1234'}
    })

    await createDocument({
      _id: 'REVIEWITEMID1234',
      _type: 'reviewItem',
      reviewProcess: {_type: 'reference', _ref: 'REVIEWPROCESSID1234'}
    })

    const capabilities = await capabilitiesForUser(issueEditor._id)
    expect(capabilities).toMatchObject({
      isEditorInIssueWithArticleInReviewItem: ['reviewProcess._ref', [reviewProcess._id]]
    })
  })

  test('recognizes a reviewer', async () => {
    const reviewer = await createUser()

    await createDocument({
      _id: 'REVIEWITEMID1234',
      _type: 'reviewItem',
      reviewer: {_type: 'reference', _ref: reviewer._id}
    })

    const capabilities = await capabilitiesForUser(reviewer._id)
    expect(capabilities).toMatchObject({
      isReviewerInReviewItem: [true]
    })
  })

  test('recognizes a reviewer on an article', async () => {
    const reviewer = await createUser()

    const article = await createDocument({
      _id: 'ARTICLEID1234',
      _type: 'article'
    })

    const reviewProcess = await createDocument({
      _id: 'REVIEWPROCESSID1234',
      _type: 'reviewProcess',
      article: {_type: 'reference', _ref: article._id}
    })

    await createDocument({
      _id: 'REVIEWITEMID1234',
      _type: 'reviewItem',
      reviewProcess: {_type: 'reference', _ref: reviewProcess._id},
      reviewer: {_type: 'reference', _ref: reviewer._id}
    })

    const capabilities = await capabilitiesForUser(reviewer._id)
    expect(capabilities).toMatchObject({
      isReviewerInArticle: ['_id', [article._id]]
    })
  })

  test('recognizes an editor in any issue', async () => {
    const issueEditor = await createUser()
    const unprivilegedUser = await createUser()

    await createDocument({
      _id: 'ISSUEID1234',
      _type: 'issue',
      editors: [{_type: 'reference', _ref: issueEditor._id}]
    })
    const issueEditorCapabilities = await capabilitiesForUser(issueEditor._id)
    expect(issueEditorCapabilities).toMatchObject({
      isEditorInAnyIssue: [true]
    })
    const unprivilegedUserCapabilities = await capabilitiesForUser(unprivilegedUser._id)
    expect(unprivilegedUserCapabilities).toMatchObject({
      isEditorInAnyIssue: [false]
    })
  })

  test('recognizes an editor in any track', async () => {
    const trackEditor = await createUser()
    const unprivilegedUser = await createUser()

    await createDocument({
      _id: 'TRACKID1234',
      _type: 'track',
      editors: [{_type: 'reference', _ref: trackEditor._id}]
    })
    const trackEditorCapabilities = await capabilitiesForUser(trackEditor._id)
    expect(trackEditorCapabilities).toMatchObject({
      isEditorInAnyTrack: [true]
    })
    const unprivilegedUserCapabilities = await capabilitiesForUser(unprivilegedUser._id)
    expect(unprivilegedUserCapabilities).toMatchObject({
      isEditorInAnyTrack: [false]
    })
  })

  test('recognizes an editor in a specific issue', async () => {
    const issueEditor = await createUser()

    const issue = await createDocument({
      _id: 'ISSUEID1234',
      _type: 'issue',
      editors: [{_type: 'reference', _ref: issueEditor._id}]
    })
    const capabilities = await capabilitiesForUser(issueEditor._id)
    expect(capabilities).toMatchObject({
      isEditorInIssue: ['_id', [issue._id]]
    })
  })

  test('recognizes an editor in a specific track', async () => {
    const trackEditor = await createUser()

    const track = await createDocument({
      _id: 'TRACKID1234',
      _type: 'track',
      editors: [{_type: 'reference', _ref: trackEditor._id}]
    })
    const capabilities = await capabilitiesForUser(trackEditor._id)
    expect(capabilities).toMatchObject({
      isEditorInTrack: ['_id', [track._id]]
    })
  })

  test('recognizes article submitter in comment', async () => {
    const submitter = await createUser()

    const article = await createDocument({
      _id: 'ARTICLEID1234',
      _type: 'article',
      submitters: [{_type: 'reference', _ref: submitter._id}]
    })

    await createDocument({
      _id: 'COMMENTID1234',
      _type: 'comment',
      subject: {_type: 'reference', _ref: article._id}
    })

    const capabilities = await capabilitiesForUser(submitter._id)
    expect(capabilities).toMatchObject({
      isSubmitterInArticleWithComment: ['subject._ref', [article._id]]
    })
  })
})
