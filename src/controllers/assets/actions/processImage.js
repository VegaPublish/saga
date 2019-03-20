const Boom = require('boom')
const sharp = require('sharp')
const mime = require('mime-types')
const extendBoom = require('../../../util/extendBoom')

const supportedTypes = ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'tiff', 'gif', 'svg', 'psd', 'webp']
const flippedOrientations = [5, 6, 7, 8]

module.exports = async buffer => {
  if (buffer.length === 0) {
    throw Boom.badRequest('Empty request body')
  }

  const image = sharp(buffer, {failOnError: true})

  // See that we can read the basic metadata for the image
  let metadata
  try {
    metadata = await image.metadata()
    if (!metadata.width || !metadata.height) {
      throw new Error('Could not determine width and height of image')
    }

    const output = await image.toBuffer({resolveWithObject: true})
    if (!output.info) {
      throw new Error('Could not process image')
    }
  } catch (err) {
    const meta = {details: filterError(err.message)}
    throw extendBoom(Boom.badRequest('Invalid image, could not read metadata', meta), meta)
  }

  // See if we support this content type
  if (!metadata.format || !supportedTypes.includes(metadata.format)) {
    throw Boom.badRequest('Unsupported image type')
  }

  return Object.assign({image, buffer}, resolveImageData(metadata))
}

function resolveImageData(metadata) {
  // Does the image have an orientation? If so, we might have to flip the dimensions
  const {orientation} = metadata
  let {width, height} = metadata
  if (orientation && flippedOrientations.includes(orientation)) {
    ;[width, height] = [height, width]
  }

  // Return the extracted information we have on this image
  const aspectRatio = width / height
  const dimensions = {width, height, aspectRatio}
  const mimeType = mime.lookup(metadata.format) || undefined
  const extension = (mime.extension(mimeType) || 'jpg').replace('jpeg', 'jpg')
  return {extension, dimensions, mimeType}
}

function filterError(msg) {
  const isVipsError = /^Vips/.test(msg)
  if (!isVipsError) {
    return msg
  }

  // Return only first vips error
  const [message] = msg.split('\n', 2)
  return message.replace(/^Vips.*?:\s+/, '')
}
