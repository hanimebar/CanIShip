'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase'

type Props = {
  currentName: string
  email: string
  plan: string
  isOAuthUser: boolean
  hasStripeCustomer: boolean
  licenseKey?: string | null
}

const PLANS = [
  {
    id: 'free',
    label: 'Free',
    color: '#8E8E93',
    price: '$0/mo',
    audits: '3 audits/month',
    features: ['Core audit (Playwright)', 'Basic scoring'],
  },
  {
    id: 'builder',
    label: 'Builder',
    color: '#0A84FF',
    price: '$19/mo',
    audits: '20 audits/month',
    features: ['All audit layers', 'axe-core accessibility', 'Lighthouse performance'],
  },
  {
    id: 'studio',
    label: 'Studio',
    color: '#00FF88',
    price: '$49/mo',
    audits: 'Unlimited audits',
    features: ['Everything in Builder', 'Docker self-host license', 'Priority processing'],
  },
]

export function SettingsClient({ currentName, email, plan, isOAuthUser, hasStripeCustomer, licenseKey: initialLicenseKey }: Props) {
  const router = useRouter()

  // Profile
  const [name, setName] = useState(currentName)
  const [nameLoading, setNameLoading] = useState(false)
  const [nameMsg, setNameMsg] = useState('')

  // Password
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState('')

  // Billing
  const [billingLoading, setBillingLoading] = useState(false)
  const [billingError, setBillingError] = useState('')

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // License
  const [licenseKey, setLicenseKey] = useState(initialLicenseKey)
  const [licenseLoading, setLicenseLoading] = useState(false)
  const [licenseError, setLicenseError] = useState('')
  const [copied, setCopied] = useState(false)
  const [copiedCmd, setCopiedCmd] = useState(false)

  async function handleNameUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setNameLoading(true)
    setNameMsg('')
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim() } })
    setNameLoading(false)
    setNameMsg(error ? `Error: ${error.message}` : 'Name updated.')
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault()
    setPasswordMsg('')
    if (newPassword.length < 8) {
      setPasswordMsg('New password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg('Passwords do not match.')
      return
    }
    setPasswordLoading(true)
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPasswordLoading(false)
    if (error) {
      setPasswordMsg(`Error: ${error.message}`)
    } else {
      setPasswordMsg('Password updated successfully.')
      setNewPassword('')
      setConfirmPassword('')
    }
  }

  async function handleBillingPortal() {
    setBillingLoading(true)
    setBillingError('')
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setBillingError(data.error || 'Could not open billing portal.')
        return
      }
      window.location.href = data.url
    } catch {
      setBillingError('Network error. Please try again.')
    } finally {
      setBillingLoading(false)
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirm !== email) return
    setDeleteLoading(true)
    setDeleteError('')
    try {
      const res = await fetch('/api/account/delete', { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        setDeleteError(data.error || 'Failed to delete account.')
        return
      }
      const supabase = createSupabaseBrowserClient()
      await supabase.auth.signOut()
      router.push('/?deleted=true')
    } catch {
      setDeleteError('Network error. Please try again.')
    } finally {
      setDeleteLoading(false)
    }
  }

  async function handleGenerateLicense() {
    setLicenseLoading(true)
    setLicenseError('')
    try {
      const res = await fetch('/api/license/generate', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setLicenseError(data.error || 'Failed to generate license key.')
        return
      }
      setLicenseKey(data.license_key)
    } catch {
      setLicenseError('Network error. Please try again.')
    } finally {
      setLicenseLoading(false)
    }
  }

  async function copyLicense() {
    if (!licenseKey) return
    await navigator.clipboard.writeText(licenseKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function copyDockerCmd() {
    if (!licenseKey) return
    const cmd = `docker run -p 3000:3000 \\\n  -e LICENSE_KEY=${licenseKey} \\\n  -e ANTHROPIC_API_KEY=your-key-here \\\n  -v caniship-data:/data \\\n  caniship/caniship:latest`
    await navigator.clipboard.writeText(cmd)
    setCopiedCmd(true)
    setTimeout(() => setCopiedCmd(false), 2000)
  }

  return (
    <div className="space-y-8">

      {/* Plan Selection */}
      <section className="rounded-2xl border border-dark-500 bg-dark-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-dark-600">
          <h2 className="font-semibold text-white">Plan</h2>
        </div>
        <div className="px-6 py-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {PLANS.map((p) => {
              const isCurrent = plan === p.id
              return (
                <div
                  key={p.id}
                  className={`relative rounded-xl border p-4 transition-colors ${
                    isCurrent
                      ? 'border-[color:var(--plan-color)] bg-[color:var(--plan-color)]/5'
                      : 'border-dark-500 bg-dark-700'
                  }`}
                  style={{ '--plan-color': p.color } as React.CSSProperties}
                >
                  {isCurrent && (
                    <span
                      className="absolute top-3 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: p.color, color: '#0A0A0A' }}
                    >
                      Current
                    </span>
                  )}
                  <div className="font-bold text-base mb-0.5" style={{ color: p.color }}>
                    {p.label}
                  </div>
                  <div className="text-sm text-white font-mono mb-1">{p.price}</div>
                  <div className="text-xs text-gray-500 mb-3">{p.audits}</div>
                  <ul className="space-y-1 mb-4">
                    {p.features.map((f) => (
                      <li key={f} className="text-xs text-gray-400 flex items-start gap-1.5">
                        <span className="text-neon-green mt-0.5">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  {!isCurrent && (
                    <>
                      {p.id === 'free' && plan !== 'free' ? (
                        // Downgrade to free → must go through portal
                        <button
                          onClick={handleBillingPortal}
                          disabled={billingLoading}
                          className="w-full py-2 border border-dark-400 text-xs text-gray-400 rounded-lg hover:border-gray-400 hover:text-white transition-colors disabled:opacity-50 font-mono"
                        >
                          {billingLoading ? 'Opening…' : 'Downgrade via portal →'}
                        </button>
                      ) : plan === 'free' ? (
                        // Upgrade from free → Stripe Checkout
                        <a
                          href={`/api/stripe/checkout?plan=${p.id}`}
                          className="block w-full py-2 text-center border font-bold text-xs rounded-lg transition-colors font-mono-brand"
                          style={{
                            borderColor: p.color,
                            color: p.color,
                          }}
                        >
                          Upgrade →
                        </a>
                      ) : (
                        // Paid → different paid → portal
                        <button
                          onClick={handleBillingPortal}
                          disabled={billingLoading}
                          className="w-full py-2 border border-dark-400 text-xs text-gray-400 rounded-lg hover:border-gray-400 hover:text-white transition-colors disabled:opacity-50 font-mono"
                        >
                          {billingLoading ? 'Opening…' : 'Switch plan via portal →'}
                        </button>
                      )}
                    </>
                  )}
                  {isCurrent && plan !== 'free' && hasStripeCustomer && (
                    <button
                      onClick={handleBillingPortal}
                      disabled={billingLoading}
                      className="w-full py-2 border border-dark-400 text-xs text-gray-400 rounded-lg hover:border-neon-green hover:text-neon-green transition-colors disabled:opacity-50 font-mono"
                    >
                      {billingLoading ? 'Opening…' : 'Manage billing →'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          {billingError && (
            <p className="text-sm text-red-400 mt-3">{billingError}</p>
          )}
        </div>
      </section>

      {/* Docker — Studio only */}
      {plan === 'studio' && (
        <section className="rounded-2xl border border-neon-green/20 bg-neon-green/5 overflow-hidden">
          <div className="px-6 py-4 border-b border-neon-green/10 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-white">Docker Self-Hosted</h2>
              <p className="text-xs text-gray-500 mt-0.5">Run CanIShip on your own machine — no data leaves your infrastructure</p>
            </div>
            <span className="text-xs font-mono bg-neon-green/10 text-neon-green border border-neon-green/20 px-2 py-1 rounded">Studio</span>
          </div>
          <div className="px-6 py-5 space-y-5">
            {licenseKey ? (
              <>
                {/* Step 1 */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Step 1 — Pull the image</p>
                  <div className="flex items-center gap-2 bg-dark-900 border border-dark-500 rounded-lg px-4 py-2.5">
                    <code className="flex-1 text-sm font-mono text-neon-green">docker pull caniship/caniship:latest</code>
                  </div>
                </div>

                {/* Step 2 */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Step 2 — Your license key</p>
                  <div className="flex items-center gap-3">
                    <code className="flex-1 text-sm font-mono text-neon-green bg-dark-900 border border-dark-500 px-4 py-2.5 rounded-lg truncate">
                      {licenseKey}
                    </code>
                    <button
                      onClick={copyLicense}
                      className="flex-shrink-0 px-3 py-2.5 border border-dark-400 text-xs text-gray-400 rounded-lg hover:border-neon-green hover:text-neon-green transition-colors font-mono"
                    >
                      {copied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>

                {/* Step 3 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Step 3 — Run it</p>
                    <button
                      onClick={copyDockerCmd}
                      className="text-xs text-gray-500 hover:text-neon-green transition-colors font-mono"
                    >
                      {copiedCmd ? '✓ Copied' : 'Copy command'}
                    </button>
                  </div>
                  <pre className="bg-dark-900 border border-dark-500 rounded-lg px-4 py-3 text-sm font-mono text-gray-300 overflow-x-auto leading-relaxed">
{`docker run -p 3000:3000 \\
  -e LICENSE_KEY=`}<span className="text-neon-green">{licenseKey}</span>{` \\
  -e ANTHROPIC_API_KEY=`}<span className="text-amber-400">your-anthropic-key</span>{` \\
  -v caniship-data:/data \\
  caniship/caniship:latest`}
                  </pre>
                  <p className="text-xs text-gray-600 mt-2">
                    Then open <span className="text-gray-400 font-mono">http://localhost:3000</span> — same interface, fully local.
                  </p>
                </div>

                {/* CI/CD note */}
                <div className="rounded-xl border border-dark-500 bg-dark-800 px-4 py-3 flex items-start gap-3">
                  <span className="text-lg mt-0.5">⚙️</span>
                  <div>
                    <p className="text-xs font-semibold text-white mb-0.5">Using in CI/CD?</p>
                    <p className="text-xs text-gray-500">
                      Add <code className="text-gray-300 font-mono">uses: actvli/caniship-action@v1</code> to any GitHub Actions workflow.
                      Set <code className="text-gray-300 font-mono">min_score: 75</code> to fail builds automatically.
                      Full guide in the <a href="https://github.com/hanimebar/CanIShip/blob/main/DOCKER.md" target="_blank" rel="noopener noreferrer" className="text-neon-green hover:underline">DOCKER.md</a>.
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-gray-400 mb-4">
                  Generate a license key to activate your self-hosted Docker image.
                  Your key authorises the container to run audits — keep it private.
                </p>
                {licenseError && (
                  <p className="text-sm text-red-400 mb-3">{licenseError}</p>
                )}
                <button
                  onClick={handleGenerateLicense}
                  disabled={licenseLoading}
                  className="px-5 py-2.5 bg-neon-green text-dark-900 font-bold text-sm rounded-lg hover:bg-neon-green-dim transition-colors disabled:opacity-50 font-mono-brand"
                >
                  {licenseLoading ? 'Generating…' : 'Generate license key'}
                </button>
              </>
            )}
          </div>
        </section>
      )}

      {/* Profile */}
      <section className="rounded-2xl border border-dark-500 bg-dark-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-dark-600">
          <h2 className="font-semibold text-white">Profile</h2>
        </div>
        <div className="px-6 py-5 space-y-5">
          {/* Email — display only */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Email address</label>
            <div className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-lg text-gray-400 text-sm font-mono">
              {email}
            </div>
            {isOAuthUser && (
              <p className="text-xs text-gray-600 mt-1.5">
                Email is managed by your OAuth provider (Google / GitHub).
              </p>
            )}
          </div>

          {/* Name */}
          <form onSubmit={handleNameUpdate}>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Display name</label>
            <div className="flex gap-3">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 px-4 py-3 bg-dark-700 border border-dark-400 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-neon-green focus:ring-1 focus:ring-neon-green text-sm transition-colors"
                disabled={nameLoading}
              />
              <button
                type="submit"
                disabled={nameLoading || !name.trim()}
                className="px-4 py-3 border border-dark-400 text-sm text-gray-300 rounded-lg hover:border-neon-green hover:text-neon-green transition-colors disabled:opacity-50 font-mono whitespace-nowrap"
              >
                {nameLoading ? 'Saving…' : 'Save'}
              </button>
            </div>
            {nameMsg && (
              <p className={`text-xs mt-2 ${nameMsg.startsWith('Error') ? 'text-red-400' : 'text-neon-green'}`}>
                {nameMsg}
              </p>
            )}
          </form>
        </div>
      </section>

      {/* Password */}
      <section className="rounded-2xl border border-dark-500 bg-dark-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-dark-600">
          <h2 className="font-semibold text-white">Password</h2>
        </div>
        {isOAuthUser ? (
          <div className="px-6 py-5">
            <p className="text-sm text-gray-500">
              Your password is managed by your OAuth provider (Google / GitHub). To change it, visit your provider&apos;s account settings.
            </p>
          </div>
        ) : (
          <form onSubmit={handlePasswordChange} className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full px-4 py-3 bg-dark-700 border border-dark-400 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-neon-green focus:ring-1 focus:ring-neon-green text-sm transition-colors"
                disabled={passwordLoading}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider">Confirm new password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="w-full px-4 py-3 bg-dark-700 border border-dark-400 rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-neon-green focus:ring-1 focus:ring-neon-green text-sm transition-colors"
                disabled={passwordLoading}
              />
            </div>
            {passwordMsg && (
              <p className={`text-sm ${passwordMsg.startsWith('Error') || passwordMsg.includes('match') || passwordMsg.includes('characters') ? 'text-red-400' : 'text-neon-green'}`}>
                {passwordMsg}
              </p>
            )}
            <button
              type="submit"
              disabled={passwordLoading || !newPassword || !confirmPassword}
              className="px-5 py-2.5 bg-neon-green text-dark-900 font-bold text-sm rounded-lg hover:bg-neon-green-dim transition-colors disabled:opacity-50 font-mono-brand"
            >
              {passwordLoading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}
      </section>

      {/* Danger zone */}
      <section className="rounded-2xl border border-red-500/20 bg-red-500/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-red-500/10">
          <h2 className="font-semibold text-red-400">Danger Zone</h2>
        </div>
        <div className="px-6 py-5">
          {plan !== 'free' ? (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                <svg className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <div>
                  <p className="text-sm font-semibold text-amber-400 mb-1">Active subscription detected</p>
                  <p className="text-sm text-gray-400">
                    You must cancel your subscription before deleting your account. Use the billing portal to cancel, then return here.
                  </p>
                </div>
              </div>
              <button
                onClick={handleBillingPortal}
                disabled={billingLoading}
                className="px-5 py-2.5 border border-amber-500/40 text-amber-400 text-sm rounded-lg hover:bg-amber-500/10 transition-colors disabled:opacity-50 font-mono"
              >
                {billingLoading ? 'Opening…' : 'Cancel subscription via billing portal →'}
              </button>
              {billingError && <p className="text-sm text-red-400">{billingError}</p>}
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-400 mb-4">
                Permanently delete your account and all associated data. This cannot be undone.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    Type your email address to confirm: <span className="text-gray-400 font-mono">{email}</span>
                  </label>
                  <input
                    type="email"
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder={email}
                    className="w-full px-4 py-3 bg-dark-800 border border-red-500/20 rounded-lg text-white placeholder-gray-700 focus:outline-none focus:border-red-500/50 text-sm transition-colors font-mono"
                  />
                </div>
                {deleteError && <p className="text-sm text-red-400">{deleteError}</p>}
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirm !== email || deleteLoading}
                  className="px-5 py-2.5 border border-red-500/40 text-red-400 text-sm rounded-lg hover:bg-red-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-mono"
                >
                  {deleteLoading ? 'Deleting account…' : 'Delete my account permanently'}
                </button>
              </div>
            </>
          )}
        </div>
      </section>

    </div>
  )
}
