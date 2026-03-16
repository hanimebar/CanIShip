import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service — CanIShip',
  description: 'Terms and conditions for using CanIShip.',
}

export default function TermsPage() {
  const lastUpdated = '16 March 2026'

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
          <h1 className="text-3xl font-bold text-white mb-3">Terms of Service</h1>
          <p className="text-gray-500 text-sm">Last updated: {lastUpdated}</p>
        </div>

        <div className="space-y-8 text-gray-300 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Agreement</h2>
            <p>
              By creating an account or using CanIShip (&quot;the Service&quot;), you agree to these Terms of Service.
              The Service is provided by <strong className="text-white">Äctvli Responsible Consulting</strong> (&quot;we&quot;, &quot;us&quot;).
              If you do not agree, please do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. What the Service does</h2>
            <p className="mb-3">
              CanIShip is an automated web application audit tool. It runs functional tests, accessibility checks,
              performance measurements, security surface scans, and link validation against a URL you provide.
              It produces a report summarising findings and a ShipScore.
            </p>
            <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-5">
              <h3 className="font-semibold text-yellow-400 mb-2 text-sm">Important limitation</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                CanIShip reports are <strong className="text-white">informational only</strong>. They represent the output of
                automated testing tools against a point-in-time snapshot of your application. They are not a guarantee
                of security, compliance, freedom from bugs, or fitness for any particular purpose. Automated tools
                cannot replace human review, penetration testing, or professional accessibility audits.
                A &quot;Ship It&quot; verdict means no critical issues were detected by our toolchain — not that your
                app is risk-free.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Acceptable use</h2>
            <p className="mb-3">You may only audit URLs you own or have explicit permission to test. You must not:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Audit URLs belonging to third parties without their authorisation.</li>
              <li>Use the Service to perform denial-of-service attacks, scraping, or automated abuse against any site.</li>
              <li>Attempt to circumvent usage limits, access other users&apos; data, or reverse-engineer the Service.</li>
              <li>Resell or redistribute audit reports without our written permission.</li>
            </ul>
            <p className="mt-3">We reserve the right to suspend accounts that violate these terms without refund.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Subscriptions and billing</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Paid plans are billed monthly via Stripe. Prices are in EUR and exclusive of VAT where applicable.</li>
              <li>Subscriptions renew automatically unless cancelled before the renewal date.</li>
              <li>Unused audits do not roll over to the next month.</li>
              <li>Refunds are not provided for partial months, but you may cancel at any time and retain access until the end of your billing period.</li>
              <li>We may change pricing with 30 days&apos; notice to active subscribers.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Intellectual property</h2>
            <p>
              Audit reports generated for your URLs belong to you. The Service, codebase, and CanIShip brand belong to
              Äctvli Responsible Consulting. You may not reproduce or redistribute the Service itself.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Limitation of liability</h2>
            <p className="mb-3">
              To the maximum extent permitted by law, Äctvli Responsible Consulting shall not be liable for:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Any loss or damage arising from reliance on an audit report.</li>
              <li>Security breaches, data loss, or downtime in your application, whether or not flagged by CanIShip.</li>
              <li>Indirect, consequential, or incidental damages of any kind.</li>
            </ul>
            <p className="mt-3">
              Our total liability is limited to the amount you paid for the Service in the 3 months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Service availability</h2>
            <p>
              We aim for high availability but do not guarantee uninterrupted access. Scheduled maintenance, infrastructure
              issues, or third-party service outages may affect availability. We will not issue refunds for downtime unless
              it exceeds 72 continuous hours in a billing period.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Termination</h2>
            <p>
              You may delete your account at any time from your settings. We may suspend or terminate accounts that
              violate these terms. On termination, your data will be retained for 30 days then permanently deleted,
              except where legal retention obligations apply.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Governing law</h2>
            <p>
              These terms are governed by the laws of Finland. Any disputes shall be resolved in the courts of Finland,
              without prejudice to your rights as a consumer under applicable EU law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Contact</h2>
            <p>
              Questions about these terms? Email us at{' '}
              <a href="mailto:reachout@actvli.com" className="text-neon-green hover:underline">reachout@actvli.com</a>.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-dark-600 flex items-center justify-between text-sm text-gray-600">
          <Link href="/privacy" className="hover:text-gray-400 transition-colors">Privacy Policy</Link>
          <Link href="/" className="hover:text-gray-400 transition-colors">← Back to CanIShip</Link>
        </div>
      </div>
    </div>
  )
}
