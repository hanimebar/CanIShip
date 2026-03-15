// Build-time stub — this module is loaded at runtime only
// These packages cannot be bundled by webpack
module.exports = new Proxy({}, {
  get(target, prop) {
    if (prop === '__esModule') return true
    if (prop === 'default') return new Proxy({}, { get() { return () => { throw new Error('This module is only available server-side at runtime') } } })
    return () => { throw new Error('This module is only available server-side at runtime') }
  }
})
