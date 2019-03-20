const Joi = require('joi')
const express = require('express')
const {celebrate} = require('celebrate')

const validation = celebrate({
  params: Joi.object({
    token: Joi.string()
      .required()
      .regex(/^[-\w]+$/)
  }),
  query: Joi.object({
    venueId: Joi.string().optional(),
    origin: Joi.string()
      .uri()
      .optional()
  })
})

module.exports = providers => {
  const router = express.Router()
  /**
   * Get the root invitation token for a brand new vega/lyra installation
   */
  router.get('/root', require('./getRootInvite'))

  /**
   * Get the root invitation token for a brand new vega/saga installation
   */
  router.get('/root/login', require('./loginAsRoot').bind(null, providers))

  /**
   * Claim the root invitation for a brand new vega/saga installation
   */
  router.get('/claim/root', require('./claimRootInvitation'))

  /**
   * Accept an invitation
   */
  router.get('/claim/:token', validation, require('./claimInvitation'))

  /**
   * Fetch specific invitation
   */
  router.get('/:token', validation, require('./getInvitation'))

  return router
}
