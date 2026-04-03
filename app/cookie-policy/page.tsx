import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Cookie Policy — CanIShip',
  description: 'How CanIShip uses cookies. Short answer: only strictly necessary ones.',
}

export default function CookiePolicyPage() {
  const lastUpdated = '3 April 2026'

  return (
    <div className="min-h-screen bg-dark-900 text-white">
      <nav className="border-b border-dark-600 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-mono-brand font-bold text-neon-green text-xl">CanIShip</Link>
          <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">Dashboard</Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white mb-3">Cookie Policy</h1>
          <p className="text-gray-500 text-sm">Last updated: {lastUpdated}</p>
        </div>

        <div className="space-y-8 text-gray-300 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">The short version</h2>
            <p>
              CanIShip uses only <strong className="text-white">strictly necessary cookies</strong>. We do not use tracking
              cookies, advertising cookies, or any third-party analytics cookies. Our analytics tool (Plausible) is
              deliberately cookie-free and GDPR-compliant by design.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. What are cookies?</h2>
            <p>
              Cookies are small text files stored on your device by your browser when you visit a website. They allow
              websites to remember information about your visit — such as whether you are logged in.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Cookies we use</h2>

            <div className="space-y-6">
              <div className="border border-dark-500 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="px-2 py-0.5 bg-neon-green/10 border border-neon-green/30 text-neon-green text-xs rounded font-mono">Strictly Necessary</span>
                  <span className="text-white font-semibold">Authentication (Supabase)</span>
                </div>
                <p className="text-sm text-gray-400 mb-3">
                  When you sign in, Supabase sets a session cookie so you stay logged in across page loads.
                  Without this cookie, you would be logged out every time you navigate to a new page.
                </p>
                <table className="w-full text-xs text-gray-400">
                  <thead>
                    <tr className="text-gray-500 border-b border-dark-600">
                      <th className="text-left pb-2">Name</th>
                      <th className="text-left pb-2">Purpose</th>
                      <th className="text-left pb-2">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-700">
                    <tr>
                      <td className="py-2 font-mono">sb-*-auth-token</td>
                      <td className="py-2">Stores your encrypted session token</td>
                      <td className="py-2">Session / 7 days</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-mono">sb-*-auth-token-code-verifier</td>
                      <td className="py-2">PKCE flow security token</td>
                      <td className="py-2">Session</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="border border-dark-500 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="px-2 py-0.5 bg-neon-green/10 border border-neon-green/30 text-neon-green text-xs rounded font-mono">Strictly Necessary</span>
                  <span className="text-white font-semibold">Payments (Stripe)</span>
                </div>
                <p className="text-sm text-gray-400 mb-3">
                  When you initiate a payment, Stripe sets cookies to secure the transaction and prevent fraud.
                  These are set only when you interact with the Stripe checkout flow.
                </p>
                <table className="w-full text-xs text-gray-400">
                  <thead>
                    <tr className="text-gray-500 border-b border-dark-600">
                      <th className="text-left pb-2">Name</th>
                      <th className="text-left pb-2">Purpose</th>
                      <th className="text-left pb-2">Duration</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-700">
                    <tr>
                      <td className="py-2 font-mono">__stripe_mid</td>
                      <td className="py-2">Fraud prevention and machine identification</td>
                      <td className="py-2">1 year</td>
                    </tr>
                    <tr>
                      <td className="py-2 font-mono">__stripe_sid</td>
                      <td className="py-2">Secure payment session</td>
                      <td className="py-2">30 minutes</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="border border-dark-500 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs rounded font-mono">Cookie-free</span>
                  <span className="text-white font-semibold">Analytics (Plausible)</span>
                </div>
                <p className="text-sm text-gray-400">
                  We use <a href="https://plausible.io" target="_blank" rel="noopener noreferrer" className="text-neon-green hover:underline">Plausible Analytics</a> to
                  understand traffic patterns. Plausible is intentionally built without cookies — it does not store
                  any information on your device and is fully GDPR, CCPA, and PECR compliant. No consent is required
                  for Plausible because it collects no personal data.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Cookies we do NOT use</h2>
            <ul className="list-disc list-inside space-y-1 text-gray-400">
              <li>Advertising or retargeting cookies</li>
              <li>Social media tracking cookies</li>
              <li>Third-party analytics cookies (Google Analytics, Facebook Pixel, etc.)</li>
              <li>Profiling or behavioural tracking cookies</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Your choices</h2>
            <p className="mb-4">
              Because all cookies we use are strictly necessary for the service to function, they cannot be disabled
              without breaking core features (you would not be able to stay logged in or complete a payment).
            </p>
            <p>
              You can always clear cookies from your browser settings. Doing so will log you out of CanIShip.
              Most browsers also offer a private/incognito mode where cookies are deleted when you close the window.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Legal basis (GDPR)</h2>
            <p>
              Under GDPR Article 6(1)(b) — performance of a contract — we may process strictly necessary cookies
              without obtaining consent because they are essential to deliver the service you have requested.
              No consent banner is legally required for strictly necessary cookies, but we display one for transparency.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Contact</h2>
            <p>
              Questions about this policy?{' '}
              <a href="mailto:reachout@actvli.com" className="text-neon-green hover:underline">reachout@actvli.com</a>
            </p>
          </section>

        </div>
      </div>

      <footer className="border-t border-dark-700 px-6 py-8">
        <div className="max-w-3xl mx-auto flex flex-wrap gap-6 text-sm text-gray-600">
          <Link href="/privacy" className="hover:text-gray-400 transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="hover:text-gray-400 transition-colors">Terms of Service</Link>
          <Link href="/cookie-policy" className="hover:text-gray-400 transition-colors">Cookie Policy</Link>
          <span>© {new Date().getFullYear()} Äctvli Responsible Consulting</span>
        </div>
      </footer>
    </div>
  )
}
