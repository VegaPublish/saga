const express = require('express')
const currentUserPermissions = require('./currentUserPermissions')

const permissions = express.Router()

permissions.get('/:dataset', currentUserPermissions)

module.exports = permissions
