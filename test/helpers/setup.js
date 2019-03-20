process.on('unhandledRejection', reason => {
  const msg = reason.message
  if (!msg.includes('addExpectationResult') && !msg.includes('topology was destroyed')) {
    // eslint-disable-next-line no-console
    console.error('UNHANDLED REJECTION', reason)
  }
})
