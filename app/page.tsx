import Link from 'next/link'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

const auditLayers = [
  { code: 'FT',  label: 'Functional Tests',            detail: 'Playwright navigates every declared flow. Unresponsive controls, dead ends, and broken redirects are logged with screenshot evidence.' },
  { code: 'UX',  label: 'UX Friction',                 detail: 'Missing loading states, absent error messages, silent failures — friction that does not break the app but breaks the user.' },
  { code: 'A11', label: 'Accessibility (WCAG 2.1 AA)', detail: 'axe-core injection across all pages. Violations are classified by severity with WCAG criterion reference and remediation.' },
  { code: 'PF',  label: 'Performance (Core Web Vitals)',detail: 'Lighthouse against LCP, CLS, FCP, TBT, INP. Render-blocking resources, unoptimised assets, and Time to Interactive flagged.' },
  { code: 'SEC', label: 'Security Surface',             detail: 'OWASP headers audit. Routes accessible without authentication. Sensitive data in source or URL. Mixed content and HTTPS enforcement.' },
  { code: 'LNK', label: 'Broken Links & Network',      detail: 'Every internal href crawled. All network responses monitored via Playwright intercept — 4xx/5xx that the UI silently swallows.' },
  { code: 'SEO', label: 'SEO Health',                  detail: 'Title, meta description, canonical, Open Graph, sitemap.xml, robots.txt — every signal search engines use to index or reject.' },
  { code: 'MOB', label: 'Mobile Readiness',            detail: 'Real 375px viewport. Horizontal overflow, unclickable touch targets, missing viewport meta, and layout breaks at WCAG 2.5.5.' },
]

const differentiatorsRows = [
  { field: 'Setup required',      caniship: 'None. Paste a URL.',    others: 'SDK, CLI, or browser extension' },
  { field: 'Input',               caniship: 'Plain English + URL',   others: 'YAML config or code annotations' },
  { field: 'Output',              caniship: 'Report a founder reads', others: 'Report a QA team reads' },
  { field: 'Covers',              caniship: '8 audit layers in one',  others: 'Usually 1–2 layers per tool' },
  { field: 'Risk + Rewards',      caniship: 'Included',              others: 'Not included' },
  { field: 'Forward roadmap',     caniship: 'Included',              others: 'Not included' },
  { field: 'Price',               caniship: 'From €0',               others: 'From $49–$500/month' },
]

export default async function LandingPage() {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  )
  const { data: { user } } = await supabase.auth.getUser()

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  }).toUpperCase()

  return (
    <div className="min-h-screen bg-dock-900 text-dock-100" style={{ fontFamily: "'Special Elite', 'Courier New', monospace" }}>

      {/* ── Masthead ─────────────────────────────────────────── */}
      <header className="border-b-4 border-dock-100 pt-6 pb-0 px-6">
        <div className="max-w-6xl mx-auto">

          {/* Top strip */}
          <div className="flex items-center justify-between border-b border-dock-600 pb-2 mb-4">
            <span className="text-dock-400 text-xs tracking-widest uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              PORT AUTHORITY · CARGO INSPECTION DIVISION
            </span>
            <span className="text-dock-400 text-xs tracking-widest" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              {today}
            </span>
            <span className="text-dock-400 text-xs tracking-widest uppercase" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              Est. 2026 · Vol. I
            </span>
          </div>

          {/* Nameplate */}
          <div className="text-center py-4 border-b-2 border-dock-100 mb-4">
            <h1
              className="text-dock-50 leading-none tracking-tight"
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: 'clamp(3rem, 10vw, 7rem)',
                fontWeight: 900,
                letterSpacing: '-0.02em',
              }}
            >
              CanIShip
            </h1>
            <p
              className="text-dock-300 mt-1 tracking-widest text-xs uppercase"
              style={{ fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: '0.3em' }}
            >
              The Pre-Launch Cargo Inspection Authority for Web Applications
            </p>
          </div>

          {/* Nav strip */}
          <div className="flex items-center justify-between pb-3">
            <nav className="flex items-center gap-6 text-xs uppercase tracking-widest text-dock-400" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              <Link href="/pricing" className="hover:text-dock-100 transition-colors">Pricing</Link>
              <span className="text-dock-700">·</span>
              <Link href="#how-it-works" className="hover:text-dock-100 transition-colors">How It Works</Link>
              <span className="text-dock-700">·</span>
              <Link href="#standards" className="hover:text-dock-100 transition-colors">Standards</Link>
            </nav>
            <div className="flex items-center gap-3">
              {user ? (
                <>
                  <Link href="/dashboard" className="text-xs uppercase tracking-widest text-dock-400 hover:text-dock-100 transition-colors" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                    Dashboard
                  </Link>
                  <Link
                    href="/audit/new"
                    className="px-4 py-2 bg-amber text-dock-900 text-xs font-bold uppercase tracking-widest hover:bg-amber-dim transition-colors"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                  >
                    File New Manifest →
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/login" className="text-xs uppercase tracking-widest text-dock-400 hover:text-dock-100 transition-colors" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                    Sign In
                  </Link>
                  <Link
                    href="/signup"
                    className="px-4 py-2 bg-amber text-dock-900 text-xs font-bold uppercase tracking-widest hover:bg-amber-dim transition-colors"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                  >
                    Request Clearance →
                  </Link>
                </>
              )}
            </div>
          </div>

        </div>
      </header>

      {/* ── Above the fold ───────────────────────────────────── */}
      <section className="px-6 py-10 border-b border-dock-600">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-12 gap-6">

            {/* Main headline — col 1–8 */}
            <div className="col-span-12 md:col-span-8 border-r border-dock-600 pr-6">
              <div className="mb-3">
                <span className="telex">Breaking</span>
              </div>
              <h2
                className="text-dock-50 mb-4 leading-tight"
                style={{
                  fontFamily: "'Playfair Display', Georgia, serif",
                  fontSize: 'clamp(1.8rem, 5vw, 3.2rem)',
                  fontWeight: 700,
                  lineHeight: 1.1,
                }}
              >
                Solo builders are shipping broken apps every day. Not because they are careless — because they are alone.
              </h2>
              <p className="text-dock-300 text-base leading-relaxed mb-6 max-w-2xl">
                CanIShip is an automated cargo inspection service for web applications. Paste your URL.
                Describe what your app does. Receive a structured inspection report with a{' '}
                <strong className="text-amber">ShipScore™</strong> and a binary verdict:{' '}
                <strong className="text-stamp-green">CLEARED FOR DEPARTURE</strong> or{' '}
                <strong className="text-stamp-red">HOLD — DEFECTS FOUND</strong>.
              </p>
              <div className="flex items-center gap-4">
                <Link
                  href="/signup"
                  className="px-6 py-3 bg-amber text-dock-900 font-bold uppercase tracking-widest text-sm hover:bg-amber-dim transition-colors"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  File Your First Manifest Free →
                </Link>
                <Link
                  href="/pricing"
                  className="text-xs uppercase tracking-widest text-dock-400 hover:text-dock-100 transition-colors border-b border-dock-600 pb-0.5"
                  style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                >
                  View Rates
                </Link>
              </div>
              <p className="mt-3 text-xs text-dock-500 uppercase tracking-wider" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                No SDK. No installation. No credit card. One free inspection per month, always.
              </p>
            </div>

            {/* Sample manifest — col 9–12 */}
            <div className="col-span-12 md:col-span-4">
              <div className="border border-dock-600 p-4 bg-dock-800">

                {/* Manifest header */}
                <div className="border-b-2 border-dock-100 pb-2 mb-3 text-center">
                  <div className="text-xs uppercase tracking-widest text-dock-400 mb-1" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                    Inspection Report
                  </div>
                  <div className="text-dock-50 font-bold text-sm" style={{ fontFamily: "'Playfair Display', serif" }}>
                    CanIShip Authority
                  </div>
                  <div className="text-xs text-dock-500 mt-0.5" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                    Form CI-7 · Automated Survey
                  </div>
                </div>

                {/* Fields */}
                {[
                  { field: 'Vessel', value: 'myapp.com' },
                  { field: 'Inspector', value: 'Claude AI + Playwright' },
                  { field: 'Duration', value: '14m 32s' },
                  { field: 'Layers', value: '8 of 8 complete' },
                  { field: 'Defects', value: '3 critical · 7 minor' },
                ].map(({ field, value }) => (
                  <div key={field} className="manifest-row">
                    <span className="field-name">{field}</span>
                    <span className="field-dots" />
                    <span className="field-value">{value}</span>
                  </div>
                ))}

                {/* Score */}
                <div className="mt-4 pt-3 border-t-2 border-dock-100 text-center">
                  <div className="text-xs uppercase tracking-widest text-dock-400 mb-1" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                    ShipScore™
                  </div>
                  <div
                    className="text-6xl font-black text-amber leading-none mb-2"
                    style={{ fontFamily: "'Playfair Display', serif" }}
                  >
                    61
                  </div>
                  <div className="flex justify-center">
                    <span className="stamp stamp-amber">Hold — Fix Required</span>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── 8 Audit Layers ───────────────────────────────────── */}
      <section id="how-it-works" className="px-6 py-12 border-b border-dock-600">
        <div className="max-w-6xl mx-auto">

          <div className="border-b-2 border-dock-100 mb-6 pb-2 flex items-baseline justify-between">
            <h3
              className="text-dock-50 text-2xl"
              style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}
            >
              The Eight-Layer Inspection Protocol
            </h3>
            <span className="text-xs text-dock-500 uppercase tracking-widest" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              All layers run on every inspection
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
            {auditLayers.map(({ code, label, detail }, i) => (
              <div
                key={code}
                className={`p-5 border-dock-600 ${
                  i % 2 === 0 ? 'border-r' : ''
                } ${i < auditLayers.length - 2 ? 'border-b' : ''}`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="flex-shrink-0 w-10 text-center pt-0.5 text-dock-500 font-bold text-xs uppercase tracking-widest"
                    style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                  >
                    {code}
                  </div>
                  <div>
                    <div
                      className="text-amber font-bold text-sm mb-1 uppercase tracking-wide"
                      style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                    >
                      {label}
                    </div>
                    <p className="text-dock-300 text-sm leading-relaxed">{detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* ── Comparison table ─────────────────────────────────── */}
      <section className="px-6 py-12 border-b border-dock-600">
        <div className="max-w-6xl mx-auto">
          <div className="border-b-2 border-dock-100 mb-6 pb-2">
            <h3
              className="text-dock-50 text-2xl"
              style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}
            >
              How CanIShip Differs From Other Tools
            </h3>
          </div>
          <div className="border border-dock-600 overflow-hidden">
            <div className="grid grid-cols-3 bg-dock-800 border-b-2 border-dock-100 text-xs uppercase tracking-widest text-dock-300 px-4 py-2" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              <span>Criterion</span>
              <span className="text-amber">CanIShip</span>
              <span>Other QA Tools</span>
            </div>
            {differentiatorsRows.map(({ field, caniship, others }, i) => (
              <div
                key={field}
                className={`grid grid-cols-3 px-4 py-3 text-sm ${i % 2 === 0 ? 'bg-dock-900' : 'bg-dock-800'} ${i < differentiatorsRows.length - 1 ? 'border-b border-dock-600' : ''}`}
              >
                <span className="text-dock-400 text-xs uppercase tracking-wide" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {field}
                </span>
                <span className="text-dock-100">{caniship}</span>
                <span className="text-dock-500">{others}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Standards ────────────────────────────────────────── */}
      <section id="standards" className="px-6 py-12 border-b border-dock-600">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div>
              <div className="border-b-2 border-dock-100 mb-5 pb-2">
                <h3 className="text-dock-50 text-xl" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>
                  Standards Referenced
                </h3>
              </div>
              {[
                { abbr: 'WCAG 2.1 AA',             full: 'Web Content Accessibility Guidelines, Level AA' },
                { abbr: 'WCAG 2.5.5',               full: 'Target Size — mobile touch target minimum' },
                { abbr: 'Core Web Vitals',           full: 'Google Lighthouse · LCP, CLS, FCP, TBT, INP' },
                { abbr: 'OWASP Security Headers',   full: 'CSP, HSTS, X-Frame-Options, X-Content-Type' },
                { abbr: 'axe-core (Deque)',          full: 'Accessibility engine used by Google and Microsoft' },
                { abbr: 'RFC 7231',                  full: 'HTTP/1.1 — correct status code enforcement' },
                { abbr: 'Open Graph Protocol',       full: 'Meta / Facebook social card specification' },
              ].map(({ abbr, full }) => (
                <div key={abbr} className="manifest-row">
                  <span className="field-name">{abbr}</span>
                  <span className="field-dots" />
                  <span className="field-value text-xs text-dock-400">{full}</span>
                </div>
              ))}
            </div>
            <div>
              <div className="border-b-2 border-dock-100 mb-5 pb-2">
                <h3 className="text-dock-50 text-xl" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>
                  Scope of This Inspection
                </h3>
              </div>
              <div className="space-y-4">
                <div className="border-l-2 border-stamp-green pl-4">
                  <div className="text-xs uppercase tracking-widest text-dock-400 mb-1" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                    Within Scope
                  </div>
                  <p className="text-dock-300 text-sm leading-relaxed">
                    Functional navigation, WCAG 2.1 AA accessibility, Core Web Vitals, OWASP security
                    headers, broken links, console errors, SEO, and mobile readiness at 375px — eight
                    layers in a single automated run.
                  </p>
                </div>
                <div className="border-l-2 border-stamp-red pl-4">
                  <div className="text-xs uppercase tracking-widest text-dock-400 mb-1" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                    Outside Scope
                  </div>
                  <p className="text-dock-300 text-sm leading-relaxed">
                    Manual penetration testing, load testing, legal compliance review,
                    screen-reader user testing, or auth-gated flows beyond provided test credentials.
                    For regulatory obligations, supplement with human expert review.
                  </p>
                </div>
                <div className="border-l-2 border-stamp-amber pl-4">
                  <div className="text-xs uppercase tracking-widest text-dock-400 mb-1" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                    Inspection Cadence
                  </div>
                  <p className="text-dock-300 text-sm leading-relaxed">
                    Each inspection is a fresh snapshot. Re-run after fixes to measure improvement.
                    Builder and Studio plans retain full history with score differential between runs.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────── */}
      <section className="px-6 py-12 border-b border-dock-600">
        <div className="max-w-6xl mx-auto">
          <div className="border-b-2 border-dock-100 mb-8 pb-2 flex items-baseline justify-between">
            <h3 className="text-dock-50 text-2xl" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700 }}>
              Inspection Tariff
            </h3>
            <span className="text-xs text-dock-500 uppercase tracking-widest" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              No hidden fees. Cancel any time.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border border-dock-600">
            {[
              {
                name: 'Free Berth',
                sub: 'Try the inspection process at no cost.',
                price: '€0',
                period: 'forever',
                items: [
                  '1 inspection per month',
                  'Quick Scan (~5 min)',
                  'Functional, links, console errors',
                  'ShipScore + basic verdict',
                ],
                excluded: ['Risk & Rewards analysis', 'Future Recommendations', 'Standard & Deep scans', 'Inspection history'],
                cta: 'Start Free',
                href: '/signup',
                highlight: false,
              },
              {
                name: 'Builder Berth',
                sub: 'For builders who ship on a regular schedule.',
                price: '€19',
                period: '/month',
                items: [
                  '10 inspections per month',
                  'All scan depths',
                  'Full 8-layer report',
                  'Risk & Rewards analysis',
                  'Future Recommendations',
                  'Inspection history + diffs',
                ],
                excluded: ['Docker self-hosted'],
                cta: 'Start Builder',
                href: null,
                stripePlan: 'builder',
                highlight: true,
              },
              {
                name: 'Studio Berth',
                sub: 'Unlimited inspections. Run on your own infrastructure.',
                price: '€49',
                period: '/month',
                items: [
                  'Unlimited inspections',
                  'All Builder features',
                  'Docker self-hosted image',
                  'Your own Anthropic API key',
                  'No data leaves your machine',
                  'API access',
                ],
                excluded: [],
                cta: 'Start Studio',
                href: null,
                stripePlan: 'studio',
                highlight: false,
              },
            ].map((plan, i) => (
              <div
                key={plan.name}
                className={`p-6 ${i < 2 ? 'border-r border-dock-600' : ''} ${plan.highlight ? 'bg-dock-800' : 'bg-dock-900'}`}
              >
                {plan.highlight && (
                  <div className="mb-3">
                    <span className="telex text-amber border-amber">Most Filed</span>
                  </div>
                )}
                <div className="text-xs uppercase tracking-widest text-dock-500 mb-1" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                  {plan.name}
                </div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-black text-dock-50" style={{ fontFamily: "'Playfair Display', serif" }}>{plan.price}</span>
                  <span className="text-dock-500 text-sm">{plan.period}</span>
                </div>
                <p className="text-dock-400 text-xs mb-5 leading-relaxed">{plan.sub}</p>

                <div className="border-t border-dock-600 pt-4 space-y-2 mb-6">
                  {plan.items.map(item => (
                    <div key={item} className="flex items-start gap-2 text-xs text-dock-200">
                      <span className="text-stamp-green mt-0.5 flex-shrink-0">✓</span>
                      {item}
                    </div>
                  ))}
                  {plan.excluded.map(item => (
                    <div key={item} className="flex items-start gap-2 text-xs text-dock-600">
                      <span className="mt-0.5 flex-shrink-0">—</span>
                      {item}
                    </div>
                  ))}
                </div>

                {plan.href ? (
                  <Link
                    href={plan.href}
                    className={`block text-center py-2.5 text-xs font-bold uppercase tracking-widest transition-colors ${
                      plan.highlight
                        ? 'bg-amber text-dock-900 hover:bg-amber-dim'
                        : 'border border-dock-500 text-dock-300 hover:border-dock-300 hover:text-dock-100'
                    }`}
                    style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                  >
                    {plan.cta} →
                  </Link>
                ) : (
                  <Link
                    href="/signup"
                    className={`block text-center py-2.5 text-xs font-bold uppercase tracking-widest transition-colors ${
                      plan.highlight
                        ? 'bg-amber text-dock-900 hover:bg-amber-dim'
                        : 'border border-dock-500 text-dock-300 hover:border-dock-300 hover:text-dock-100'
                    }`}
                    style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
                  >
                    {plan.cta} →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="px-6 py-16 border-b border-dock-600">
        <div className="max-w-3xl mx-auto text-center">
          <div className="double-rule mb-8" />
          <h2
            className="text-dock-50 mb-4 leading-tight"
            style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 'clamp(2rem, 5vw, 3.5rem)',
              fontWeight: 900,
            }}
          >
            Your cargo does not leave the dock until it passes inspection.
          </h2>
          <p className="text-dock-300 mb-8 text-base leading-relaxed max-w-xl mx-auto">
            File a manifest. Receive an inspection report. Know what to fix before your users find it.
          </p>
          <Link
            href="/signup"
            className="inline-block px-8 py-4 bg-amber text-dock-900 font-bold uppercase tracking-widest text-sm hover:bg-amber-dim transition-colors"
            style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
          >
            File Your First Manifest — Free →
          </Link>
          <div className="double-rule mt-8" />
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="px-6 pt-10 pb-8 border-t-4 border-dock-100">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">

            <div className="md:col-span-1">
              <div className="text-dock-50 font-black text-xl mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>CanIShip</div>
              <p className="text-xs text-dock-500 leading-relaxed mb-4">
                Automated cargo inspection for web applications. Eight audit layers. One honest verdict.
              </p>
              <a
                href="https://www.linkedin.com/company/actvli"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-dock-500 hover:text-dock-300 uppercase tracking-widest transition-colors"
                style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
              >
                Äctvli on LinkedIn ↗
              </a>
            </div>

            <div>
              <div className="text-xs uppercase tracking-widest text-dock-500 border-b border-dock-600 pb-2 mb-3" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                Product
              </div>
              <ul className="space-y-2 text-xs text-dock-400" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                {[
                  ['Pricing', '/pricing'],
                  ['Run an Inspection', '/audit/new'],
                  ['Dashboard', '/dashboard'],
                  ['Sign In', '/login'],
                  ['Create Account', '/signup'],
                ].map(([label, href]) => (
                  <li key={href}>
                    <Link href={href} className="hover:text-dock-200 uppercase tracking-widest transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="text-xs uppercase tracking-widest text-dock-500 border-b border-dock-600 pb-2 mb-3" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                Standards
              </div>
              <ul className="space-y-1.5 text-xs text-dock-500">
                {['WCAG 2.1 AA', 'WCAG 2.5.5', 'Core Web Vitals', 'OWASP Headers', 'axe-core', 'Playwright', 'Google Lighthouse'].map(s => (
                  <li key={s} className="uppercase tracking-wider" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>{s}</li>
                ))}
              </ul>
            </div>

            <div>
              <div className="text-xs uppercase tracking-widest text-dock-500 border-b border-dock-600 pb-2 mb-3" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                Legal
              </div>
              <ul className="space-y-2 text-xs text-dock-400" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
                <li><Link href="/privacy" className="hover:text-dock-200 uppercase tracking-widest transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-dock-200 uppercase tracking-widest transition-colors">Terms of Service</Link></li>
              </ul>
              <div className="mt-4 border border-dock-600 p-3 bg-dock-800">
                <p className="text-xs text-dock-600 leading-relaxed">
                  Session cookies only. No tracking. No advertising. No data sold.
                </p>
              </div>
            </div>

          </div>

          <div className="border-t border-dock-600 pt-5 flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="text-xs text-dock-600 uppercase tracking-widest" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              © {new Date().getFullYear()} Äctvli Responsible Consulting
            </div>
            <div className="text-xs text-dock-700 uppercase tracking-widest text-center" style={{ fontFamily: "'Barlow Condensed', sans-serif" }}>
              Inspection results are informational — not a guarantee of security, legal compliance, or fitness for purpose.
            </div>
          </div>
        </div>
      </footer>

    </div>
  )
}
