import { redirect } from 'next/navigation'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createSupabaseServiceClient } from '@/lib/supabase'

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

function getScoreColor(score: number): string {
  if (score >= 90) return '#00FF88'
  if (score >= 70) return '#7CFF5A'
  if (score >= 50) return '#FFD60A'
  if (score >= 30) return '#FF9500'
  return '#FF3B30'
}

function getVerdictLabel(verdict: string): string {
  return { yes: 'SHIP IT', conditional: 'CONDITIONAL', no: 'DO NOT SHIP' }[verdict] || verdict.toUpperCase()
}

function getVerdictColor(verdict: string): string {
  return { yes: '#00FF88', conditional: '#FFD60A', no: '#FF3B30' }[verdict] || '#8E8E93'
}

function getStatusColor(status: string): string {
  return {
    queued: '#8E8E93',
    running: '#0A84FF',
    complete: '#00FF88',
    failed: '#FF3B30',
  }[status] || '#8E8E93'
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
      .limit(50),
    serviceClient
      .from('profiles')
      .select('plan, audits_used_this_month, audits_reset_at')
      .eq('id', user.id)
      .single(),
  ])

  const jobs = jobsResult.data || []
  const profile = profileResult.data

  const planLimits = { free: 3, builder: 20, studio: Infinity }
  const plan = profile?.plan || 'free'
  const limit = planLimits[plan as keyof typeof planLimits] ?? 3
  const used = profile?.audits_used_this_month ?? 0

  return (
    <div className="min-h-screen bg-dark-900 text-white">

      {/* Nav */}
      <nav className="border-b border-dark-600 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-mono-brand font-bold text-neon-green text-xl">
            CanIShip
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-xs font-mono text-gray-500 capitalize">{plan} plan</span>
            <form action="/api/auth/signout" method="POST">
              <button
                type="submit"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
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
            <h1 className="text-2xl font-bold text-white">Audit History</h1>
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

        {/* Audit list */}
        {jobs.length === 0 ? (
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
            {jobs.map((job: Record<string, unknown> & { id: string; url: string; status: string; depth: string; created_at: string; audit_reports: unknown; error_message?: string }) => {
              const report = Array.isArray(job.audit_reports) ? job.audit_reports[0] : job.audit_reports
              const statusColor = getStatusColor(job.status)

              return (
                <div
                  key={job.id}
                  className="rounded-xl border border-dark-500 bg-dark-800 p-5 hover:border-dark-400 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* Left */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: statusColor }}
                        />
                        <span className="text-xs font-mono text-gray-500 capitalize">{job.status}</span>
                        <span className="text-gray-700">·</span>
                        <span className="text-xs font-mono text-gray-500 capitalize">{job.depth}</span>
                      </div>
                      <div className="font-mono text-sm text-neon-green truncate mb-1">{job.url}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(job.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </div>
                    </div>

                    {/* Right — score or status */}
                    <div className="flex items-center gap-4 flex-shrink-0">
                      {report && job.status === 'complete' ? (
                        <div className="text-right">
                          <div
                            className="font-mono-brand font-bold text-2xl"
                            style={{ color: getScoreColor(report.ship_score) }}
                          >
                            {report.ship_score}
                          </div>
                          <div
                            className="text-xs font-mono font-bold"
                            style={{ color: getVerdictColor(report.ship_verdict) }}
                          >
                            {getVerdictLabel(report.ship_verdict)}
                          </div>
                        </div>
                      ) : job.status === 'running' ? (
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <svg className="w-4 h-4 animate-spin text-blue-400" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Running...
                        </div>
                      ) : job.status === 'failed' ? (
                        <div className="text-xs text-red-400 font-mono">Failed</div>
                      ) : (
                        <div className="text-xs text-gray-500 font-mono">Queued</div>
                      )}

                      {/* View report link */}
                      {job.status === 'complete' && report ? (
                        <Link
                          href={`/report/${job.id}`}
                          className="px-3 py-1.5 border border-dark-400 text-xs text-gray-300 rounded-lg hover:border-neon-green hover:text-neon-green transition-colors font-mono"
                        >
                          View report
                        </Link>
                      ) : job.status === 'queued' || job.status === 'running' ? (
                        <Link
                          href={`/audit/${job.id}/status`}
                          className="px-3 py-1.5 border border-dark-400 text-xs text-gray-300 rounded-lg hover:border-blue-400 hover:text-blue-400 transition-colors font-mono"
                        >
                          Check status
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
