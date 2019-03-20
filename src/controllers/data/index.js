const express = require('express')
const listen = require('./listen')
const getDocs = require('./get')
const queryDocs = require('./query')
const mutateDocs = require('./mutate')
const exportDocuments = require('./export')

const data = express.Router()

// Query
data.get('/query/:dataset', queryDocs.get)
data.post('/query:dataset', queryDocs.post)

// Mutate
data.post('/mutate/:dataset', mutateDocs)

// Listen
data.get('/listen/:dataset', listen)

// Export
data.get('/export/:dataset', exportDocuments)

// Get documents by ID
data.get('/doc/:dataset/:documentId', getDocs)

module.exports = data
