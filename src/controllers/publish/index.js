const express = require('express')
const publish = require('./publish')
const unpublish = require('./unpublish')
const status = require('./status')

const router = express.Router()

router.post('/:dataset/:issue', publish)
router.delete('/:dataset/:issue', unpublish)
router.get('/:dataset/:issue/status', status)

module.exports = router
