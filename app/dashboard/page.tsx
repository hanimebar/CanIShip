import { redirect } from 'next/navigation'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { SiteGroup } from '@/components/SiteGroup'

function createServerSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url)
    return (u.hostname + u.pathname).replace(/\/$/, '').toLowerCase()
  } catch {
    return url.toLowerCase()
  }
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { upgraded?: string }
}) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const serviceClient = createSupabaseServiceClient()

  const [jobsResult, profileResult] = await Promise.all([
    serviceClient
      .from('audit_jobs')
      .select('*, audit_reports(id, ship_score, ship_verdict)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100),
    serviceClient
      .from('profiles')
      .select('plan, audits_used_this_month, audits_reset_at')
      .eq('id', user.id)
      .single(),
  ])

  const jobs = jobsResult.data || []
  const profile = profileResult.data

  const planLimits = { free: 3, builder: 15, studio: Infinity }
  const plan = profile?.plan || 'free'
  const limit = planLimits[plan as keyof typeof planLimits] ?? 3
  const used = profile?.audits_used_this_month ?? 0

  // Group jobs by normalized URL, preserving recency order
  const groupMap = new Map<string, typeof jobs>()
  for (const job of jobs) {
    const key = normalizeUrl(job.url)
    if (!groupMap.has(key)) groupMap.set(key, [])
    groupMap.get(key)!.push(job)
  }

  // Convert to array sorted by most recent audit across all sites
  const groups = Array.from(groupMap.entries()).map(([, audits]) => ({
    url: audits[0].url,
    audits: audits.map(j => ({
      ...j,
      audit_reports: Array.isArray(j.audit_reports) ? j.audit_reports[0] ?? null : j.audit_reports ?? null,
    })),
  }))

  return (
    <div className="min-h-screen bg-dark-900 text-white">

      {/* Nav */}
      <nav className="border-b border-dark-600 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/">
            <img src="/logo.svg" alt="CanIShip" height={32} style={{ height: 32, width: 'auto' }} />
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-xs font-mono text-gray-500 capitalize">{plan} plan</span>
            <Link href="/settings" className="text-sm text-gray-400 hover:text-white transition-colors">
              Settings
            </Link>
            <form action="/api/auth/signout" method="POST">
              <button type="submit" className="text-sm text-gray-400 hover:text-white transition-colors">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Upgraded banner */}
        {searchParams.upgraded === 'true' && (
          <div className="mb-6 rounded-xl border border-neon-green/30 bg-neon-green/10 px-5 py-4 flex items-center gap-3">
            <svg className="w-5 h-5 text-neon-green flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <span className="font-semibold text-neon-green">Upgrade successful!</span>
              <span className="text-gray-300 text-sm ml-2">
                You now have access to all {plan} plan features.
              </span>
            </div>
          </div>
        )}

        {/* Header row */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">My Sites</h1>
            <p className="text-gray-500 text-sm mt-1">
              {limit === Infinity
                ? 'Unlimited audits'
                : `${used} / ${limit} audits used this month`}
              {plan === 'free' && (
                <span className="ml-2">
                  —{' '}
                  <Link href="/pricing" className="text-neon-green hover:underline">
                    Upgrade for more
                  </Link>
                </span>
              )}
            </p>
          </div>
          <Link
            href="/audit/new"
            className="px-5 py-2.5 bg-neon-green text-dark-900 font-bold text-sm rounded-lg hover:bg-neon-green-dim transition-colors font-mono-brand"
          >
            + New Audit
          </Link>
        </div>

        {/* Usage bar */}
        {limit !== Infinity && (
          <div className="mb-8">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
              <span>Monthly usage</span>
              <span>{used}/{limit}</span>
            </div>
            <div className="h-1.5 bg-dark-600 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, (used / limit) * 100)}%`,
                  backgroundColor: used >= limit ? '#FF3B30' : '#00FF88',
                }}
              />
            </div>
          </div>
        )}

        {/* Site groups */}
        {groups.length === 0 ? (
          <div className="text-center py-20 border border-dark-500 rounded-2xl bg-dark-800">
            <div className="w-14 h-14 rounded-full bg-dark-600 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">No audits yet</h3>
            <p className="text-gray-500 text-sm mb-6">Run your first audit to get your ShipScore.</p>
            <Link
              href="/audit/new"
              className="inline-block px-6 py-3 bg-neon-green text-dark-900 font-bold text-sm rounded-lg hover:bg-neon-green-dim transition-colors"
            >
              Run first audit
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group, i) => (
              <SiteGroup
                key={group.url}
                url={group.url}
                audits={group.audits}
                defaultOpen={i === 0}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
