const fs = require('fs')
const path = require('path')
const qs = require('querystring')
const request = require('supertest')
const {close, getApp, createAdminUser, getSessionCookie} = require('./helpers')

// @todo
const getPermissionError = () => {}

describe('asset file uploads', () => {
  let app
  let adminUser

  const getDocument = id => {
    return request(app)
      .get(`/v1/data/doc/saga-test/${id}`)
      .set('Cookie', getSessionCookie(app, adminUser))
      .expect(200)
      .then(res => res.body.documents[0])
  }

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

  test('rejects url-encoded requests', () =>
    request(app)
      .post('/v1/assets/files/saga-test')
      .set('Cookie', getSessionCookie(app, adminUser))
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('moo')
      .expect(400, {
        statusCode: 400,
        error: 'Bad Request',
        message: 'child "content-type" fails because ["content-type" contains an invalid value]',
        validation: {source: 'headers', keys: ['content-type']}
      }))

  test('rejects form-data requests', () =>
    request(app)
      .post('/v1/assets/files/saga-test')
      .set('Cookie', getSessionCookie(app, adminUser))
      .set('Content-Type', 'application/x-www-form-urlencoded')
      .send('moo')
      .expect(400, {
        statusCode: 400,
        error: 'Bad Request',
        message: 'child "content-type" fails because ["content-type" contains an invalid value]',
        validation: {source: 'headers', keys: ['content-type']}
      }))

  test('rejects invalid dataset names', () =>
    request(app)
      .post('/v1/assets/files/my%20dataset')
      .set('Cookie', getSessionCookie(app, adminUser))
      .set('Content-Type', 'image/jpeg')
      .send('moo')
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
      .post(`/v1/assets/files/saga-test?label=${label}`)
      .set('Cookie', getSessionCookie(app, adminUser))
      .set('Content-Type', 'image/jpeg')
      .send('moo')
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
      .post(`/v1/assets/files/saga-test?filename=${filename}`)
      .set('Cookie', getSessionCookie(app, adminUser))
      .set('Content-Type', 'image/jpeg')
      .send('moo')
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

  test.skip('rejects with 404 on missing dataset', () => {
    return request(app)
      .post('/v1/assets/files/saga-test')
      .set('Cookie', getSessionCookie(app, adminUser))
      .set('Content-Type', 'image/jpeg')
      .send('moo')
      .expect(404)
  })

  test.skip('rejects with 400 on insufficient permissions', () => {
    return request(app)
      .post('/v1/assets/files/saga-test')
      .set('Cookie', getSessionCookie(app, adminUser))
      .set('Content-Type', 'text/plain')
      .send('moo')
      .expect(400, getPermissionError('create'))
  })

  test('uploads files', () => {
    expect.assertions(4)
    return request(app)
      .post('/v1/assets/files/saga-test')
      .set('Cookie', getSessionCookie(app, adminUser))
      .set('Content-Type', 'text/plain')
      .send('moop')
      .expect(200)
      .then(async res => {
        expect(res.body).toHaveProperty('document')
        expect(res.body.document).toHaveProperty('_id')

        const file = await app.services.fileStore.read(res.body.document.path)
        expect(Buffer.from('moop')).toEqual(file)

        const doc = await getDocument(res.body.document._id)
        expect(doc).toMatchObject({
          _id: 'file-47ba17d63618b876d5002b0f110671211ea0214c-txt',
          _type: 'lyra.fileAsset',
          assetId: '47ba17d63618b876d5002b0f110671211ea0214c',
          sha1hash: '47ba17d63618b876d5002b0f110671211ea0214c',
          path: 'files/saga-test/47ba17d63618b876d5002b0f110671211ea0214c.txt',
          url: 'http://localhost:4000/files/saga-test/47ba17d63618b876d5002b0f110671211ea0214c.txt',
          originalFilename: '47ba17d63618b876d5002b0f110671211ea0214c.txt',
          extension: 'txt',
          mimeType: 'text/plain',
          size: 4
        })
      })
  })

  test('uploads files with specific origin filename', () => {
    const filename = 'blåbærsyltetøy på skiva.csv'
    return request(app)
      .post(`/v1/assets/files/saga-test?filename=${encodeURIComponent(filename)}`)
      .set('Cookie', getSessionCookie(app, adminUser))
      .set('Content-Type', 'text/csv')
      .send('2017-06-03,5,30\n')
      .expect(200)
      .then(async res => {
        expect(res.body.document).toMatchObject({_type: 'lyra.fileAsset'})
        const doc = await getDocument(res.body.document._id)
        expect(doc).toMatchObject({
          _id: 'file-e5145b41219ffc51dffc9f2de8b522c51c3d38d3-csv',
          _type: 'lyra.fileAsset',
          assetId: 'e5145b41219ffc51dffc9f2de8b522c51c3d38d3',
          extension: 'csv',
          mimeType: 'text/csv',
          originalFilename: 'blåbærsyltetøy på skiva.csv',
          path: 'files/saga-test/e5145b41219ffc51dffc9f2de8b522c51c3d38d3.csv',
          sha1hash: 'e5145b41219ffc51dffc9f2de8b522c51c3d38d3',
          size: 16
        })
      })
  })

  test('uploads files with title, description, label, filename', () => {
    const meta = {
      label: 'l4b3l',
      title: 'Blueberry jam',
      description: 'Spreadsheet of pros and cons related to blueberry jam',
      filename: 'blåbærsyltetøy på skiva.csv'
    }

    return request(app)
      .post(`/v1/assets/files/saga-test?${qs.stringify(meta)}`)
      .set('Cookie', getSessionCookie(app, adminUser))
      .set('Content-Type', 'text/csv')
      .send('2017-06-03,5,30\n')
      .expect(200)
      .then(async res => {
        expect(res.body.document).toMatchObject({_type: 'lyra.fileAsset'})
        const doc = await getDocument(res.body.document._id)
        expect(doc).toMatchObject({
          _type: 'lyra.fileAsset',
          extension: 'csv',
          mimeType: 'text/csv',
          originalFilename: meta.filename,
          label: meta.label,
          description: meta.description
        })
      })
  })

  test('uploads files with no content-type as octet-stream', () => {
    return request(app)
      .post('/v1/assets/files/saga-test')
      .set('Cookie', getSessionCookie(app, adminUser))
      .send(Buffer.from('mix'))
      .then(async res => {
        expect(res.body.document).toMatchObject({_type: 'lyra.fileAsset'})
        const doc = await getDocument(res.body.document._id)
        expect(doc).toMatchObject({
          _type: 'lyra.fileAsset',
          extension: 'bin',
          size: 3,
          mimeType: 'application/octet-stream'
        })
      })
  })

  test('uploads files and uses filename extension as fallback, infers mime', () => {
    const filename = 'foobar.txt'
    return request(app)
      .post(`/v1/assets/files/saga-test?filename=${encodeURIComponent(filename)}`)
      .set('Cookie', getSessionCookie(app, adminUser))
      .send(Buffer.from('mix'))
      .then(async res => {
        expect(res.body.document).toMatchObject({_type: 'lyra.fileAsset'})
        const doc = await getDocument(res.body.document._id)
        expect(doc).toMatchObject({
          _type: 'lyra.fileAsset',
          extension: 'txt',
          size: 3,
          mimeType: 'text/plain'
        })
      })
  })

  test('uploads files and infers extension from client-sent mime type', () => {
    return request(app)
      .post('/v1/assets/files/saga-test')
      .set('Content-Type', 'application/javascript')
      .set('Cookie', getSessionCookie(app, adminUser))
      .send(Buffer.from('console.log("foo")'))
      .then(async res => {
        expect(res.body.document).toMatchObject({_type: 'lyra.fileAsset'})
        const doc = await getDocument(res.body.document._id)
        expect(doc).toMatchObject({
          _type: 'lyra.fileAsset',
          extension: 'js',
          size: 18,
          mimeType: 'application/javascript'
        })
      })
  })

  test('uploads files and infers extension and mime type where possible', () => {
    return request(app)
      .post('/v1/assets/files/saga-test')
      .set('Content-Type', 'application/octet-stream')
      .set('Cookie', getSessionCookie(app, adminUser))
      .send(fs.readFileSync(path.join(__dirname, 'fixtures', 'some.zip')))
      .then(async res => {
        expect(res.body.document).toMatchObject({_type: 'lyra.fileAsset'})
        const doc = await getDocument(res.body.document._id)
        expect(doc).toMatchObject({
          _type: 'lyra.fileAsset',
          extension: 'zip',
          size: 168,
          mimeType: 'application/zip'
        })
      })
  })

  test('uploads files and infers extension and mime type (no content type provided)', () => {
    return request(app)
      .post('/v1/assets/files/saga-test')
      .set('Cookie', getSessionCookie(app, adminUser))
      .send(fs.readFileSync(path.join(__dirname, 'fixtures', 'some.zip')))
      .then(async res => {
        expect(res.body.document).toMatchObject({_type: 'lyra.fileAsset'})
        const doc = await getDocument(res.body.document._id)
        expect(doc).toMatchObject({
          _type: 'lyra.fileAsset',
          extension: 'zip',
          size: 168,
          mimeType: 'application/zip'
        })
      })
  })

  test('calculates correct sha1 hash for large(ish) files', async () => {
    const data = '!foobar!'.repeat(655360) // 5 MB
    return request(app)
      .post('/v1/assets/files/saga-test')
      .set('Cookie', getSessionCookie(app, adminUser))
      .set('Content-Type', 'text/plain; charset=utf-8')
      .send(data)
      .then(async res => {
        expect(res.body.document).toMatchObject({_type: 'lyra.fileAsset'})
        const doc = await getDocument(res.body.document._id)
        expect(doc).toMatchObject({
          _type: 'lyra.fileAsset',
          size: 8 * 655360,
          mimeType: 'text/plain'
        })
      })
  })

  test('uploads files and tries to infer correct mime/extension if original extension is `bin`', () => {
    const filename = 'some.bin'
    return request(app)
      .post(`/v1/assets/files/saga-test?filename=${encodeURIComponent(filename)}`)
      .set('Cookie', getSessionCookie(app, adminUser))
      .send(fs.readFileSync(path.join(__dirname, 'fixtures', 'some.zip')))
      .then(async res => {
        expect(res.body.document).toMatchObject({_type: 'lyra.fileAsset'})

        const doc = await getDocument(res.body.document._id)
        expect(doc).toMatchObject({
          _type: 'lyra.fileAsset',
          extension: 'zip',
          size: 168,
          mimeType: 'application/zip'
        })
      })
  })

  test('deleting asset document deletes asset', () =>
    request(app)
      .post('/v1/assets/files/saga-test')
      .set('Cookie', getSessionCookie(app, adminUser))
      .send(fs.readFileSync(path.join(__dirname, 'fixtures', 'some.zip')))
      .then(async res => {
        expect(res.body.document).toMatchObject({_type: 'lyra.fileAsset'})
        await request(app)
          .get(`/files/saga-test/${path.basename(res.body.document.path)}`)
          .expect(200)

        await request(app)
          .post('/v1/data/mutate/saga-test?returnIds=true')
          .set('Cookie', getSessionCookie(app, adminUser))
          .send({mutations: [{delete: {id: res.body.document._id}}]})
          .expect(200)

        await request(app)
          .get(`/files/saga-test/${path.basename(res.body.document.path)}`)
          .expect(404)
      }))
})
