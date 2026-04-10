import Link from 'next/link'

export const metadata = {
  title: 'Self-Hosted Docker — CanIShip',
  description: 'Run CanIShip on your own infrastructure. Audit local apps, staging environments, and private URLs — no data leaves your machine.',
}

const envVars = [
  { name: 'LICENSE_KEY', required: true, default: '—', desc: 'Your Studio license key from Settings' },
  { name: 'ANTHROPIC_API_KEY', required: true, default: '—', desc: 'Your Anthropic API key from console.anthropic.com' },
  { name: 'SQLITE_PATH', required: false, default: '/data/caniship.db', desc: 'Path to the SQLite database inside the container' },
  { name: 'DATABASE_URL', required: false, default: '—', desc: 'Use Postgres instead of SQLite: postgresql://user:pass@host:5432/db' },
  { name: 'OUTPUT_DIR', required: false, default: '—', desc: 'Write JSON + HTML report files here after each audit' },
  { name: 'REPORT_FORMAT', required: false, default: 'both', desc: 'json, html, or both' },
  { name: 'MIN_SCORE', required: false, default: '0', desc: 'Exit with code 1 if audit score falls below this — useful for CI/CD' },
  { name: 'ALLOW_PRIVATE_IPS', required: false, default: 'false', desc: 'Set to true to audit apps on your local network (192.168.x.x, localhost)' },
  { name: 'PORT', required: false, default: '3000', desc: 'Port the server listens on' },
  { name: 'HEADLESS', required: false, default: 'false', desc: 'Set to true to disable the web UI and run API-only' },
  { name: 'WEBHOOK_SECRET', required: false, default: '—', desc: 'Signs webhook payloads with X-CanIShip-Signature' },
]

export default function DockerPage() {
  return (
    <div className="min-h-screen bg-dark-900 text-white">

      {/* Nav */}
      <nav className="border-b border-dark-600 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-mono-brand font-bold text-neon-green text-xl">
            CanIShip
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/settings" className="text-sm text-gray-400 hover:text-white transition-colors">
              Settings
            </Link>
            <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-14">

        {/* Header */}
        <div className="mb-12">
          <div className="inline-block text-xs font-mono bg-neon-green/10 text-neon-green border border-neon-green/20 px-3 py-1 rounded-full mb-4">
            Studio feature
          </div>
          <h1 className="font-mono-brand font-black text-4xl text-white mb-4">
            Self-Hosted Docker
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl leading-relaxed">
            The full CanIShip audit engine — running entirely on your own machine or server.
            Same interface. Same ShipScore. Zero data leaving your infrastructure.
          </p>
        </div>

        {/* Why we built it */}
        <section className="mb-12 rounded-2xl border border-dark-500 bg-dark-800 p-8">
          <h2 className="font-semibold text-white text-lg mb-3">Why we built this</h2>
          <p className="text-gray-400 text-sm leading-relaxed mb-4">
            The cloud version of CanIShip is great for public URLs. But a lot of real work happens before anything is public — staging environments behind VPNs, local dev builds, internal tools that should never send URLs to a third-party server.
          </p>
          <p className="text-gray-400 text-sm leading-relaxed mb-4">
            The Docker image is CanIShip repackaged so that everything runs on your hardware. Your URL never leaves your network. Your audit data lives in a volume you control. The only outbound call is a license check back to us once every 24 hours — after that, it works fully offline.
          </p>
          <p className="text-gray-400 text-sm leading-relaxed">
            We also built this for CI/CD. If you want a quality gate that fails a GitHub Actions build when the ShipScore drops below 75, this is the way to do it.
          </p>
        </section>

        {/* Who it's for */}
        <section className="mb-12">
          <h2 className="font-semibold text-white text-lg mb-5">Who it&apos;s for</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                icon: '🔒',
                title: 'Privacy-first teams',
                body: "Your URLs, reports, and audit data never touch our servers. Stays entirely within your own infrastructure.",
              },
              {
                icon: '🏗️',
                title: 'CI/CD pipelines',
                body: "Wire it into GitHub Actions, GitLab CI, or any pipeline. Set MIN_SCORE=75 and your build fails if quality drops.",
              },
              {
                icon: '🖥️',
                title: 'Local & VPN apps',
                body: "Audit localhost, staging environments behind a VPN, or any URL your cloud scanner can't reach.",
              },
            ].map(({ icon, title, body }) => (
              <div key={title} className="rounded-xl border border-dark-500 bg-dark-800 p-5">
                <div className="text-2xl mb-3">{icon}</div>
                <h3 className="font-semibold text-white text-sm mb-2">{title}</h3>
                <p className="text-gray-400 text-xs leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Requirements */}
        <section className="mb-12">
          <h2 className="font-semibold text-white text-lg mb-4">Before you start</h2>
          <div className="rounded-xl border border-dark-500 bg-dark-800 overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {[
                  ['Docker', 'Version 20+ recommended'],
                  ['RAM', '4 GB minimum — Chromium + Claude analysis needs headroom'],
                  ['Studio license key', 'From Settings → Docker License (below)'],
                  ['Anthropic API key', 'From console.anthropic.com — you pay for your own Claude usage'],
                  ['Internet (first run)', 'Required to validate your license — then works offline for 24h'],
                ].map(([req, note], i, arr) => (
                  <tr key={req} className={i < arr.length - 1 ? 'border-b border-dark-600' : ''}>
                    <td className="px-5 py-3 text-gray-300 font-mono text-xs w-48 font-medium">{req}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Quick start */}
        <section className="mb-12">
          <h2 className="font-semibold text-white text-lg mb-5">Quick start</h2>
          <div className="space-y-5">

            <div className="rounded-xl border border-dark-500 bg-dark-800 p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Step 1 — Get your license key
              </p>
              <p className="text-sm text-gray-400 mb-3">
                Go to{' '}
                <Link href="/settings" className="text-neon-green hover:underline">
                  Settings → Docker License
                </Link>{' '}
                and click <span className="text-white font-medium">Generate license key</span>.
                Keep it private — it authorises your container to run audits.
              </p>
            </div>

            <div className="rounded-xl border border-dark-500 bg-dark-800 p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Step 2 — Pull the image
              </p>
              <pre className="bg-dark-900 border border-dark-600 rounded-lg px-4 py-3 text-sm font-mono text-neon-green overflow-x-auto">
                docker pull hanimebar/caniship:latest
              </pre>
            </div>

            <div className="rounded-xl border border-dark-500 bg-dark-800 p-5">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Step 3 — Run it
              </p>
              <pre className="bg-dark-900 border border-dark-600 rounded-lg px-4 py-3 text-sm font-mono text-gray-300 overflow-x-auto leading-relaxed">{`docker run -p 3000:3000 \\
  -e LICENSE_KEY=your-license-key \\
  -e ANTHROPIC_API_KEY=sk-ant-... \\
  -v caniship-data:/data \\
  hanimebar/caniship:latest`}</pre>
              <p className="text-xs text-gray-600 mt-3">
                Open <span className="font-mono text-gray-400">http://localhost:3000</span> — same interface, fully local.
              </p>
            </div>

          </div>
        </section>

        {/* Auditing local apps */}
        <section className="mb-12">
          <h2 className="font-semibold text-white text-lg mb-4">Auditing local or VPN apps</h2>
          <p className="text-gray-400 text-sm mb-4">
            By default, private IP addresses are blocked to prevent SSRF. To audit an app on your local network, add two flags:
          </p>
          <pre className="bg-dark-900 border border-dark-500 rounded-xl px-5 py-4 text-sm font-mono text-gray-300 overflow-x-auto leading-relaxed">{`docker run -p 3000:3000 \\
  -e LICENSE_KEY=... \\
  -e ANTHROPIC_API_KEY=... \\
  -e ALLOW_PRIVATE_IPS=true \\
  --network host \\
  -v caniship-data:/data \\
  hanimebar/caniship:latest`}</pre>
          <p className="text-xs text-gray-600 mt-3">
            <code className="text-gray-400">--network host</code> lets the container reach your machine&apos;s ports. Audit <code className="text-gray-400">http://localhost:3001</code> or <code className="text-gray-400">http://192.168.x.x</code> directly.
          </p>
        </section>

        {/* CI/CD */}
        <section className="mb-12">
          <h2 className="font-semibold text-white text-lg mb-4">GitHub Actions integration</h2>
          <p className="text-gray-400 text-sm mb-5">
            Add your secrets under <span className="text-gray-300">Settings → Secrets and Variables → Actions</span> in your GitHub repo, then drop this workflow in:
          </p>
          <pre className="bg-dark-900 border border-dark-500 rounded-xl px-5 py-4 text-sm font-mono text-gray-300 overflow-x-auto leading-relaxed">{`# .github/workflows/quality-gate.yml
name: Quality Gate

on:
  push:
    branches: [main]
  pull_request:

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run CanIShip Audit
        uses: ./.github/actions/caniship
        with:
          url: https://staging.myapp.com
          description: >
            A project management SaaS. Users sign up, create workspaces,
            add tasks, and collaborate with their team.
          license_key: \${{ secrets.CANISHIP_LICENSE_KEY }}
          anthropic_api_key: \${{ secrets.ANTHROPIC_API_KEY }}
          depth: quick
          min_score: 75
          flows: "sign up, create workspace, add task"`}</pre>
          <div className="mt-4 rounded-xl border border-dark-500 bg-dark-800 px-5 py-4 text-xs text-gray-400 space-y-1">
            <p>The action pulls the image, starts the container, submits the audit, polls until complete, and uploads the JSON + HTML report as a build artifact.</p>
            <p className="text-gray-500">If the score falls below <code className="text-gray-300">min_score</code>, the build exits with code 1 — your PR is blocked.</p>
          </div>
        </section>

        {/* Env vars */}
        <section className="mb-12">
          <h2 className="font-semibold text-white text-lg mb-4">All environment variables</h2>
          <div className="rounded-xl border border-dark-500 bg-dark-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-dark-600">
                  <th className="px-5 py-3 text-left text-gray-500 font-semibold uppercase tracking-wider">Variable</th>
                  <th className="px-5 py-3 text-left text-gray-500 font-semibold uppercase tracking-wider hidden sm:table-cell">Default</th>
                  <th className="px-5 py-3 text-left text-gray-500 font-semibold uppercase tracking-wider">Description</th>
                </tr>
              </thead>
              <tbody>
                {envVars.map((v, i) => (
                  <tr key={v.name} className={i < envVars.length - 1 ? 'border-b border-dark-700' : ''}>
                    <td className="px-5 py-3 font-mono whitespace-nowrap">
                      <span className={v.required ? 'text-neon-green' : 'text-gray-300'}>{v.name}</span>
                      {v.required && (
                        <span className="ml-2 text-neon-green/60 text-xs">required</span>
                      )}
                    </td>
                    <td className="px-5 py-3 font-mono text-gray-500 hidden sm:table-cell">{v.default}</td>
                    <td className="px-5 py-3 text-gray-400">{v.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* License & offline */}
        <section className="mb-12 rounded-2xl border border-dark-500 bg-dark-800 p-8">
          <h2 className="font-semibold text-white text-lg mb-3">License & offline use</h2>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex gap-2"><span className="text-neon-green mt-0.5">→</span>Your license is validated against caniship.actvli.com on startup</li>
            <li className="flex gap-2"><span className="text-neon-green mt-0.5">→</span>After a successful validation, the container works <span className="text-white">offline for up to 24 hours</span></li>
            <li className="flex gap-2"><span className="text-neon-green mt-0.5">→</span>Audits in progress are never interrupted by a validation check</li>
            <li className="flex gap-2"><span className="text-neon-green mt-0.5">→</span>Check last validation time: <code className="font-mono text-gray-300">cat /data/.license_state</code></li>
            <li className="flex gap-2"><span className="text-neon-green mt-0.5">→</span>Your <code className="font-mono text-gray-300">ANTHROPIC_API_KEY</code> is used locally — it is never sent to Äctvli servers</li>
          </ul>
        </section>

        {/* CTA */}
        <div className="text-center pt-4 pb-6">
          <p className="text-gray-400 text-sm mb-4">Ready to set up?</p>
          <Link
            href="/settings"
            className="inline-block px-6 py-3 bg-neon-green text-dark-900 font-bold text-sm rounded-xl hover:bg-neon-green-dim transition-colors font-mono-brand"
          >
            Get your license key →
          </Link>
        </div>

      </div>

      {/* Footer */}
      <footer className="border-t border-dark-700 px-6 py-8">
        <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-6 text-sm text-gray-600">
          <Link href="/" className="hover:text-gray-400 transition-colors">Home</Link>
          <Link href="/pricing" className="hover:text-gray-400 transition-colors">Pricing</Link>
          <Link href="/privacy" className="hover:text-gray-400 transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-gray-400 transition-colors">Terms of Service</Link>
          <a href="mailto:reachout@actvli.com" className="hover:text-gray-400 transition-colors">Support</a>
        </div>
      </footer>
    </div>
  )
}
