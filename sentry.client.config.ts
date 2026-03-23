import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring — captures real user load times
  tracesSampleRate: 0.2,

  // Session replay for debugging UI issues (1% of sessions, 10% on error)
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 0.1,

  // Only enable in production
  enabled: process.env.NODE_ENV === 'production' && !!process.env.NEXT_PUBLIC_SENTRY_DSN,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: false,
    }),
  ],
})
