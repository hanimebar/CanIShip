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

function ShipLoader({ status }: { status: string }) {
  return (
    <div className="relative mx-auto mb-8" style={{ width: 160, height: 110 }}>
      {/* Rocking ship */}
      <div style={{ animation: 'shipRock 3.2s ease-in-out infinite', transformOrigin: '50% 90%' }}>
        <svg viewBox="0 0 100 78" width="160" height="124" aria-hidden>

          {/* Smoke puffs from funnel */}
          <circle cx="30" cy="14" r="3.5" fill="#33291D"
            style={{ animation: 'smokeRise 2.2s ease-out infinite', transformOrigin: '30px 14px' }} />
          <circle cx="32" cy="7" r="2.5" fill="#261E15"
            style={{ animation: 'smokeRise 2.2s ease-out infinite 0.7s', transformOrigin: '32px 7px' }} />
          <circle cx="28" cy="2" r="1.8" fill="#1A1510"
            style={{ animation: 'smokeRise 2.2s ease-out infinite 1.4s', transformOrigin: '28px 2px' }} />

          {/* Funnel */}
          <rect x="26" y="20" width="9" height="13" rx="1" fill="#1A1510" stroke="#33291D" strokeWidth="0.5" />
          <rect x="24" y="18" width="13" height="4" rx="1" fill="#4A3C2A" />

          {/* Bridge / cabin */}
          <rect x="14" y="28" width="26" height="16" rx="1.5" fill="#261E15" stroke="#4A3C2A" strokeWidth="0.6" />
          {/* Bridge windows */}
          <rect x="17" y="31" width="5" height="4" rx="0.8" fill="#F5A623" opacity="0.55" />
          <rect x="24" y="31" width="5" height="4" rx="0.8" fill="#F5A623" opacity="0.35" />
          <rect x="31" y="31" width="5" height="4" rx="0.8" fill="#F5A623" opacity="0.2" />

          {/* Mast */}
          <rect x="20" y="10" width="2.5" height="20" rx="1" fill="#6B5540" />
          {/* Flag — flutters around its left edge */}
          <path
            d="M22.5 10 L36 16 L22.5 22 Z"
            fill="#F5A623"
            style={{
              transformBox: 'fill-box',
              transformOrigin: 'left center',
              animation: 'flagFlutter 1.8s ease-in-out infinite',
            }}
          />

          {/* Cargo boxes */}
          <rect x="42" y="32" width="16" height="12" rx="0.5" fill="#C4821A" stroke="#B87300" strokeWidth="0.5" />
          <line x1="42" y1="38" x2="58" y2="38" stroke="#B87300" strokeWidth="0.5" opacity="0.6" />
          <line x1="50" y1="32" x2="50" y2="44" stroke="#B87300" strokeWidth="0.5" opacity="0.6" />

          <rect x="60" y="32" width="16" height="12" rx="0.5" fill="#33291D" stroke="#4A3C2A" strokeWidth="0.5" />
          <line x1="60" y1="38" x2="76" y2="38" stroke="#4A3C2A" strokeWidth="0.5" opacity="0.7" />

          <rect x="78" y="36" width="10" height="8" rx="0.5" fill="#4A3C2A" stroke="#6B5540" strokeWidth="0.5" />

          {/* Deck */}
          <rect x="10" y="44" width="82" height="7" fill="#33291D" stroke="#4A3C2A" strokeWidth="0.5" />

          {/* Hull */}
          <path d="M6 51 L2 64 L96 64 L94 51 Z" fill="#1A1510" stroke="#4A3C2A" strokeWidth="0.8" />
          {/* Hull waterline stripe */}
          <path d="M5 57 L3 64 L95 64 L95 57 Z" fill="#261E15" />
          {/* Bow highlight */}
          <path d="M90 51 L94 51 L93 57" fill="#33291D" />
        </svg>
      </div>

      {/* Animated waves */}
      <div className="absolute bottom-0 left-0 right-0 overflow-hidden" style={{ height: 20 }}>
        <svg viewBox="0 0 160 20" width="160" height="20" aria-hidden>
          <path
            d="M0 12 Q20 6 40 12 Q60 18 80 12 Q100 6 120 12 Q140 18 160 12"
            fill="none" stroke="#4A3C2A" strokeWidth="1.8"
            style={{ animation: 'waveDrift 2.4s ease-in-out infinite' }}
          />
          <path
            d="M0 16 Q20 10 40 16 Q60 22 80 16 Q100 10 120 16 Q140 22 160 16"
            fill="none" stroke="#33291D" strokeWidth="1.2"
            style={{ animation: 'waveDrift2 3s ease-in-out infinite' }}
          />
        </svg>
      </div>

      {/* Status badge */}
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap">
        <span className="stamp stamp-amber text-[0.6rem] px-2 py-0.5" style={{ transform: 'rotate(-1.5deg)' }}>
          {status === 'queued' ? 'AWAITING BERTH' : 'UNDER INSPECTION'}
        </span>
      </div>
    </div>
  )
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
        <div className="mb-12 flex justify-center">
          <img src="/logo.svg" alt="CanIShip" style={{ height: 36, width: 'auto' }} />
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
            <ShipLoader status={status || 'queued'} />

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
