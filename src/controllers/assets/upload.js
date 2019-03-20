const express = require('express')
const {celebrate, Joi} = require('celebrate')
const uploadFile = require('./uploadFile')
const uploadImage = require('./uploadImage')

const data = express.Router()

const metaValues = Joi.string().only(['location', 'exif', 'image', 'palette', 'none'])
const validateUploadQuery = Joi.object({
  meta: Joi.array()
    .items(metaValues)
    .default(['palette'])
    .single(),
  label: Joi.string()
    .max(300)
    .optional(),
  filename: Joi.string()
    .max(300)
    .optional(),
  title: Joi.string()
    .max(300)
    .optional(),
  description: Joi.string()
    .max(5000)
    .optional()
})

const validateDataset = Joi.string()
  .regex(/^[-\w]+$/, 'dataset name')
  .lowercase()
  .required()

const validateHeaders = Joi.object({
  'content-type': Joi.string()
    .disallow(['application/x-www-form-urlencoded', 'multipart/form-data'])
    .optional()
}).unknown()

data.post(
  '/images/:dataset',
  celebrate({
    params: Joi.object({dataset: validateDataset}),
    headers: validateHeaders,
    query: validateUploadQuery
  }),
  uploadImage
)

data.post(
  '/files/:dataset',
  celebrate({
    params: Joi.object({dataset: validateDataset}),
    headers: validateHeaders,
    query: validateUploadQuery
  }),
  uploadFile
)

module.exports = data
