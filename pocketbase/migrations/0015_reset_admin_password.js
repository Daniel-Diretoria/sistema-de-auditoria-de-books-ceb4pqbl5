migrate(
  (app) => {
    // Probe available methods on $security
    const keys = Object.keys($security)
    throw new Error('SECURITY KEYS: ' + keys.join(', '))
  },
  (app) => {},
)
