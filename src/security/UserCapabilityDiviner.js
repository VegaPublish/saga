import {flatten} from 'lodash'

function quote(item) {
  return `"${item}"`
}

function quoteItems(items) {
  return `[${items.map(quote).join(',')}]`
}

function isValueInArrayTuple(valueName, ids = []) {
  return ids.length > 0 ? [valueName, ids] : [false]
}

// This class figures out all capabilities for a given user
// Please update/add the relevant test if you change anything
class UserCapabilityDiviner {
  constructor(userId, dataStore, venueId) {
    this.userId = userId
    this.venueId = venueId
    this.dataStore = dataStore
  }

  async getScopedDataStore() {
    if (!this.scopedDataStore) {
      this.scopedDataStore = await (this.venueId
        ? this.dataStore.forDataset(this.venueId)
        : this.dataStore.connect())
    }
    return this.scopedDataStore
  }

  async performQuery(query, params = {}) {
    try {
      const store = await this.getScopedDataStore()
      const results = store.fetch(query, params)
      return typeof results === 'undefined' ? [] : results
    } catch (err) {
      console.error('☠ performQuery failed', query, params, err) // eslint-disable-line no-console
      throw err
    }
  }

  articlesInTracks(trackIds) {
    const query = `*[_type=="article" && track._ref in ${quoteItems(trackIds)}]{
      _id, _type
    }`
    return this.performQuery(query)
  }

  reviewProcessesByArticles(articleIds) {
    const query = `*[_type=="reviewProcess" && article._ref in ${quoteItems(articleIds)}]{
      _id, _type
    }`
    return this.performQuery(query)
  }

  articleIdsByReviewProcesses(reviewProcessIds) {
    const query = `*[_type=="reviewProcess" && _id in ${quoteItems(reviewProcessIds)}]{
      _id, _type, article
    }`
    return this.performQuery(query).then(reviewProcesses =>
      reviewProcesses
        .map(reviewProcess => (reviewProcess.article ? reviewProcess.article._ref : null))
        .filter(Boolean)
    )
  }

  isEditorInVenue() {
    const query = `*[_type=="venue" && references($userId)][0]{
      _id, _type,
      "editor": defined(editors) && length(editors[_ref == $userId])>0,
    }.editor`
    return this.performQuery(query, {userId: this.userId}).then(result => [result])
  }

  isAdminUser() {
    const query = `*[_type=="user" && _id == $userId][0]{
      _id, _type, isAdmin
    }.isAdmin`
    return this.performQuery(query, {userId: this.userId}).then(result => [Boolean(result)])
  }

  tracksWhereUserIsEditor() {
    const query = `*[_type == "track" && references($userId)]{
        _id,
        _type,
        "editor": defined(editors) && length(editors[_ref == $userId])>0
      }`
    return this.performQuery(query, {userId: this.userId}).then(tracks =>
      tracks.filter(track => !!track.editor)
    )
  }

  articlesWhereUserIsSubmitter() {
    const query = `*[_type == "article" && references($userId)]{
        _id,
        _type,
        "submitter": defined(submitters) && length(submitters[_ref == $userId])>0
      }`
    return this.performQuery(query, {userId: this.userId}).then(articles =>
      articles.filter(article => !!article.submitter)
    )
  }

  // Find all issues where user is editor. Bring along articleIds
  issuesWhereUserIsEditor() {
    const query = `*[_type == "issue" && references($userId)]{
        _id,
        _type,
        "editor": defined(editors) && length(editors[_ref == $userId])>0,
        "articleIds": content[].articles[]._ref
      }`
    return this.performQuery(query, {userId: this.userId}).then(issues =>
      issues.filter(issue => !!issue.editor)
    )
  }

  reviewItemsWhereUserIsReviewer() {
    const query = `*[_type == "reviewItem" && reviewer._ref == $userId]{
      _id,
      _type,
      reviewProcess
    }`
    return this.performQuery(query, {userId: this.userId})
  }

  isEditorInTrackWithArticle() {
    return this.tracksWhereUserIsEditor()
      .then(tracks => tracks.map(track => track._id))
      .then(trackIds => isValueInArrayTuple('track._ref', trackIds))
  }

  isEditorInIssueWithArticle() {
    return this.issuesWhereUserIsEditor()
      .then(issues => issues.map(issue => issue.articleIds))
      .then(nestedArticleIds => flatten(nestedArticleIds))
      .then(articleIds => isValueInArrayTuple('_id', articleIds))
  }

  isSubmitterInArticle() {
    return this.articlesWhereUserIsSubmitter()
      .then(articles => articles.map(article => article._id))
      .then(articleIds => isValueInArrayTuple('_id', articleIds))
  }

  isReviewerInReviewItem() {
    return this.reviewItemsWhereUserIsReviewer().then(reviewItems => [reviewItems.length > 0])
  }

  isReviewerInArticle() {
    return this.reviewItemsWhereUserIsReviewer()
      .then(reviewItems =>
        reviewItems
          .map(reviewItem => (reviewItem.reviewProcess ? reviewItem.reviewProcess._ref : null))
          .filter(Boolean)
      )
      .then(reviewProcessIds => this.articleIdsByReviewProcesses(reviewProcessIds))
      .then(articleIds => isValueInArrayTuple('_id', articleIds))
  }

  isAuthorInComment() {
    return isValueInArrayTuple('author._ref', [this.userId])
  }

  isEditorInIssueWithArticleInReviewProcess() {
    return this.issuesWhereUserIsEditor()
      .then(issues => issues.map(issue => issue.articleIds))
      .then(nestedArticleIds => flatten(nestedArticleIds))
      .then(articleIds => isValueInArrayTuple('article._ref', articleIds))
  }

  isEditorInIssueWithArticleInReviewItem() {
    return this.issuesWhereUserIsEditor()
      .then(issues => issues.map(issue => issue.articleIds))
      .then(nestedArticleIds => flatten(nestedArticleIds))
      .then(articleIds => this.reviewProcessesByArticles(articleIds))
      .then(reviewProcesses => reviewProcesses.map(rp => rp._id))
      .then(reviewProcessIds => isValueInArrayTuple('reviewProcess._ref', reviewProcessIds))
  }

  isEditorInTrackWithArticleInReviewProcess() {
    return this.tracksWhereUserIsEditor()
      .then(tracks => tracks.map(track => track._id))
      .then(trackIds => this.articlesInTracks(trackIds))
      .then(articles => articles.map(article => article._id))
      .then(articleIds => isValueInArrayTuple('article._ref', articleIds))
  }

  isEditorInTrackWithArticleInReviewItem() {
    return this.tracksWhereUserIsEditor()
      .then(tracks => tracks.map(track => track._id))
      .then(trackIds => this.articlesInTracks(trackIds))
      .then(articles => articles.map(article => article._id))
      .then(articleIds => this.reviewProcessesByArticles(articleIds))
      .then(reviewProcesses => reviewProcesses.map(rp => rp._id))
      .then(reviewProcessIds => isValueInArrayTuple('reviewProcess._ref', reviewProcessIds))
  }

  isEditorInIssueWithArticleWithComment() {
    return this.issuesWhereUserIsEditor()
      .then(issues => issues.map(issue => issue.articleIds))
      .then(nestedArticleIds => flatten(nestedArticleIds))
      .then(articleIds => isValueInArrayTuple('subject._ref', articleIds))
  }

  isEditorInTrackWithArticleWithComment() {
    return this.tracksWhereUserIsEditor()
      .then(tracks => tracks.map(track => track._id))
      .then(trackIds => this.articlesInTracks(trackIds))
      .then(articles => articles.map(article => article._id))
      .then(articleIds => isValueInArrayTuple('subject._ref', articleIds))
  }

  isEditorInAnyIssue() {
    return this.issuesWhereUserIsEditor().then(issues => [issues.length > 0])
  }

  isEditorInAnyTrack() {
    return this.tracksWhereUserIsEditor().then(tracks => [tracks.length > 0])
  }

  isEditorInIssue() {
    return this.issuesWhereUserIsEditor()
      .then(issues => issues.map(issue => issue._id))
      .then(issueIds => isValueInArrayTuple('_id', issueIds))
  }

  isEditorInTrack() {
    return this.tracksWhereUserIsEditor()
      .then(tracks => tracks.map(track => track._id))
      .then(trackIds => isValueInArrayTuple('_id', trackIds))
  }

  isSubmitterInArticleWithComment() {
    return this.articlesWhereUserIsSubmitter()
      .then(articles => articles.map(article => article._id))
      .then(articleIds => isValueInArrayTuple('subject._ref', articleIds))
  }

  isEditorInIssueWithComment() {
    return this.issuesWhereUserIsEditor()
      .then(issues => issues.map(issue => issue._id))
      .then(issueIds => isValueInArrayTuple('subject._ref', issueIds))
  }

  runAll() {
    return Promise.all([
      this.isEditorInVenue(),
      this.isAdminUser(),
      this.isEditorInTrackWithArticle(),
      this.isEditorInIssueWithArticle(),
      this.isSubmitterInArticle(),
      this.isAuthorInComment(),
      this.isEditorInIssueWithComment(),
      this.isEditorInIssueWithArticleWithComment(),
      this.isEditorInTrackWithArticleWithComment(),
      this.isEditorInIssueWithArticleInReviewProcess(),
      this.isEditorInTrackWithArticleInReviewProcess(),
      this.isReviewerInReviewItem(),
      this.isReviewerInArticle(),
      this.isEditorInIssueWithArticleInReviewItem(),
      this.isEditorInTrackWithArticleInReviewItem(),
      this.isEditorInAnyIssue(),
      this.isEditorInAnyTrack(),
      this.isEditorInIssue(),
      this.isEditorInTrack(),
      this.isSubmitterInArticleWithComment()
    ]).then(
      ([
        isEditorInVenue,
        isAdminUser,
        isEditorInTrackWithArticle,
        isEditorInIssueWithArticle,
        isSubmitterInArticle,
        isAuthorInComment,
        isEditorInIssueWithComment,
        isEditorInIssueWithArticleWithComment,
        isEditorInTrackWithArticleWithComment,
        isEditorInIssueWithArticleInReviewProcess,
        isEditorInTrackWithArticleInReviewProcess,
        isReviewerInReviewItem,
        isReviewerInArticle,
        isEditorInIssueWithArticleInReviewItem,
        isEditorInTrackWithArticleInReviewItem,
        isEditorInAnyIssue,
        isEditorInAnyTrack,
        isEditorInIssue,
        isEditorInTrack,
        isSubmitterInArticleWithComment
      ]) => {
        return {
          isLoggedInUser: [true],
          isEditorInVenue,
          isAdminUser,
          isEditorInTrackWithArticle,
          isEditorInIssueWithArticle,
          isSubmitterInArticle,
          isAuthorInComment,
          isEditorInIssueWithComment,
          isEditorInIssueWithArticleWithComment,
          isEditorInTrackWithArticleWithComment,
          isEditorInIssueWithArticleInReviewProcess,
          isEditorInTrackWithArticleInReviewProcess,
          isReviewerInReviewItem,
          isReviewerInArticle,
          isEditorInIssueWithArticleInReviewItem,
          isEditorInTrackWithArticleInReviewItem,
          isEditorInAnyIssue,
          isEditorInAnyTrack,
          isEditorInIssue,
          isEditorInTrack,
          isSubmitterInArticleWithComment
        }
      }
    )
  }
}

module.exports = UserCapabilityDiviner
