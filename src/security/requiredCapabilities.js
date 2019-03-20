const {merge} = require('lodash')
const config = require('../config')

const requiredCapabilities = {
  read: {
    venue: ['isLoggedInUser'],
    issue: ['isLoggedInUser'],
    track: ['isLoggedInUser'],
    stage: ['isLoggedInUser'],
    user: ['isLoggedInUser'],
    article: [
      'isAdminUser',
      'isEditorInVenue',
      'isEditorInTrackWithArticle',
      'isEditorInIssueWithArticle',
      'isSubmitterInArticle'
    ],
    comment: [
      'isAdminUser',
      'isAuthorInComment',
      'isEditorInVenue',
      'isEditorInIssueWithComment',
      'isSubmitterInArticleWithComment',
      'isEditorInTrackWithArticleWithComment',
      'isEditorInIssueWithArticleWithComment'
    ],
    reviewProcess: [
      'isAdminUser',
      'isEditorInVenue',
      'isEditorInIssueWithArticleInReviewProcess',
      'isEditorInTrackWithArticleInReviewProcess'
    ],
    reviewItem: [
      'isAdminUser',
      'isEditorInVenue',
      'isReviewerInReviewItem',
      'isEditorInIssueWithArticleInReviewItem',
      'isEditorInTrackWithArticleInReviewItem'
    ],
    'lyra.imageAsset': ['isLoggedInUser'],
    'lyra.fileAsset': ['isLoggedInUser']
  },
  create: {
    venue: [],
    issue: ['isAdminUser', 'isEditorInVenue'],
    track: ['isAdminUser', 'isEditorInVenue'],
    stage: ['isAdminUser', 'isEditorInVenue'],
    user: ['isAdminUser', 'isEditorInVenue', 'isEditorInAnyIssue', 'isEditorInAnyTrack'],
    article: ['isAdminUser', 'isEditorInVenue', 'isEditorInAnyIssue', 'isEditorInAnyTrack'],
    comment: ['isAdminUser', 'isAuthorInComment'],
    reviewProcess: ['isAdminUser', 'isEditorInVenue', 'isEditorInAnyIssue', 'isEditorInAnyTrack'],
    reviewItem: [
      'isAdminUser',
      'isEditorInVenue',
      'isReviewerInReviewItem',
      'isEditorInIssueWithArticleInReviewProcess',
      'isEditorInTrackWithArticleInReviewProcess'
    ],
    'lyra.imageAsset': ['isLoggedInUser'],
    'lyra.fileAsset': ['isLoggedInUser']
  },
  update: {
    venue: ['isAdminUser', 'isEditorInVenue'],
    issue: ['isAdminUser', 'isEditorInVenue', 'isEditorInIssue'],
    track: ['isAdminUser', 'isEditorInVenue', 'isEditorInTrack'],
    stage: ['isAdminUser', 'isEditorInVenue'],
    user: ['isAdminUser', 'isEditorInVenue'],
    article: [
      'isAdminUser',
      'isEditorInVenue',
      'isEditorInTrackWithArticle',
      'isEditorInIssueWithArticle',
      'isSubmitterInArticle'
    ],
    comment: [
      'isAdminUser',
      'isAuthorInComment',
      'isEditorInVenue',
      'isEditorInIssueWithComment',
      'isEditorInTrackWithArticleWithComment',
      'isEditorInIssueWithArticleWithComment'
    ],
    reviewProcess: [
      'isAdminUser',
      'isEditorInVenue',
      'isEditorInIssueWithArticleInReviewProcess',
      'isEditorInTrackWithArticleInReviewProcess'
    ],
    reviewItem: [
      'isAdminUser',
      'isEditorInVenue',
      'isReviewerInReviewItem',
      'isEditorInIssueWithArticleInReviewItem',
      'isEditorInTrackWithArticleInReviewItem'
    ],
    'lyra.imageAsset': ['isLoggedInUser'],
    'lyra.fileAsset': ['isLoggedInUser']
  },
  delete: {
    venue: [],
    issue: ['isAdminUser', 'isEditorInVenue'],
    track: ['isAdminUser', 'isEditorInVenue'],
    stage: ['isAdminUser', 'isEditorInVenue'],
    user: ['isAdminUser', 'isEditorInVenue'],
    article: [
      'isAdminUser',
      'isEditorInVenue',
      'isEditorInTrackWithArticle',
      'isEditorInIssueWithArticle'
    ],
    comment: [
      'isAdminUser',
      'isAuthorInComment',
      'isEditorInVenue',
      'isEditorInIssueWithComment',
      'isEditorInTrackWithArticleWithComment',
      'isEditorInIssueWithArticleWithComment'
    ],
    reviewProcess: [
      'isAdminUser',
      'isEditorInVenue',
      'isEditorInIssueWithArticleInReviewProcess',
      'isEditorInTrackWithArticleInReviewProcess'
    ],
    reviewItem: [
      'isAdminUser',
      'isEditorInVenue',
      'isReviewerInReviewItem',
      'isEditorInIssueWithArticleInReviewItem',
      'isEditorInTrackWithArticleInReviewItem'
    ],
    'lyra.imageAsset': ['isLoggedInUser'],
    'lyra.fileAsset': ['isLoggedInUser']
  }
}

const features = {
  read: config.vega.featurePlugins.reduce((obj, documentType) => {
    const featureSet = {
      [`${documentType}Config`]: ['isLoggedInUser'],
      [`${documentType}State`]: ['isLoggedInUser']
    }
    return {
      ...obj,
      ...featureSet
    }
  }, {}),
  create: config.vega.featurePlugins.reduce((obj, documentType) => {
    const featureSet = {
      [`${documentType}Config`]: ['isAdminUser', 'isEditorInVenue'],
      [`${documentType}State`]: ['isLoggedInUser']
    }
    return {
      ...obj,
      ...featureSet
    }
  }, {}),
  update: config.vega.featurePlugins.reduce((obj, documentType) => {
    const featureSet = {
      [`${documentType}Config`]: ['isAdminUser', 'isEditorInVenue'],
      [`${documentType}State`]: ['isLoggedInUser']
    }
    return {
      ...obj,
      ...featureSet
    }
  }, {}),
  delete: config.vega.featurePlugins.reduce((obj, documentType) => {
    const featureSet = {
      [`${documentType}Config`]: ['isAdminUser', 'isEditorInVenue'],
      [`${documentType}State`]: ['isLoggedInUser']
    }
    return {
      ...obj,
      ...featureSet
    }
  }, {})
}

module.exports = merge({}, requiredCapabilities, features)
