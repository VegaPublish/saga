const express = require('express')
const currentUser = require('./currentUser')

const users = express.Router()

users.get('/me', currentUser)

module.exports = users
