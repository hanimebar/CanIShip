import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — CanIShip',
  description: 'How CanIShip collects, uses, and protects your personal data. GDPR-compliant.',
}

export default function PrivacyPage() {
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
          <h1 className="text-3xl font-bold text-white mb-3">Privacy Policy</h1>
          <p className="text-gray-500 text-sm">Last updated: {lastUpdated}</p>
        </div>

        <div className="prose prose-invert max-w-none space-y-8 text-gray-300 leading-relaxed">

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Who we are</h2>
            <p>
              CanIShip is a product of <strong className="text-white">Äctvli Responsible Consulting</strong> (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;).
              We are the data controller for personal data processed through this service.
              Contact: <a href="mailto:reachout@actvli.com" className="text-neon-green hover:underline">reachout@actvli.com</a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. What data we collect</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-white">Account data:</strong> your email address, name (if provided), and authentication method (email/password, Google, or GitHub).</li>
              <li><strong className="text-white">Audit data:</strong> URLs you submit for auditing, descriptions and flows you provide, and audit results generated.</li>
              <li><strong className="text-white">Billing data:</strong> subscription plan and payment status. Card details are processed directly by Stripe — we never see or store them.</li>
              <li><strong className="text-white">Usage data:</strong> number of audits run per month, timestamps of activity.</li>
              <li><strong className="text-white">Technical data:</strong> IP address, browser type, and session cookies required to keep you logged in.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. Why we collect it (legal basis)</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-white">Contract performance (Art. 6(1)(b) GDPR):</strong> to create your account, run audits, and deliver reports.</li>
              <li><strong className="text-white">Legitimate interest (Art. 6(1)(f) GDPR):</strong> to improve the audit engine, fix bugs, and prevent abuse.</li>
              <li><strong className="text-white">Consent (Art. 6(1)(a) GDPR):</strong> for marketing communications, if you opt in.</li>
              <li><strong className="text-white">Legal obligation (Art. 6(1)(c) GDPR):</strong> for billing records and tax compliance.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Who we share data with</h2>
            <p className="mb-3">We do not sell your data. We share it only with these sub-processors to deliver the service:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-dark-500 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-dark-700">
                    <th className="text-left px-4 py-3 text-gray-300 font-semibold">Processor</th>
                    <th className="text-left px-4 py-3 text-gray-300 font-semibold">Purpose</th>
                    <th className="text-left px-4 py-3 text-gray-300 font-semibold">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-600">
                  <tr className="bg-dark-800">
                    <td className="px-4 py-3 text-white">Supabase</td>
                    <td className="px-4 py-3 text-gray-400">Authentication, database</td>
                    <td className="px-4 py-3 text-gray-400">EU (Frankfurt)</td>
                  </tr>
                  <tr className="bg-dark-800">
                    <td className="px-4 py-3 text-white">Stripe</td>
                    <td className="px-4 py-3 text-gray-400">Payment processing</td>
                    <td className="px-4 py-3 text-gray-400">EU / US (SCCs)</td>
                  </tr>
                  <tr className="bg-dark-800">
                    <td className="px-4 py-3 text-white">Resend</td>
                    <td className="px-4 py-3 text-gray-400">Transactional email</td>
                    <td className="px-4 py-3 text-gray-400">US (SCCs)</td>
                  </tr>
                  <tr className="bg-dark-800">
                    <td className="px-4 py-3 text-white">Railway</td>
                    <td className="px-4 py-3 text-gray-400">Application hosting</td>
                    <td className="px-4 py-3 text-gray-400">EU (Amsterdam)</td>
                  </tr>
                  <tr className="bg-dark-800">
                    <td className="px-4 py-3 text-white">Anthropic</td>
                    <td className="px-4 py-3 text-gray-400">AI audit analysis (Claude API)</td>
                    <td className="px-4 py-3 text-gray-400">US (SCCs)</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-gray-500">SCCs = Standard Contractual Clauses for lawful EU→US data transfers.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. How long we keep your data</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-white">Account data:</strong> for as long as your account is active, plus 30 days after deletion.</li>
              <li><strong className="text-white">Audit reports:</strong> retained for 12 months, then automatically deleted.</li>
              <li><strong className="text-white">Billing records:</strong> 7 years for tax compliance.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Your rights under GDPR</h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong className="text-white">Access</strong> — request a copy of your personal data.</li>
              <li><strong className="text-white">Rectification</strong> — correct inaccurate data.</li>
              <li><strong className="text-white">Erasure</strong> — request deletion of your account and data (&quot;right to be forgotten&quot;).</li>
              <li><strong className="text-white">Portability</strong> — receive your data in a machine-readable format.</li>
              <li><strong className="text-white">Objection</strong> — object to processing based on legitimate interest.</li>
              <li><strong className="text-white">Restriction</strong> — ask us to pause processing in certain circumstances.</li>
            </ul>
            <p className="mt-3">
              To exercise any right, email <a href="mailto:reachout@actvli.com" className="text-neon-green hover:underline">reachout@actvli.com</a>.
              We will respond within 30 days. You also have the right to lodge a complaint with your local supervisory authority.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Cookies</h2>
            <p>
              We use only session cookies necessary for authentication (set by Supabase) and a cookie to store your preferences.
              We do not use tracking cookies, advertising cookies, or third-party analytics cookies.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Security</h2>
            <p>
              We use HTTPS, database row-level security, and server-side auth for all routes. Passwords are hashed by Supabase (bcrypt).
              No plaintext credentials are ever stored.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Changes to this policy</h2>
            <p>
              We may update this policy periodically. Material changes will be notified by email. Continued use of the service after
              the effective date constitutes acceptance.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-dark-600 flex items-center justify-between text-sm text-gray-600">
          <Link href="/terms" className="hover:text-gray-400 transition-colors">Terms of Service</Link>
          <Link href="/" className="hover:text-gray-400 transition-colors">← Back to CanIShip</Link>
        </div>
      </div>

      <footer className="border-t border-dark-700 px-6 py-8">
        <div className="max-w-3xl mx-auto flex flex-wrap gap-6 text-sm text-gray-600">
          <Link href="/terms" className="hover:text-gray-400 transition-colors">Terms of Service</Link>
          <Link href="/cookie-policy" className="hover:text-gray-400 transition-colors">Cookie Policy</Link>
          <span>© {new Date().getFullYear()} Äctvli Responsible Consulting</span>
        </div>
      </footer>
    </div>
  )
}
