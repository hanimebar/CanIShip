import Link from 'next/link'
import Image from 'next/image'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const differentiators = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
    title: 'Zero setup',
    description: 'No SDK, no browser extension, no CI/CD. Just paste a URL.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    ),
    title: 'Plain English in, plain English out',
    description: 'Describe your app like a friend. Get a report you can actually act on.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Bulletproof QA, not vibes',
    description: 'Functional tests, accessibility, performance, security, broken links — in one run.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: 'Risk + Rewards + Roadmap',
    description: "Not just a bug list. What's working, what could blow up, and what to build next.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    title: 'Built for solo builders',
    description: "Not for QA teams. Not for enterprises. For people who ship alone and need an honest friend.",
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Priced for humans',
    description: 'Not $500/month. Not enterprise pricing. From €19.',
  },
]

const auditLayers = [
  { color: '#FF3B30', label: 'Functional Tests', detail: 'Playwright navigates every flow and catches broken interactions' },
  { color: '#FF9500', label: 'UX Issues', detail: 'Confusing flows, dead ends, missing states — caught and reported' },
  { color: '#AF52DE', label: 'Accessibility (WCAG 2.1)', detail: 'axe-core injection catches every violation with severity rating' },
  { color: '#0A84FF', label: 'Performance (Core Web Vitals)', detail: 'Lighthouse LCP, CLS, FCP — against real targets' },
  { color: '#CC0000', label: 'Security Surface Scan', detail: 'Missing headers, HTTPS issues, exposed data in source' },
  { color: '#FFD60A', label: 'Broken Links + Network', detail: "Every link checked, every API call logged — silent 500s don't hide" },
]

export default async function LandingPage() {
  // Check auth state server-side so nav reflects login status
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  )
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-dark-900 text-white">

      {/* Nav */}
      <nav className="border-b border-dark-600 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center">
            <Image src="/logo.svg" alt="CanIShip" width={160} height={36} priority />
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/pricing" className="text-sm text-gray-400 hover:text-white transition-colors">
              Pricing
            </Link>
            {user ? (
              <>
                <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">
                  Dashboard
                </Link>
                <Link
                  href="/audit/new"
                  className="px-4 py-2 bg-neon-green text-dark-900 font-bold text-sm rounded-lg hover:bg-neon-green-dim transition-colors font-mono-brand"
                >
                  + New Audit
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="text-sm text-gray-400 hover:text-white transition-colors">
                  Login
                </Link>
                <Link
                  href="/signup"
                  className="px-4 py-2 bg-neon-green text-dark-900 font-bold text-sm rounded-lg hover:bg-neon-green-dim transition-colors font-mono-brand"
                >
                  Get started free
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-20 pb-16 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-neon-green/30 bg-neon-green/10 text-neon-green text-xs font-mono mb-8">
            <span className="w-1.5 h-1.5 bg-neon-green rounded-full animate-pulse" />
            AI-powered QA for solo builders
          </div>

          <h1 className="font-mono-brand font-black text-5xl md:text-7xl mb-6 leading-none tracking-tight">
            <span className="text-neon-green text-glow-green">Can</span>
            <span className="text-white">IShip</span>
            <span className="text-gray-500">?</span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-300 mb-4 leading-relaxed max-w-2xl mx-auto">
            Paste your URL. Get your{' '}
            <span className="text-neon-green font-semibold">ShipScore</span>.
            Know exactly what to fix before real users find it.
          </p>

          <p className="text-gray-500 mb-10 max-w-xl mx-auto">
            Bulletproof QA in minutes — functional tests, accessibility, performance, security.
            Written like a senior developer reviewed your app, not a bureaucratic QA form.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className="px-8 py-4 bg-neon-green text-dark-900 font-bold text-lg rounded-xl hover:bg-neon-green-dim transition-all glow-green font-mono-brand tracking-wide"
            >
              Run your first audit free →
            </Link>
            <Link
              href="/pricing"
              className="px-8 py-4 border border-dark-400 text-gray-300 font-semibold text-lg rounded-xl hover:border-dark-300 hover:text-white transition-colors"
            >
              See pricing
            </Link>
          </div>

          <p className="text-xs text-gray-600 mt-4">No credit card required · 3 free audits/month</p>
        </div>
      </section>

      {/* ShipScore demo visual */}
      <section className="px-6 py-12">
        <div className="max-w-3xl mx-auto">
          <div className="rounded-2xl border border-dark-500 bg-dark-800 p-8 font-mono text-sm">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span className="ml-2 text-gray-600 text-xs">CanIShip Audit Report</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              {/* Mock score */}
              <div className="flex flex-col items-center">
                <div className="relative w-32 h-32">
                  <svg viewBox="0 0 120 120" className="-rotate-90 w-full h-full">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="#222" strokeWidth="10" />
                    <circle cx="60" cy="60" r="50" fill="none" stroke="#00FF88" strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 50}`}
                      strokeDashoffset={`${2 * Math.PI * 50 * (1 - 0.73)}`}
                      style={{ filter: 'drop-shadow(0 0 6px #00FF8860)' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-bold text-3xl text-neon-green">73</span>
                    <span className="text-xs text-gray-500">/100</span>
                  </div>
                </div>
                <div className="text-neon-green font-bold mt-2 tracking-wide">Almost there</div>
              </div>

              {/* Mock issues */}
              <div className="col-span-2 space-y-2 text-xs">
                {[
                  { color: '#FF3B30', label: 'CRITICAL', text: 'Login form fails on mobile Safari' },
                  { color: '#FF9500', label: 'UX', text: 'Success state missing after form submit' },
                  { color: '#AF52DE', label: 'A11Y', text: '3 images missing alt text (WCAG 2.1 AA)' },
                  { color: '#0A84FF', label: 'PERF', text: 'LCP: 4200ms (target: <2500ms)' },
                  { color: '#00FF88', label: 'PASS', text: 'Navigation works end-to-end' },
                ].map(({ color, label, text }) => (
                  <div key={label} className="flex items-center gap-2 py-1.5 border-b border-dark-600 last:border-0">
                    <span className="font-bold text-xs px-1.5 py-0.5 rounded"
                      style={{ color, backgroundColor: color + '20' }}>
                      {label}
                    </span>
                    <span className="text-gray-300">{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What gets audited */}
      <section className="px-6 py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-3">
            Six audit layers. One report.
          </h2>
          <p className="text-gray-400 text-center mb-12 max-w-xl mx-auto">
            Every CanIShip audit runs all six QA layers in sequence — the same checks a senior engineer would run before releasing.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {auditLayers.map(({ color, label, detail }) => (
              <div
                key={label}
                className="flex items-start gap-4 rounded-xl border border-dark-500 bg-dark-800 p-5 hover:border-dark-400 transition-colors"
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                  style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}60` }}
                />
                <div>
                  <div className="font-semibold text-white mb-1" style={{ color }}>{label}</div>
                  <div className="text-sm text-gray-400 leading-relaxed">{detail}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Differentiators */}
      <section className="px-6 py-16 border-t border-dark-700">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-3">
            Why CanIShip is different
          </h2>
          <p className="text-gray-400 text-center mb-12 max-w-xl mx-auto">
            Built for the builder who ships alone and needs a rigorous, honest technical friend.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {differentiators.map(({ icon, title, description }) => (
              <div key={title} className="rounded-xl border border-dark-500 bg-dark-800 p-6 hover:border-neon-green/20 transition-colors">
                <div className="text-neon-green mb-3">{icon}</div>
                <h3 className="font-bold text-white mb-2">{title}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing preview */}
      <section className="px-6 py-16 border-t border-dark-700">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold mb-3">Priced for real builders</h2>
          <p className="text-gray-400 mb-10">Not $500/month. Not enterprise pricing. Simple, honest plans.</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                name: 'Free',
                price: '€0',
                period: 'forever',
                features: ['3 audits/month', 'Quick Scan only', 'Basic report'],
                cta: 'Start free',
                href: '/signup',
                highlight: false,
              },
              {
                name: 'Builder',
                price: '€19',
                period: '/month',
                features: ['10 audits/month', 'All scan depths', 'Full reports', 'Audit history'],
                cta: 'Start Building',
                href: '/signup',
                highlight: true,
              },
              {
                name: 'Studio',
                price: '€49',
                period: '/month',
                features: ['Unlimited audits', 'All Builder features', 'Docker self-hosted', 'API access'],
                cta: 'Go Studio',
                href: '/signup',
                highlight: false,
              },
            ].map(({ name, price, period, features, cta, href, highlight }) => (
              <div
                key={name}
                className={`rounded-2xl border p-6 text-left relative ${
                  highlight
                    ? 'border-neon-green/40 bg-neon-green/5'
                    : 'border-dark-500 bg-dark-800'
                }`}
              >
                {highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-3 py-1 bg-neon-green text-dark-900 text-xs font-bold rounded-full font-mono">
                      MOST POPULAR
                    </span>
                  </div>
                )}
                <div className="mb-4">
                  <div className="text-sm text-gray-400 mb-1">{name}</div>
                  <div className="flex items-baseline gap-1">
                    <span className="font-mono-brand font-black text-3xl text-white">{price}</span>
                    <span className="text-gray-500 text-sm">{period}</span>
                  </div>
                </div>
                <ul className="space-y-2 mb-6">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-300">
                      <svg className="w-4 h-4 text-neon-green flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={href}
                  className={`block text-center py-2.5 px-4 rounded-lg font-bold text-sm transition-colors ${
                    highlight
                      ? 'bg-neon-green text-dark-900 hover:bg-neon-green-dim'
                      : 'border border-dark-400 text-white hover:border-dark-300'
                  }`}
                >
                  {cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 border-t border-dark-700 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-mono-brand font-black text-4xl md:text-5xl text-white mb-4">
            Stop shipping blind.
          </h2>
          <p className="text-gray-400 mb-8 text-lg">
            Your next user is judging your app in the first 8 seconds. Know what they will find before they do.
          </p>
          <Link
            href="/signup"
            className="inline-block px-10 py-5 bg-neon-green text-dark-900 font-bold text-xl rounded-xl hover:bg-neon-green-dim transition-all glow-green font-mono-brand"
          >
            Get your ShipScore free →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-dark-700 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-600">
          <div className="font-mono-brand font-bold text-gray-500">CanIShip</div>
          <div className="flex items-center gap-6">
            <Link href="/pricing" className="hover:text-gray-400 transition-colors">Pricing</Link>
            <Link href="/login" className="hover:text-gray-400 transition-colors">Login</Link>
            <Link href="/signup" className="hover:text-gray-400 transition-colors">Sign up</Link>
          </div>
          <div>A product by Actvli Responsible Consulting</div>
        </div>
      </footer>
    </div>
  )
}
