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

export function SettingsClient({ currentName, email, plan, isOAuthUser, hasStripeCustomer, licenseKey }: Props) {
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

  // License copy
  const [copied, setCopied] = useState(false)

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

  async function copyLicense() {
    if (!licenseKey) return
    await navigator.clipboard.writeText(licenseKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const planLabels: Record<string, { label: string; color: string }> = {
    free: { label: 'Free', color: '#8E8E93' },
    builder: { label: 'Builder', color: '#0A84FF' },
    studio: { label: 'Studio', color: '#00FF88' },
  }
  const planDisplay = planLabels[plan] ?? planLabels.free

  return (
    <div className="space-y-8">

      {/* Plan & Billing */}
      <section className="rounded-2xl border border-dark-500 bg-dark-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-dark-600">
          <h2 className="font-semibold text-white">Plan & Billing</h2>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <div className="text-sm text-gray-400 mb-1">Current plan</div>
              <div className="flex items-center gap-2">
                <span className="font-mono-brand font-bold text-lg" style={{ color: planDisplay.color }}>
                  {planDisplay.label}
                </span>
                {plan === 'free' && (
                  <span className="text-xs text-gray-500">· 3 audits/month</span>
                )}
                {plan === 'builder' && (
                  <span className="text-xs text-gray-500">· 20 audits/month</span>
                )}
                {plan === 'studio' && (
                  <span className="text-xs text-gray-500">· Unlimited</span>
                )}
              </div>
            </div>
            {plan !== 'free' && hasStripeCustomer ? (
              <button
                onClick={handleBillingPortal}
                disabled={billingLoading}
                className="px-4 py-2 border border-dark-400 text-sm text-gray-300 rounded-lg hover:border-neon-green hover:text-neon-green transition-colors disabled:opacity-50 font-mono"
              >
                {billingLoading ? 'Opening…' : 'Manage billing →'}
              </button>
            ) : plan === 'free' ? (
              <a
                href="/pricing"
                className="px-4 py-2 bg-neon-green text-dark-900 text-sm font-bold rounded-lg hover:bg-neon-green-dim transition-colors font-mono-brand"
              >
                Upgrade →
              </a>
            ) : null}
          </div>
          {billingError && (
            <p className="text-sm text-red-400 mt-2">{billingError}</p>
          )}
          {plan !== 'free' && hasStripeCustomer && (
            <p className="text-xs text-gray-600 leading-relaxed">
              The billing portal lets you upgrade, downgrade, cancel your subscription,
              update your payment method, and download invoices.
            </p>
          )}
        </div>
      </section>

      {/* Docker License — Studio only */}
      {plan === 'studio' && (
        <section className="rounded-2xl border border-neon-green/20 bg-neon-green/5 overflow-hidden">
          <div className="px-6 py-4 border-b border-neon-green/10">
            <h2 className="font-semibold text-white">Docker License Key</h2>
          </div>
          <div className="px-6 py-5">
            {licenseKey ? (
              <>
                <p className="text-xs text-gray-400 mb-3">
                  Use this key as <code className="text-neon-green bg-dark-700 px-1.5 py-0.5 rounded font-mono">DOCKER_LICENSE_KEY</code> when running the self-hosted Docker image.
                </p>
                <div className="flex items-center gap-3">
                  <code className="flex-1 text-sm font-mono text-neon-green bg-dark-800 border border-dark-500 px-4 py-2.5 rounded-lg truncate">
                    {licenseKey}
                  </code>
                  <button
                    onClick={copyLicense}
                    className="flex-shrink-0 px-3 py-2.5 border border-dark-400 text-xs text-gray-400 rounded-lg hover:border-neon-green hover:text-neon-green transition-colors font-mono"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-400">License key is being generated. Refresh in a moment.</p>
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
                Email is managed by your {isOAuthUser ? 'OAuth provider (Google / GitHub)' : 'account'}.
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

      {/* Password — only for email/password users */}
      {!isOAuthUser && (
        <section className="rounded-2xl border border-dark-500 bg-dark-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-dark-600">
            <h2 className="font-semibold text-white">Change Password</h2>
          </div>
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
        </section>
      )}

      {/* Danger zone */}
      <section className="rounded-2xl border border-red-500/20 bg-red-500/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-red-500/10">
          <h2 className="font-semibold text-red-400">Danger Zone</h2>
        </div>
        <div className="px-6 py-5">
          <p className="text-sm text-gray-400 mb-4">
            Permanently delete your account and all associated data. This cannot be undone.
            Active subscriptions should be cancelled first via the billing portal.
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
        </div>
      </section>

    </div>
  )
}
