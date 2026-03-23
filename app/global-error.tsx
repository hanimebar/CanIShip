'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ background: '#0F0C08', color: '#E8D5A3', fontFamily: 'monospace', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', margin: 0 }}>
        <div style={{ textAlign: 'center', maxWidth: 480, padding: '2rem' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚓</div>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Something went wrong</h2>
          <p style={{ color: '#A08060', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            The error has been reported. Try refreshing — if it keeps happening, contact support.
          </p>
          <button
            onClick={reset}
            style={{ padding: '0.5rem 1.5rem', background: '#00FF88', color: '#0F0C08', border: 'none', cursor: 'pointer', fontWeight: 700, borderRadius: 4 }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
