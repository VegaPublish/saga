const request = require('supertest')
const fs = require('fs')
const path = require('path')
const {close, getApp, createAdminUser, getSessionCookie} = require('./helpers')

// @todo
const getPermissionError = () => {}

describe('asset image uploads', () => {
  let app
  let adminUser

  const getDocument = id => {
    return request(app)
      .get(`/v1/data/doc/saga-test/${id}`)
      .set('Cookie', getSessionCookie(app, adminUser))
      .expect(200)
      .then(async res => {
        return res.body.documents[0]
      })
  }

  const tiny = fs.readFileSync(path.join(__dirname, 'fixtures', 'tiny.png'))
  const gpsJpegImage = fs.readFileSync(path.join(__dirname, 'fixtures', 'gps.jpg'))
  const rotatedImage = fs.readFileSync(path.join(__dirname, 'fixtures', 'rotated.jpg'))
  const webpImage = fs.readFileSync(path.join(__dirname, 'fixtures', 'mbcc.webp'))
  const targaImage = fs.readFileSync(path.join(__dirname, 'fixtures', 'mead.tga'))
  const brokenImage = fs.readFileSync(path.join(__dirname, 'fixtures', 'broken.jpg'))
  const brokenHuffmanImage = fs.readFileSync(path.join(__dirname, 'fixtures', 'broken-huffman.jpg'))
  const brokenDifferentlyImage = fs.readFileSync(
    path.join(__dirname, 'fixtures', 'broken-differently.jpg')
  )
  const sortaBrokenImage = fs.readFileSync(path.join(__dirname, 'fixtures', 'sorta-broken.png'))

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

  //
  // Validation tests
  //
  test('rejects url-encoded requests', () =>
    request(app)
      .post('/v1/assets/images/saga-test')
      .set('Cookie', getSessionCookie(app, adminUser))
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send(tiny)
      .expect(400, {
        statusCode: 400,
        error: 'Bad Request',
        message: 'child "content-type" fails because ["content-type" contains an invalid value]',
        validation: {source: 'headers', keys: ['content-type']}
      }))

  test('rejects form-data requests', () =>
    request(app)
      .post('/v1/assets/images/saga-test')
      .set('Cookie', getSessionCookie(app, adminUser))
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send(tiny)
      .expect(400, {
        statusCode: 400,
        error: 'Bad Request',
        message: 'child "content-type" fails because ["content-type" contains an invalid value]',
        validation: {source: 'headers', keys: ['content-type']}
      }))

  test('rejects invalid dataset names', () =>
    request(app)
      .post('/v1/assets/images/my%20dataset')
      .set('Cookie', getSessionCookie(app, adminUser))
      .set('Content-Type', 'image/png')
      .send(tiny)
      .expect(400, {
        statusCode: 400,
        error: 'Bad Request',
        message: [
          'child "dataset" fails because ["dataset" with',
          'value "my dataset" fails to match the dataset name pattern]'
        ].join(' '),
        validation: {source: 'params', keys: ['dataset']}
      }))

  test('rejects invalid labels', () => {
    const label = new Array(70).join('label')
    return request(app)
      .post(`/v1/assets/images/saga-test?label=${label}`)
      .set('Cookie', getSessionCookie(app, adminUser))
      .set('Content-Type', 'image/png')
      .send(tiny)
      .expect(400, {
        statusCode: 400,
        error: 'Bad Request',
        message: [
          'child "label" fails because ["label" length',
          'must be less than or equal to 300 characters long]'
        ].join(' '),
        validation: {source: 'query', keys: ['label']}
      })
  })

  test('rejects invalid filenames', () => {
    const filename = new Array(70).join('filename')
    return request(app)
      .post(`/v1/assets/images/saga-test?filename=${filename}`)
      .set('Cookie', getSessionCookie(app, adminUser))
      .set('Content-Type', 'image/png')
      .send(tiny)
      .expect(400, {
        statusCode: 400,
        error: 'Bad Request',
        message: [
          'child "filename" fails because ["filename" length',
          'must be less than or equal to 300 characters long]'
        ].join(' '),
        validation: {source: 'query', keys: ['filename']}
      })
  })

  test.skip('rejects with 400 on insufficient permissions', () => {
    return request(app)
      .post('/v1/assets/images/saga-test')
      .set('Cookie', getSessionCookie(app, adminUser))
      .set('Content-Type', 'image/png')
      .send(tiny)
      .expect(400, getPermissionError('create'))
  })

  test('rejects with 400 on empty body', () =>
    request(app)
      .post('/v1/assets/images/saga-test')
      .set('Cookie', getSessionCookie(app, adminUser))
      .set('Content-Type', 'image/png')
      .send(Buffer.from(''))
      .expect(400, {
        statusCode: 400,
        error: 'Bad Request',
        message: 'Empty request body'
      }))

  test('rejects with 400 on invalid images', () =>
    request(app)
      .post('/v1/assets/images/saga-test')
      .set('Cookie', getSessionCookie(app, adminUser))
      .set('Content-Type', 'image/png')
      .send(Buffer.from('moop'))
      .expect(400, {
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid image, could not read metadata',
        details: 'Input buffer contains unsupported image format'
      }))

  test('rejects with 400 on broken images', () =>
    request(app)
      .post('/v1/assets/images/saga-test')
      .set('Cookie', getSessionCookie(app, adminUser))
      .set('Content-Type', 'image/jpeg')
      .send(brokenImage)
      .expect(400, {
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid image, could not read metadata',
        details: 'Input buffer has corrupt header'
      }))

  test('rejects with 400 on broken images (#2)', () =>
    request(app)
      .post('/v1/assets/images/saga-test')
      .set('Cookie', getSessionCookie(app, adminUser))
      .set('Content-Type', 'image/png')
      .send(sortaBrokenImage)
      .expect(400, {
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid image, could not read metadata',
        details: 'Input buffer has corrupt header'
      }))

  test('rejects with 400 on broken images (#3)', () =>
    request(app)
      .post('/v1/assets/images/saga-test')
      .set('Cookie', getSessionCookie(app, adminUser))
      .set('Content-Type', 'image/png')
      .send(brokenDifferentlyImage)
      .expect(400, {
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid image, could not read metadata',
        details: 'Corrupt JPEG data: premature end of data segment'
      }))

  test('rejects with 400 on broken images (#4)', () =>
    request(app)
      .post('/v1/assets/images/saga-test')
      .set('Cookie', getSessionCookie(app, adminUser))
      .set('Content-Type', 'image/png')
      .send(brokenHuffmanImage)
      .expect(400, {
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid image, could not read metadata',
        details: 'Corrupt JPEG data: bad Huffman code'
      }))

  //
  // Start actual, working upload tests
  //
  test('uploads images', () => {
    return request(app)
      .post('/v1/assets/images/saga-test')
      .set('Cookie', getSessionCookie(app, adminUser))
      .set('Content-Type', 'image/png')
      .send(tiny)
      .expect(200)
      .then(async res => {
        expect(res.body).toHaveProperty('document')
        expect(res.body.document).toHaveProperty('_id')

        const file = await app.services.fileStore.read(res.body.document.path)
        expect(file).toEqual(tiny)

        const doc = await getDocument(res.body.document._id)
        expect(doc).toMatchObject({
          _type: 'lyra.imageAsset',
          assetId: '89174d1b2cd414d46910dd68bc93839492c6bd42',
          extension: 'png',
          sha1hash: '89174d1b2cd414d46910dd68bc93839492c6bd42',
          size: tiny.length,
          metadata: {dimensions: {aspectRatio: 1, height: 2, width: 2}},
          mimeType: 'image/png',
          path: `images/saga-test/89174d1b2cd414d46910dd68bc93839492c6bd42-2x2.png`
        })
      })
  })

  test('uploads images with specific original filename', () => {
    const originalFilename = 'blåbærsyltetøy på skiva.png'
    return request(app)
      .post(`/v1/assets/images/saga-test?filename=${encodeURIComponent(originalFilename)}`)
      .set('Cookie', getSessionCookie(app, adminUser))
      .set('Content-Type', 'image/png')
      .send(tiny)
      .then(async res => {
        expect(res.body).toHaveProperty('document')
        expect(res.body.document).toHaveProperty('_id')
        expect(res.body.document).toHaveProperty('originalFilename', originalFilename)

        const file = await app.services.fileStore.read(res.body.document.path)
        expect(file).toEqual(tiny)

        const doc = await getDocument(res.body.document._id)
        expect(doc).toHaveProperty('originalFilename', originalFilename)
      })
  })

  test('infers images with no content-type to their actual mime type', () => {
    return request(app)
      .post('/v1/assets/images/saga-test')
      .set('Cookie', getSessionCookie(app, adminUser))
      .send(gpsJpegImage)
      .then(async res => {
        const doc = await getDocument(res.body.document._id)
        expect(doc).toMatchObject({
          mimeType: 'image/jpeg',
          extension: 'jpg'
        })
      })
  })

  test('extracts correct width/height info for rotated images', () => {
    return request(app)
      .post('/v1/assets/images/saga-test?meta=none')
      .set('Cookie', getSessionCookie(app, adminUser))
      .send(rotatedImage)
      .then(res => {
        expect(res.body.document.metadata).toMatchObject({
          dimensions: {aspectRatio: 0.75, height: 4000, width: 3000}
        })

        expect(res.body.document.path).toMatch(/-3000x4000\.jpg$/)
      })
  })

  test('supports webp uploads', () => {
    return request(app)
      .post('/v1/assets/images/saga-test?meta=none')
      .set('Cookie', getSessionCookie(app, adminUser))
      .send(webpImage)
      .then(res => {
        expect(res.body.document).toMatchObject({
          _type: 'lyra.imageAsset',
          metadata: {dimensions: {width: 506, height: 900, aspectRatio: 0.5622222222222222}},
          extension: 'webp',
          mimeType: 'image/webp'
        })
        expect(res.body.document.path).toMatch(/-506x900\.webp$/)
      })
  })

  test('rejects unknown formats', () =>
    request(app)
      .post('/v1/assets/images/saga-test?meta=none')
      .set('Cookie', getSessionCookie(app, adminUser))
      .set('Content-Type', 'image/x-targa')
      .send(targaImage)
      .expect(400, {
        error: 'Bad Request',
        message: 'Invalid image, could not read metadata',
        details: 'Input buffer contains unsupported image format',
        statusCode: 400
      }))
})
