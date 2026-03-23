'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type Depth = 'quick' | 'standard' | 'deep'
type TargetPlatform = 'mobile' | 'desktop' | 'all'

const platformOptions: Array<{
  value: TargetPlatform
  label: string
  icon: string
  description: string
}> = [
  {
    value: 'mobile',
    label: 'Mobile-first',
    icon: '📱',
    description: 'Primarily used on phones & tablets (≤768px)',
  },
  {
    value: 'all',
    label: 'All screens',
    icon: '🌐',
    description: 'Must work everywhere — mobile and desktop',
  },
  {
    value: 'desktop',
    label: 'Desktop / Web app',
    icon: '🖥️',
    description: 'Primarily used on laptops & desktops (≥1024px)',
  },
]

const depthOptions: Array<{
  value: Depth
  label: string
  duration: string
  description: string
  plan: string[]
}> = [
  {
    value: 'quick',
    label: 'Quick Scan',
    duration: '~5 min',
    description: 'Functional check, broken links, console errors, accessibility overview',
    plan: ['free', 'builder', 'studio'],
  },
  {
    value: 'standard',
    label: 'Standard Check',
    duration: '~15 min',
    description: 'Full functional testing, complete axe audit, Lighthouse performance, security scan',
    plan: ['builder', 'studio'],
  },
  {
    value: 'deep',
    label: 'Deep Audit',
    duration: '~30 min',
    description: 'Everything in Standard plus multi-page crawl, mobile responsiveness, full security surface',
    plan: ['builder', 'studio'],
  },
]

type Props = {
  userPlan?: string
  defaultUrl?: string
  defaultDescription?: string
  defaultFlows?: string
  defaultDepth?: Depth
  defaultPlatform?: TargetPlatform
}

export function AuditForm({ userPlan = 'free', defaultUrl = '', defaultDescription = '', defaultFlows = '', defaultDepth = 'quick', defaultPlatform = 'all' }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [url, setUrl] = useState(defaultUrl)
  const [description, setDescription] = useState(defaultDescription)
  const [flows, setFlows] = useState(defaultFlows)
  const [depth, setDepth] = useState<Depth>(defaultDepth)
  const [platform, setPlatform] = useState<TargetPlatform>(defaultPlatform)
  const [isPublic, setIsPublic] = useState(true)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const canSelectDepth = (d: Depth) => {
    const option = depthOptions.find((o) => o.value === d)
    return option?.plan.includes(userPlan) ?? false
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!url.trim()) {
      setError('Please enter a URL')
      return
    }
    if (!description.trim() || description.trim().length < 10) {
      setError('Please describe your app (at least 10 characters)')
      return
    }

    // Normalize URL
    let normalizedUrl = url.trim()
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl
    }

    try {
      new URL(normalizedUrl)
    } catch {
      setError('Please enter a valid URL (e.g. https://myapp.com)')
      return
    }

    setIsSubmitting(true)

    try {
      const flowList = flows
        .split('\n')
        .map((f) => f.trim())
        .filter((f) => f.length > 0)

      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: normalizedUrl,
          description: description.trim(),
          flows: flowList,
          depth,
          target_platform: platform,
          is_public: isPublic,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 429) {
          setError(`Monthly limit reached (${data.limit} audits/month on ${data.plan} plan). Upgrade to continue.`)
        } else {
          setError(data.error || 'Failed to start audit')
        }
        return
      }

      // Redirect to polling page
      startTransition(() => {
        router.push(`/audit/${data.job_id}/status`)
      })
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* URL Input */}
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">
          App URL <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-app.com"
            className="w-full pl-9 pr-4 py-3 bg-dark-700 border border-dark-400 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-neon-green focus:ring-1 focus:ring-neon-green font-mono text-sm transition-colors"
            disabled={isSubmitting}
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-2">
          What does this app do? <span className="text-red-400">*</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={'Describe it like you\'d explain to a friend:\n"It\'s a task manager. Users sign up, create tasks, assign due dates, mark them done, and delete them."'}
          rows={4}
          className="w-full px-4 py-3 bg-dark-700 border border-dark-400 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-neon-green focus:ring-1 focus:ring-neon-green text-sm resize-none transition-colors"
          disabled={isSubmitting}
        />
        <div className="text-xs text-gray-600 mt-1 text-right">
          {description.length} chars {description.length < 10 && description.length > 0 && (
            <span className="text-orange-400">(min 10)</span>
          )}
        </div>
      </div>

      {/* Target platform */}
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-1">
          Primary target device
        </label>
        <p className="text-xs text-gray-500 mb-3">
          Affects how mobile responsiveness is weighted in your score.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {platformOptions.map((option) => {
            const selected = platform === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setPlatform(option.value)}
                disabled={isSubmitting}
                className={`p-3 rounded-lg border text-left transition-all ${
                  selected
                    ? 'border-neon-green bg-neon-green/10'
                    : 'border-dark-400 bg-dark-700 hover:border-dark-300'
                }`}
              >
                <div className="text-xl mb-1">{option.icon}</div>
                <div className={`font-semibold text-xs mb-0.5 ${selected ? 'text-neon-green' : 'text-white'}`}>
                  {option.label}
                </div>
                <div className="text-xs text-gray-500 leading-relaxed">{option.description}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Optional flows */}
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-1">
          Specific flows to test{' '}
          <span className="text-gray-600 font-normal">(optional)</span>
        </label>
        <p className="text-xs text-gray-500 mb-2">
          One per line. E.g: &quot;Make sure checkout works&quot; or &quot;Test the password reset flow&quot;
        </p>
        <textarea
          value={flows}
          onChange={(e) => setFlows(e.target.value)}
          placeholder={'Make sure checkout works\nTest the password reset flow\nVerify the dashboard loads after login'}
          rows={3}
          className="w-full px-4 py-3 bg-dark-700 border border-dark-400 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-neon-green/50 focus:ring-1 focus:ring-neon-green/50 text-sm resize-none transition-colors font-mono"
          disabled={isSubmitting}
        />
      </div>

      {/* Depth selector */}
      <div>
        <label className="block text-sm font-semibold text-gray-300 mb-3">
          Scan depth
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {depthOptions.map((option) => {
            const available = canSelectDepth(option.value)
            const selected = depth === option.value

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => available && setDepth(option.value)}
                disabled={!available || isSubmitting}
                className={`relative p-4 rounded-lg border text-left transition-all ${
                  selected
                    ? 'border-neon-green bg-neon-green/10'
                    : available
                    ? 'border-dark-400 bg-dark-700 hover:border-dark-300'
                    : 'border-dark-600 bg-dark-800 opacity-50 cursor-not-allowed'
                }`}
              >
                {!available && (
                  <span className="absolute top-2 right-2 text-xs bg-dark-500 text-gray-400 px-1.5 py-0.5 rounded font-mono">
                    Builder+
                  </span>
                )}
                <div className={`font-semibold text-sm mb-0.5 ${selected ? 'text-neon-green' : 'text-white'}`}>
                  {option.label}
                </div>
                <div className="text-xs text-gray-500 mb-1">{option.duration}</div>
                <div className="text-xs text-gray-400 leading-relaxed">{option.description}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-400 text-sm flex items-start gap-2">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      {/* Leaderboard opt-in */}
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={e => setIsPublic(e.target.checked)}
          className="w-4 h-4 rounded accent-neon-green cursor-pointer"
        />
        <span className="text-sm text-gray-400">
          Include in <a href="/leaderboard" className="text-neon-green hover:underline" target="_blank" rel="noopener noreferrer">public leaderboard</a>
        </span>
      </label>

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting || isPending}
        className="w-full py-4 px-6 bg-neon-green text-dark-900 font-bold text-base rounded-lg hover:bg-neon-green-dim transition-colors disabled:opacity-60 disabled:cursor-not-allowed font-mono-brand tracking-wide"
      >
        {isSubmitting || isPending ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Launching audit...
          </span>
        ) : (
          'Run Audit →'
        )}
      </button>

      <p className="text-xs text-center text-gray-600">
        {userPlan === 'free'
          ? 'Free tier: 3 audits/month, Quick Scan only.'
          : `${userPlan.charAt(0).toUpperCase() + userPlan.slice(1)} plan: full access.`}
      </p>
    </form>
  )
}
