module.exports = [
  {
    _id: 'track_book-reviews',
    _type: 'track',
    editors: [],
    name: 'book-reviews',
    title: 'Book reviews',
    trackStages: [
      {
        _key: '5c01cf9ed180a2785b845156636a83d3',
        _type: 'trackStage',
        name: 'establishing_book-reviews',
        stage: {_ref: 'stage_establishing', _type: 'reference'}
      },
      {
        _key: 'a4ebe59a31e1d78e0aac38357cd8d23e',
        _type: 'trackStage',
        name: 'review_book-reviews',
        isReviewEnabled: true,
        stage: {_ref: 'stage_review', _type: 'reference'}
      },

      {
        _key: '0d280c8f88827c4c4d4cfa265171af23',
        _type: 'trackStage',
        name: 'completed_book-reviews',
        mayBePublished: true,
        stage: {_ref: 'stage_completed', _type: 'reference'}
      }
    ]
  },
  {
    _id: 'track_articles',
    _type: 'track',
    editors: [],
    name: 'articles',
    title: 'Articles',
    trackStages: [
      {
        _key: 'db8ee3fb5b7c1def04e6e769c4d26d77',
        _type: 'trackStage',
        name: 'establishing_articles',
        stage: {_ref: 'stage_establishing', _type: 'reference'}
      },
      {
        _key: '07882211ae8f',
        _type: 'trackStage',
        name: 'review_articles',
        isReviewEnabled: true,
        stage: {_ref: 'stage_review', _type: 'reference'}
      },
      {
        _key: '06aefec44a3ad853b8844877cfee616c',
        _type: 'trackStage',
        name: 'proofing_articles',
        stage: {_ref: 'stage_proofing', _type: 'reference'}
      },
      {
        _key: '7c7e70316f9591cd9f2d80e034a5af07',
        _type: 'trackStage',
        name: 'completed_articles',
        mayBePublished: true,
        stage: {_ref: 'stage_completed', _type: 'reference'}
      }
    ]
  }
]
