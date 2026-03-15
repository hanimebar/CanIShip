'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

type JobStatus = {
  status: 'queued' | 'running' | 'complete' | 'failed'
  job_id: string
  report_id?: string
  ship_score?: number
  ship_verdict?: string
  error_message?: string
  started_at?: string
  created_at?: string
  completed_at?: string
}

const statusMessages = {
  queued: [
    'Waiting in queue...',
    'Your audit will start shortly.',
    'Getting the tools ready...',
  ],
  running: [
    'Launching Playwright browser...',
    'Crawling pages and checking links...',
    'Running axe-core accessibility audit...',
    'Running Lighthouse performance audit...',
    'Scanning security headers...',
    'Sending results to Claude for analysis...',
    'Claude is generating your report...',
    'Almost done...',
  ],
}

function getElapsed(startTime?: string): string {
  if (!startTime) return ''
  const elapsed = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000)
  if (elapsed < 60) return `${elapsed}s`
  return `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`
}

export default function AuditStatusPage() {
  const router = useRouter()
  const params = useParams()
  const jobId = params.id as string

  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null)
  const [error, setError] = useState('')
  const [messageIndex, setMessageIndex] = useState(0)
  const [dots, setDots] = useState('.')
  const [elapsed, setElapsed] = useState('')

  const pollStatus = useCallback(async () => {
    if (!jobId) return

    try {
      const res = await fetch(`/api/audit/${jobId}`)
      if (!res.ok) {
        if (res.status === 404) {
          setError('Audit job not found.')
          return
        }
        return
      }

      const data: JobStatus = await res.json()
      setJobStatus(data)

      if (data.status === 'complete' && data.report_id) {
        // Redirect to report page
        setTimeout(() => {
          router.push(`/report/${jobId}`)
        }, 1500)
      }
    } catch {
      // Network error — keep polling
    }
  }, [jobId, router])

  // Poll every 5 seconds
  useEffect(() => {
    pollStatus()
    const interval = setInterval(pollStatus, 5000)
    return () => clearInterval(interval)
  }, [pollStatus])

  // Animate loading messages
  useEffect(() => {
    if (!jobStatus) return
    const messages = statusMessages[jobStatus.status as keyof typeof statusMessages] || []
    if (messages.length === 0) return

    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % messages.length)
    }, 3500)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobStatus?.status])

  // Animate dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '.' : d + '.'))
    }, 500)
    return () => clearInterval(interval)
  }, [])

  // Track elapsed time
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(getElapsed(jobStatus?.started_at || jobStatus?.created_at))
    }, 1000)
    return () => clearInterval(interval)
  }, [jobStatus?.started_at, jobStatus?.created_at])

  if (error) {
    return (
      <div className="min-h-screen bg-dark-900 text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-red-400 text-lg font-semibold mb-3">{error}</div>
          <Link href="/dashboard" className="text-neon-green hover:underline text-sm">
            Back to dashboard
          </Link>
        </div>
      </div>
    )
  }

  const status = jobStatus?.status
  const messages = statusMessages[status as keyof typeof statusMessages] || []
  const currentMessage = messages[messageIndex % messages.length] || 'Processing...'

  return (
    <div className="min-h-screen bg-dark-900 text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">

        {/* Logo */}
        <div className="font-mono-brand font-bold text-neon-green text-xl mb-12">
          CanIShip
        </div>

        {status === 'complete' ? (
          /* Complete state */
          <div>
            <div className="w-20 h-20 rounded-full bg-neon-green/15 border-2 border-neon-green flex items-center justify-center mx-auto mb-6 animate-score-in">
              <svg className="w-10 h-10 text-neon-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Audit complete!</h2>
            <p className="text-gray-400 mb-6">Loading your report{dots}</p>
            {jobStatus?.ship_score !== undefined && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-dark-700 rounded-full border border-dark-400">
                <span className="font-mono-brand font-bold text-2xl"
                  style={{ color: jobStatus.ship_score >= 70 ? '#00FF88' : jobStatus.ship_score >= 50 ? '#FFD60A' : '#FF3B30' }}>
                  {jobStatus.ship_score}
                </span>
                <span className="text-gray-400 text-sm">ShipScore</span>
              </div>
            )}
          </div>
        ) : status === 'failed' ? (
          /* Failed state */
          <div>
            <div className="w-20 h-20 rounded-full bg-red-500/15 border-2 border-red-500/50 flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Audit failed</h2>
            <p className="text-gray-400 text-sm mb-2">
              {jobStatus?.error_message || 'An unexpected error occurred.'}
            </p>
            <p className="text-gray-600 text-xs mb-6">
              This is often caused by network issues or a URL that is not publicly accessible.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/audit/new" className="px-5 py-2.5 bg-neon-green text-dark-900 font-bold text-sm rounded-lg hover:bg-neon-green-dim transition-colors">
                Try again
              </Link>
              <Link href="/dashboard" className="px-5 py-2.5 border border-dark-400 text-gray-300 text-sm rounded-lg hover:border-dark-300 transition-colors">
                Dashboard
              </Link>
            </div>
          </div>
        ) : (
          /* Running / queued state */
          <div>
            {/* Spinner */}
            <div className="relative w-24 h-24 mx-auto mb-8">
              <svg className="w-full h-full -rotate-90 animate-spin" style={{ animationDuration: '2s' }} viewBox="0 0 96 96">
                <circle cx="48" cy="48" r="40" fill="none" stroke="#222222" strokeWidth="6" />
                <circle
                  cx="48" cy="48" r="40" fill="none" stroke="#00FF88" strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 40 * 0.25} ${2 * Math.PI * 40 * 0.75}`}
                  style={{ filter: 'drop-shadow(0 0 6px #00FF8880)' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="font-mono text-xs text-neon-green">
                    {status === 'queued' ? 'QUEUED' : 'RUNNING'}
                  </div>
                </div>
              </div>
            </div>

            <h2 className="text-xl font-bold text-white mb-3">
              {status === 'queued' ? 'Queued for processing' : 'Audit in progress'}
            </h2>

            <div className="h-8 flex items-center justify-center mb-6">
              <p className="text-gray-400 text-sm font-mono transition-all">
                {currentMessage}
                <span className="text-neon-green">{dots}</span>
              </p>
            </div>

            {elapsed && (
              <div className="text-xs text-gray-600 font-mono mb-8">
                {status === 'running' ? 'Elapsed: ' : 'Waiting: '}{elapsed}
              </div>
            )}

            {/* Progress steps */}
            <div className="text-left border border-dark-500 bg-dark-800 rounded-xl p-5 space-y-3 mb-6">
              {[
                { label: 'Playwright: functional + link testing', done: status !== 'queued' },
                { label: 'axe-core: accessibility audit', done: status !== 'queued' },
                { label: 'Lighthouse: performance', done: status !== 'queued' },
                { label: 'Security surface scan', done: status !== 'queued' },
                { label: 'Claude AI: analysis + report generation', done: false },
              ].map(({ label, done }, i) => (
                <div key={i} className="flex items-center gap-3 text-xs">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${
                    done ? 'bg-neon-green/20 border border-neon-green/50' : 'bg-dark-600 border border-dark-500'
                  }`}>
                    {done ? (
                      <svg className="w-2.5 h-2.5 text-neon-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-dark-400" />
                    )}
                  </div>
                  <span className={done ? 'text-gray-300' : 'text-gray-600'}>{label}</span>
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-600">
              This page refreshes automatically. You can safely close it and check back from your{' '}
              <Link href="/dashboard" className="text-gray-400 hover:text-white underline">
                dashboard
              </Link>.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
