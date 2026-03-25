import Link from 'next/link'
import { createSupabaseServiceClient } from '@/lib/supabase'

export const revalidate = 300 // refresh every 5 minutes

const DOCKER_MODE = process.env.DOCKER_MODE === 'true'
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

type Entry = {
  hostname: string
  description: string
  score: number
  verdict: 'yes' | 'no' | 'conditional'
  app_icon_url?: string | null
}

function getScoreColor(score: number): string {
  if (score >= 90) return '#00FF88'
  if (score >= 70) return '#7CFF5A'
  if (score >= 50) return '#FFD60A'
  if (score >= 30) return '#FF9500'
  return '#FF3B30'
}

async function getEntries(): Promise<Entry[]> {
  try {
    if (DOCKER_MODE) {
      const { dockerDb } = await import('@/lib/docker-db')
      const cutoff = new Date(Date.now() - SEVEN_DAYS_MS).toISOString()
      const seen = new Set<string>()
      return dockerDb.listJobs()
        .filter(j => j.status === 'complete' && j.is_public !== false && j.created_at >= cutoff)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .reduce<Entry[]>((acc, j) => {
          const report = dockerDb.getReport(j.id)
          if (!report) return acc
          let hostname = j.url
          try { hostname = new URL(j.url).hostname } catch { /* leave as-is */ }
          if (seen.has(hostname)) return acc
          seen.add(hostname)
          acc.push({ hostname, description: j.description.slice(0, 120), score: report.ship_score, verdict: report.ship_verdict, app_icon_url: j.app_icon_url ?? null })
          return acc
        }, [])
        .sort((a, b) => b.score - a.score)
        .slice(0, 20)
    }

    const supabase = createSupabaseServiceClient()
    const cutoff = new Date(Date.now() - SEVEN_DAYS_MS).toISOString()

    const { data } = await supabase
      .from('audit_reports')
      .select('ship_score, ship_verdict, audit_jobs!inner(url, description, is_public, created_at, app_icon_url)')
      .eq('audit_jobs.is_public', true)
      .gte('audit_jobs.created_at', cutoff)
      .limit(200)

    // Sort by created_at DESC in JS (don't rely on referencedTable ordering),
    // then deduplicate by hostname keeping the most recent audit per product.
    const seen = new Set<string>()
    return (data ?? [])
      .sort((a, b) => {
        const jobA = a.audit_jobs as unknown as { created_at: string }
        const jobB = b.audit_jobs as unknown as { created_at: string }
        return jobB.created_at.localeCompare(jobA.created_at)
      })
      .reduce<Entry[]>((acc, r) => {
        const job = r.audit_jobs as unknown as { url: string; description: string; created_at: string; app_icon_url?: string }
        let hostname = job.url
        try { hostname = new URL(job.url).hostname } catch { /* leave as-is */ }
        if (seen.has(hostname)) return acc
        seen.add(hostname)
        acc.push({ hostname, description: job.description.slice(0, 120), score: r.ship_score, verdict: r.ship_verdict, app_icon_url: job.app_icon_url ?? null })
        return acc
      }, [])
      .sort((a, b) => b.score - a.score)
      .slice(0, 20)
  } catch {
    return []
  }
}

const VERDICT_STYLE: Record<string, string> = {
  yes:         'text-neon-green',
  conditional: 'text-yellow-400',
  no:          'text-red-400',
}

const VERDICT_LABEL: Record<string, string> = {
  yes:         'SHIP IT',
  conditional: 'CONDITIONAL',
  no:          'NOT YET',
}

export default async function LeaderboardPage() {
  const entries = await getEntries()

  return (
    <main className="min-h-screen bg-dark-900 text-white px-4 py-12 font-mono-brand">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="mb-10">
          <Link href="/" className="text-gray-500 hover:text-gray-300 text-sm mb-6 block">← Back to CanIShip</Link>
          <h1 className="text-3xl font-bold text-neon-green mb-2">Top Scores This Week</h1>
          <p className="text-gray-400 text-sm">
            Highest-scoring public audits in the last 7 days. Scores are out of 100.00.
          </p>
        </div>

        {entries.length === 0 ? (
          <div className="rounded-xl border border-dark-600 bg-dark-800 px-6 py-16 text-center text-gray-500">
            No public audits yet this week.{' '}
            <Link href="/audit/new" className="text-neon-green hover:underline">Run the first one →</Link>
          </div>
        ) : (
          <div className="rounded-xl border border-dark-600 overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[2fr_3fr_auto_auto] gap-4 px-5 py-3 bg-dark-800 border-b border-dark-600 text-xs text-gray-500 uppercase tracking-wider">
              <span>App</span>
              <span>Description</span>
              <span className="text-right">Score</span>
              <span className="text-right">Verdict</span>
            </div>

            {/* Rows */}
            {entries.map((entry, i) => (
              <div
                key={i}
                className="grid grid-cols-[2fr_3fr_auto_auto] gap-4 px-5 py-4 border-b border-dark-700 last:border-0 hover:bg-dark-800/50 transition-colors items-center"
              >
                {/* Rank + icon + hostname */}
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs text-gray-600 w-5 shrink-0">{i + 1}</span>
                  {entry.app_icon_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={entry.app_icon_url}
                      alt=""
                      width={24}
                      height={24}
                      className="w-6 h-6 rounded object-cover shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span
                      className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold shrink-0 bg-dark-600 text-gray-400"
                    >
                      {entry.hostname.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className="text-white font-semibold truncate text-sm">{entry.hostname}</span>
                </div>

                {/* Description */}
                <p className="text-gray-400 text-xs truncate">{entry.description}</p>

                {/* Score */}
                <span
                  className="font-bold text-sm tabular-nums text-right"
                  style={{ color: getScoreColor(Number(entry.score)) }}
                >
                  {Number(entry.score).toFixed(2)}
                </span>

                {/* Verdict */}
                <span className={`text-xs font-bold text-right ${VERDICT_STYLE[entry.verdict] ?? 'text-gray-400'}`}>
                  {VERDICT_LABEL[entry.verdict] ?? entry.verdict.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        )}

        <p className="mt-6 text-center text-xs text-gray-600">
          Refreshes every 5 minutes · Only audits opted into the leaderboard appear here
        </p>
      </div>
    </main>
  )
}
