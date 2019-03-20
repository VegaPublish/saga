# Any logged in User
- Venue: Read
- Issue: Read
- Article: Read
- Comment: Read/create/update/delete (only belonging to self)

# Venue
## Administrator
```
{
  _type: 'venue',
  title: 'Comics in Hindsight',
  administrators: [{_type: 'reference', _ref: 'user-id-123'}]
}
```

- Venue: Read/create/update/delete
- User: Read/create/update/delete
- Track: Read/create/update/delete
- Stage: Read/create/update/delete
- Issue: Read/create/update/delete
- Article: Read/create/update/delete
- Comment: Read/create/update/delete (belonging to anyone)
- ReviewProcess: Read/create/update/delete
- ReviewItem: Read/create/update/delete
- FeatureConfig: Read/create/update/delete
- FeatureState: Read/create/update/delete
 
## Editor
```
{
  _type: 'venue',
  title: 'Comics in Hindsight',
  editors: [{_type: 'reference', _ref: 'user-id-123'}]
}
```
- Venue: Read/Update
- User: Read/create/update/delete
- Track: Read/create/update/delete
- Stage: Read/create/update/delete
- Issue: Read/create/update/delete
- Article: Read/create/update/delete
- Comment: Read (all). Create/update/delete (only belonging to self)
- ReviewProcess: Read/create/update/delete
- ReviewItem: Read/create/update/delete
- FeatureConfig: Read/create/update/delete
- FeatureState: Read/create/update/delete

## CopyEditor
```
{
  _type: 'venue',
  title: 'Comics in Hindsight',
  copyEditors: [{_type: 'reference', _ref: 'user-id-123'}]
}
```
Same access rights as Venue Editor (should probably be renamed AssistantEditor or somesuch)

# Issue
## Editor
```
{
  _type: 'issue',
  title: 'On Bats and Batmen',
  editors: [{_type: 'reference', _ref: 'user-id-123'}]
}
```
- User: Create/update
- Issue: Update (this Issue)
- Article: Create/update/delete (articles in this Issue or not assigned to any Issue)
- Comment: Read (all in this Issue). Create/update/delete (only belonging to self)
- ReviewProcess: Read/create/update/delete (for Article in this Issue)
- ReviewItem: Read/create/update/delete (for ReviewProcess with Article in this Issue)
- FeatureState: Read/create/update/delete (for Article in this Issue)

# Track
## Editor
```
{
  _type: 'track',
  title: 'Letters from the Reader',
  editors: [{_type: 'reference', _ref: 'user-id-123'}]
}
```
- User: Create/update
- Track: Update
- Article: Create/update/delete (articles in this Track or not assigned to a Track)
- Comment: Read (on Articles in this Track). Create/update/delete (only belonging to self)
- ReviewProcess: Read/create/update/delete (for Article in this Track)
- ReviewItem: Read/create/update/delete (for ReviewProcess with Article in this Track)
- FeatureState: Read/create/update/delete (for Article in this Track)

## Copy-Editor
```
{
  _type: 'track',
  title: 'Letters from the Reader',
  copyEditors: [{_type: 'reference', _ref: 'user-id-123'}]
}
```
Same access rights as Track Editor

# Article
## Submitter
```
{
  _type: 'article',
  title: 'Does Bruce Wayne suffer from Clinical Lycanthrophy?',
  submitters: [{_type: 'reference', _ref: 'user-id-123'}]
}
```
- User: Update (belonging to self)
- Comment: Read (on this Article). Create/update/delete (only on this Article and belonging to self)
- Article: Update (If in the correct Stage. Can't update `submitter` field)
- ReviewItem: Update (where self is the reviewer)
- FeatureState: Read/create/update/delete (for this Article)

# ReviewItem
## Reviewer
```
{
  _type: 'reviewItem',
  reviewer: {_type: 'reference', _ref: 'user-id-123'}
}
```
- ReviewItem: Update (except the `reviewer` field)
