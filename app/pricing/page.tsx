'use client'

import Link from 'next/link'
import { useState, type ReactNode } from 'react'

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Try it out. No credit card, no commitment.',
    features: [
      { text: '3 audits per month', included: true },
      { text: 'Quick Scan only (~5 min)', included: true },
      { text: 'Basic report (bugs, console errors)', included: true },
      { text: 'Broken link detection', included: true },
      { text: 'Risk & Rewards analysis', included: false },
      { text: 'Future Recommendations', included: false },
      { text: 'Standard & Deep scans', included: false },
      { text: 'Audit history', included: false },
      { text: 'Full Lighthouse performance audit', included: false },
    ],
    cta: 'Start free',
    href: '/signup',
    highlight: false,
    stripePlan: null,
  },
  {
    id: 'builder',
    name: 'Builder',
    price: '€19',
    period: '/month',
    description: 'For serious builders who ship regularly.',
    features: [
      { text: '15 audits per month', included: true },
      { text: 'Quick, Standard, and Deep scans', included: true },
      { text: 'Full reports — every category', included: true },
      { text: 'Risk & Rewards analysis', included: true },
      { text: 'Future Recommendations', included: true },
      { text: 'Audit history & comparison', included: true },
      { text: 'Full Lighthouse performance audit', included: true },
      { text: 'Security surface scan', included: true },
      { text: 'Docker self-hosted', included: false },
    ],
    cta: 'Start Building',
    href: null,
    highlight: true,
    stripePlan: 'builder',
  },
  {
    id: 'studio',
    name: 'Studio',
    price: '€49',
    period: '/month',
    description: 'Unlimited audits. Run CanIShip on your own infra.',
    features: [
      { text: 'Unlimited audits', included: true },
      { text: 'All Builder features', included: true },
      { text: 'Docker self-hosted image', included: true },
      { text: 'API access', included: true },
      { text: 'White-label reports (coming soon)', included: true },
      { text: 'Team sharing (coming soon)', included: true },
      { text: 'Priority support', included: true },
      { text: 'Custom integrations', included: true },
      { text: 'SLA guarantee', included: false },
    ],
    cta: 'Go Studio',
    href: null,
    highlight: false,
    stripePlan: 'studio',
  },
]

type Faq = { q: string; a: string | ReactNode }

const faqs: Faq[] = [
  {
    q: 'What happens when I hit my monthly audit limit?',
    a: "You'll see a friendly message and a link to upgrade. Your existing reports remain accessible.",
  },
  {
    q: 'Can I audit any URL?',
    a: 'Yes — any publicly accessible URL. Private apps behind auth require you to share test credentials in the flow description (we recommend creating a dedicated test account).',
  },
  {
    q: 'What is the Docker self-hosted option and why does it exist?',
    a: (
      <>
        <span className="block mb-2">
          The Docker image is the full CanIShip audit engine packaged to run on your own machine or server.
          We built it because a lot of real work happens before anything goes public — staging environments behind VPNs,
          local builds, internal tools where sending URLs to a third-party cloud isn&apos;t acceptable.
        </span>
        <span className="block mb-2">
          When you run it locally, nothing leaves your network. Audit data stays in a volume you control.
          The only outbound call is a license check back to us once every 24 hours — after that it works fully offline.
        </span>
        <span className="block mb-2">
          It&apos;s also the way to add CanIShip to a CI/CD pipeline — set <code className="font-mono text-gray-300">MIN_SCORE=75</code> and
          your GitHub Actions build fails automatically if quality drops.
        </span>
        <Link href="/docker" className="text-neon-green hover:underline text-xs font-medium">
          Full setup guide →
        </Link>
      </>
    ),
  },
  {
    q: 'How accurate is the ShipScore?',
    a: 'The score is calculated from real findings — Playwright, axe-core, Lighthouse, security probes, and flow execution results — using a fixed weighted formula. It is honest, not optimistic. A score above 85 means no critical issues were found.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Cancel from your dashboard. You keep Builder/Studio access until the end of your billing period, then roll back to Free.',
  },
]

export default function PricingPage() {
  const [isLoading, setIsLoading] = useState<string | null>(null)

  async function handleUpgrade(plan: string) {
    setIsLoading(plan)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })

      if (res.status === 401) {
        window.location.href = '/login?next=/pricing'
        return
      }

      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      alert('Something went wrong. Please try again.')
    } finally {
      setIsLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-dark-900 text-white">

      {/* Nav */}
      <nav className="border-b border-dark-600 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-mono-brand font-bold text-neon-green text-xl">
            CanIShip
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors">
              Login
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 bg-neon-green text-dark-900 font-bold text-sm rounded-lg hover:bg-neon-green-dim transition-colors font-mono-brand"
            >
              Sign up free
            </Link>
          </div>
        </div>
      </nav>

      {/* Header */}
      <div className="text-center px-6 pt-16 pb-12">
        <h1 className="font-mono-brand font-black text-4xl md:text-5xl text-white mb-4">
          Honest pricing.
        </h1>
        <p className="text-xl text-gray-400 max-w-xl mx-auto">
          Built for solo builders. Not enterprises, not QA teams, not people with big budgets.
        </p>
      </div>

      {/* Plans */}
      <div className="max-w-6xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`rounded-2xl border p-8 relative ${
                plan.highlight
                  ? 'border-neon-green/40 bg-neon-green/5'
                  : 'border-dark-500 bg-dark-800'
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-4 inset-x-0 flex justify-center">
                  <span className="px-4 py-1.5 bg-neon-green text-dark-900 text-xs font-bold rounded-full font-mono">
                    MOST POPULAR
                  </span>
                </div>
              )}

              <div className="mb-6">
                <div className="text-sm font-mono text-gray-400 mb-2">{plan.name}</div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="font-mono-brand font-black text-4xl text-white">{plan.price}</span>
                  <span className="text-gray-500">{plan.period}</span>
                </div>
                <p className="text-sm text-gray-400">{plan.description}</p>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    {f.included ? (
                      <svg className="w-4 h-4 text-neon-green flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    <span className={f.included ? 'text-gray-200' : 'text-gray-600'}>
                      {f.text}
                    </span>
                  </li>
                ))}
              </ul>

              {plan.href ? (
                <Link
                  href={plan.href}
                  className={`block text-center py-3 px-4 rounded-xl font-bold text-sm transition-colors ${
                    plan.highlight
                      ? 'bg-neon-green text-dark-900 hover:bg-neon-green-dim'
                      : 'border border-dark-400 text-white hover:border-dark-300'
                  }`}
                >
                  {plan.cta}
                </Link>
              ) : (
                <button
                  onClick={() => plan.stripePlan && handleUpgrade(plan.stripePlan)}
                  disabled={isLoading === plan.stripePlan}
                  className={`w-full py-3 px-4 rounded-xl font-bold text-sm transition-colors disabled:opacity-60 ${
                    plan.highlight
                      ? 'bg-neon-green text-dark-900 hover:bg-neon-green-dim'
                      : 'border border-dark-400 text-white hover:border-dark-300'
                  }`}
                >
                  {isLoading === plan.stripePlan ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Loading...
                    </span>
                  ) : plan.cta}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-3xl mx-auto px-6 pb-20">
        <h2 className="text-2xl font-bold text-center mb-10">Common questions</h2>
        <div className="space-y-6">
          {faqs.map(({ q, a }) => (
            <div key={q} className="rounded-xl border border-dark-500 bg-dark-800 p-6">
              <h3 className="font-semibold text-white mb-2">{q}</h3>
              <div className="text-gray-400 text-sm leading-relaxed">{a}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-dark-700 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-wrap justify-center gap-6 text-sm text-gray-600">
          <Link href="/" className="hover:text-gray-400 transition-colors">Back to home</Link>
          <Link href="/privacy" className="hover:text-gray-400 transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-gray-400 transition-colors">Terms of Service</Link>
          <Link href="/cookie-policy" className="hover:text-gray-400 transition-colors">Cookie Policy</Link>
        </div>
      </footer>
    </div>
  )
}
