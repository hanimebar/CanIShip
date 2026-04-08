import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring — captures real user load times
  tracesSampleRate: 0.2,

  // Sample rates declared here so Sentry knows the intent before replay loads
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 0.1,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production' && !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Replay integration is NOT included here — loaded lazily below to keep
  // rrweb (~100 KB) out of the initial bundle.
})

// Lazy-load the Replay integration after the page is idle.
// rrweb (the recording library Replay bundles) is ~100 KB and only used by
// 1 % of sessions — there's no reason to pay that cost on every page load.
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
  const loadReplay = async () => {
    const { replayIntegration } = await import('@sentry/nextjs')
    const client = Sentry.getClient()
    if (client) {
      client.addIntegration(
        replayIntegration({ maskAllText: true, blockAllMedia: false })
      )
    }
  }

  // requestIdleCallback fires after the browser has finished layout/paint
  if ('requestIdleCallback' in window) {
    requestIdleCallback(loadReplay)
  } else {
    // Safari fallback
    setTimeout(loadReplay, 2000)
  }
}
