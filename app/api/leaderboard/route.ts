/**
 * GET /api/leaderboard — Public. No auth required.
 * Returns the top 20 public audit scores from the last 7 days.
 */

import { NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'

export const runtime = 'nodejs'

const DOCKER_MODE = process.env.DOCKER_MODE === 'true'
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export async function GET() {
  try {
    if (DOCKER_MODE) {
      const { dockerDb } = await import('@/lib/docker-db')
      const cutoff = new Date(Date.now() - SEVEN_DAYS_MS).toISOString()
      const jobs = dockerDb.listJobs()

      const entries = jobs
        .filter(j => j.status === 'complete' && j.is_public !== false && j.created_at >= cutoff)
        .flatMap(j => {
          const report = dockerDb.getReport(j.id)
          if (!report) return []
          let hostname = j.url
          try { hostname = new URL(j.url).hostname } catch { /* leave as-is */ }
          return [{
            hostname,
            description: j.description.slice(0, 120),
            score: report.ship_score,
            verdict: report.ship_verdict,
            app_icon_url: j.app_icon_url ?? null,
          }]
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 20)

      return NextResponse.json({ entries })
    }

    const supabase = createSupabaseServiceClient()
    const cutoff = new Date(Date.now() - SEVEN_DAYS_MS).toISOString()

    const { data, error } = await supabase
      .from('audit_reports')
      .select('ship_score, ship_verdict, audit_jobs!inner(url, description, is_public, created_at, app_icon_url)')
      .eq('audit_jobs.is_public', true)
      .gte('audit_jobs.created_at', cutoff)
      .order('ship_score', { ascending: false })
      .limit(20)

    if (error) {
      console.error('[Leaderboard] Query error:', error)
      return NextResponse.json({ error: 'Failed to load leaderboard' }, { status: 500 })
    }

    const entries = (data ?? []).map(r => {
      const job = r.audit_jobs as unknown as { url: string; description: string; app_icon_url?: string }
      let hostname = job.url
      try { hostname = new URL(job.url).hostname } catch { /* leave as-is */ }
      return {
        hostname,
        description: job.description.slice(0, 120),
        score: r.ship_score,
        verdict: r.ship_verdict,
        app_icon_url: job.app_icon_url ?? null,
      }
    })

    return NextResponse.json({ entries })
  } catch (err) {
    console.error('[Leaderboard] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
