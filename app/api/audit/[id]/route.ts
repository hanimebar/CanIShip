/**
 * GET /api/audit/[id] — Poll job status (called every 5s by frontend)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const DOCKER_MODE = process.env.DOCKER_MODE === 'true'

export const runtime = 'nodejs'

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

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // ── Docker mode: no auth required, use local DB ──────────────────────────
    if (DOCKER_MODE) {
      const { dockerDb } = await import('@/lib/docker-db')
      const { id } = params
      if (!id) return NextResponse.json({ error: 'Job ID required' }, { status: 400 })

      const job = dockerDb.getJob(id)
      if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

      if (job.status === 'complete') {
        const report = dockerDb.getReport(id)
        return NextResponse.json({
          status: job.status,
          job_id: job.id,
          report_id: report?.id,
          ship_score: report?.ship_score,
          ship_verdict: report?.ship_verdict,
          completed_at: job.completed_at,
        })
      }

      return NextResponse.json({
        status: job.status,
        job_id: job.id,
        error_message: job.error_message,
        started_at: job.started_at,
        created_at: job.created_at,
      })
    }

    const supabase = createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    if (!id) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 })
    }

    const serviceClient = createSupabaseServiceClient()

    // Fetch job — verify ownership
    const { data: job, error: jobError } = await serviceClient
      .from('audit_jobs')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    // If complete, include report summary
    if (job.status === 'complete') {
      const { data: report } = await serviceClient
        .from('audit_reports')
        .select('id, ship_score, ship_verdict')
        .eq('job_id', id)
        .single()

      return NextResponse.json({
        status: job.status,
        job_id: job.id,
        report_id: report?.id,
        ship_score: report?.ship_score,
        ship_verdict: report?.ship_verdict,
        completed_at: job.completed_at,
      })
    }

    return NextResponse.json({
      status: job.status,
      job_id: job.id,
      current_step: job.current_step,
      error_message: job.error_message,
      started_at: job.started_at,
      created_at: job.created_at,
    })
  } catch (err) {
    console.error('[API] Audit status error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
