/**
 * POST /api/audit — Creates a new audit job
 * GET  /api/audit — Lists audit jobs for the current user
 *
 * NOTE: This route only creates database records. The actual audit
 * processing happens in the standalone worker (scripts/run-worker.js
 * or via the polling pattern). No heavy imports here.
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

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceClient = createSupabaseServiceClient()
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('plan, audits_used_this_month, audits_reset_at')
      .eq('id', user.id)
      .single()

    const limits: Record<string, number> = { free: 3, builder: 10, studio: 99999 }
    const plan = profile?.plan || 'free'
    const limit = limits[plan] ?? 3

    // Reset monthly counter if needed
    const now = new Date()
    const resetAt = profile?.audits_reset_at ? new Date(profile.audits_reset_at) : now
    if (now >= resetAt) {
      await serviceClient
        .from('profiles')
        .update({
          audits_used_this_month: 0,
          audits_reset_at: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString(),
        })
        .eq('id', user.id)
    }

    const used = now >= resetAt ? 0 : (profile?.audits_used_this_month ?? 0)
    if (used >= limit) {
      return NextResponse.json(
        { error: 'Monthly audit limit reached', plan, limit, used, upgrade_url: '/pricing' },
        { status: 429 }
      )
    }

    const body = await req.json()
    const { url, description, flows, depth } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }
    if (!description || typeof description !== 'string' || description.trim().length < 10) {
      return NextResponse.json({ error: 'Description must be at least 10 characters' }, { status: 400 })
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`)
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error()
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }

    const validDepths = ['quick', 'standard', 'deep']
    const auditDepth = validDepths.includes(depth) ? depth : 'quick'

    if (plan === 'free' && auditDepth !== 'quick') {
      return NextResponse.json(
        { error: 'Full scan depths require a Builder or Studio plan', upgrade_url: '/pricing' },
        { status: 403 }
      )
    }

    const { data: job, error: insertError } = await serviceClient
      .from('audit_jobs')
      .insert({
        user_id: user.id,
        url: parsedUrl.href,
        description: description.trim(),
        flows: Array.isArray(flows) ? flows.filter((f: unknown) => typeof f === 'string') : [],
        depth: auditDepth,
        status: 'queued',
      })
      .select()
      .single()

    if (insertError || !job) {
      console.error('[API] Job insert error:', insertError)
      return NextResponse.json({ error: 'Failed to create audit job' }, { status: 500 })
    }

    await serviceClient
      .from('profiles')
      .update({ audits_used_this_month: used + 1 })
      .eq('id', user.id)

    // If REDIS_URL is set, enqueue to BullMQ
    // If not, the Supabase polling worker picks it up automatically
    if (process.env.REDIS_URL) {
      try {
        // Use dynamic import with webpackIgnore to avoid bundling
        const redisUrl = process.env.REDIS_URL
        const jobId = job.id

        // Fire-and-forget: enqueue asynchronously
        setImmediate(async () => {
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const { Queue } = require(/* webpackIgnore: true */ 'bullmq')
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const IORedis = require(/* webpackIgnore: true */ 'ioredis')
            const conn = new IORedis(redisUrl, { maxRetriesPerRequest: null })
            const queue = new Queue('audit-jobs', { connection: conn })
            await queue.add('run-audit', job, { jobId, attempts: 2 })
            await conn.quit()
          } catch (err) {
            console.error('[API] Redis enqueue failed (polling will pick up):', err)
          }
        })
      } catch {
        // Non-fatal: polling worker will handle it
      }
    }

    return NextResponse.json({ job_id: job.id, status: 'queued' }, { status: 201 })
  } catch (err) {
    console.error('[API] Audit POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceClient = createSupabaseServiceClient()
    const { data: jobs, error } = await serviceClient
      .from('audit_jobs')
      .select('*, audit_reports(id, ship_score, ship_verdict)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch jobs' }, { status: 500 })
    }

    return NextResponse.json({ jobs })
  } catch (err) {
    console.error('[API] Audit GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
