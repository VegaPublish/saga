const express = require('express')
const listDatasets = require('./listDatasets')

const grants = express.Router()

grants.get('/', listDatasets)

module.exports = grants
