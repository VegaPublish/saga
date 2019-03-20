const findReferences = require('../../src/util/findReferences')

const doc = {
  _id: 'foo',
  categories: [
    {_key: 'html5', _ref: 'html5'},
    {_ref: 'css', _weak: true},
    {title: 'foo'},
    {
      _key: 'deeper',
      sub: {
        category: [{_ref: 'deepRef'}]
      }
    }
  ],

  subTree: {
    withSome: {
      deep: {
        refs: {
          _ref: 'heider'
        }
      }
    }
  },

  dont: null,
  worry: false,
  about: undefined,
  the: 1337,
  other: 'primitives',
  cause: true,
  notGonnaUseThem: new Date(),
  butAtRoot: {
    _ref: 'forsure',
    _weak: true
  }
}

test('find refs', () => {
  expect(findReferences(doc)).toEqual([
    {id: 'html5', weak: false, path: ['categories', {_key: 'html5'}]},
    {id: 'css', weak: true, path: ['categories', 1]},
    {id: 'deepRef', weak: false, path: ['categories', {_key: 'deeper'}, 'sub', 'category', 0]},
    {id: 'heider', weak: false, path: ['subTree', 'withSome', 'deep', 'refs']},
    {id: 'forsure', weak: true, path: ['butAtRoot']}
  ])
})
