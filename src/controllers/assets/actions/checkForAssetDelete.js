const assetTypes = ['lyra.imageAsset', 'lyra.fileAsset']

module.exports = async (app, evt) => {
  if (!evt.previous || !assetTypes.includes(evt.previous._type)) {
    return
  }

  const isDelete = evt.mutations.some(mut => mut.delete)
  if (!isDelete) {
    return
  }

  const {venueId} = evt.annotations
  if (!venueId) {
    return
  }

  try {
    await app.services.fileStore.delete(evt.previous.path)
  } catch (err) {
    app.services.log.error(err)
  }
}
