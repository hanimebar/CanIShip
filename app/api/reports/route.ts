/**
 * GET /api/reports?job_id=... — Fetch a full audit report
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

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

export async function GET(req: NextRequest) {
  try {
    const supabase = createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const jobId = searchParams.get('job_id')
    const reportId = searchParams.get('report_id')

    const serviceClient = createSupabaseServiceClient()

    let query = serviceClient
      .from('audit_reports')
      .select('*, audit_jobs(url, description, depth, created_at)')
      .eq('user_id', user.id)

    if (jobId) {
      query = query.eq('job_id', jobId)
    } else if (reportId) {
      query = query.eq('id', reportId)
    } else {
      return NextResponse.json({ error: 'job_id or report_id required' }, { status: 400 })
    }

    const { data: report, error } = await query.single()

    if (error || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    // Fetch screenshots
    const { data: screenshots } = await serviceClient
      .from('screenshots')
      .select('*')
      .eq('job_id', report.job_id)
      .order('created_at', { ascending: true })

    return NextResponse.json({ report, screenshots: screenshots || [] })
  } catch (err) {
    console.error('[API] Reports GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
