/**
 * POST /api/audit — Creates a new audit job
 * GET  /api/audit — Lists audit jobs for the current user
 *
 * Auth: Supabase session cookie OR Authorization: Bearer <api_key>
 *
 * NOTE: This route only creates database records. The actual audit
 * processing happens in the standalone worker. No heavy imports here.
 *
 * ── SQL to deploy in Supabase (run once) ──────────────────────────────────
 *
 *   -- Atomic audit counter: increments only if under limit, handles monthly reset
 *   CREATE OR REPLACE FUNCTION increment_audit_count(p_user_id UUID, p_limit INT)
 *   RETURNS TABLE(success BOOLEAN, used INT, plan TEXT) LANGUAGE plpgsql AS $$
 *   DECLARE
 *     v_used INT; v_plan TEXT; v_reset_at TIMESTAMPTZ;
 *   BEGIN
 *     SELECT audits_used_this_month, plan, audits_reset_at
 *       INTO v_used, v_plan, v_reset_at FROM profiles WHERE id = p_user_id FOR UPDATE;
 *     IF NOW() >= v_reset_at OR v_reset_at IS NULL THEN
 *       v_used := 0;
 *       UPDATE profiles SET audits_used_this_month = 0,
 *         audits_reset_at = DATE_TRUNC('month', NOW() + INTERVAL '1 month') WHERE id = p_user_id;
 *     END IF;
 *     IF v_used >= p_limit THEN RETURN QUERY SELECT FALSE, v_used, v_plan; RETURN; END IF;
 *     UPDATE profiles SET audits_used_this_month = v_used + 1 WHERE id = p_user_id;
 *     RETURN QUERY SELECT TRUE, v_used + 1, v_plan;
 *   END; $$;
 *
 *   -- Add callback_url column if not already present:
 *   ALTER TABLE audit_jobs ADD COLUMN IF NOT EXISTS callback_url TEXT;
 *
 * ─────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { checkSsrf } from '@/lib/ssrf-guard'
import { resolveApiKey } from '@/lib/api-auth'

const DOCKER_MODE = process.env.DOCKER_MODE === 'true'

export const runtime = 'nodejs'

const PLAN_LIMITS: Record<string, number> = { free: 3, builder: 15, studio: 99999 }

function createSessionSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  )
}

/** Resolve user from session cookie or API key Bearer token. */
async function resolveUser(req: NextRequest): Promise<{ userId: string; via: 'session' | 'api_key' } | null> {
  const authHeader = req.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const rawKey = authHeader.slice(7)
    const result = await resolveApiKey(rawKey)
    if (result.authenticated) return { userId: result.userId, via: 'api_key' }
    return null
  }

  try {
    const supabase = createSessionSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) return { userId: user.id, via: 'session' }
  } catch { /* fall through */ }

  return null
}

export async function POST(req: NextRequest) {
  try {
    // ── Docker mode: bypass Supabase auth, use local DB ─────────────────────
    if (DOCKER_MODE) {
      return handleDockerPost(req)
    }

    const identity = await resolveUser(req)
    if (!identity) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { userId } = identity

    // ── Parse body first so we can validate inputs before touching the DB ──
    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { url, description, flows, depth, callback_url, target_platform, is_public, app_icon_url, auth_config } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'url is required' }, { status: 400 })
    }
    if (!description || typeof description !== 'string' || description.trim().length < 10) {
      return NextResponse.json({ error: 'description must be at least 10 characters' }, { status: 400 })
    }

    // ── URL validation ──────────────────────────────────────────────────────
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`)
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error()
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
    }

    // ── SSRF guard — block private/internal IPs ─────────────────────────────
    const ssrfCheck = await checkSsrf(parsedUrl.href)
    if (!ssrfCheck.allowed) {
      return NextResponse.json(
        { error: `URL not allowed: ${ssrfCheck.reason}` },
        { status: 400 }
      )
    }

    // ── Validate app_icon_url — must be https:// to prevent data: URI injection ─
    let safeIconUrl: string | undefined
    if (app_icon_url && typeof app_icon_url === 'string') {
      try {
        const iconParsed = new URL(app_icon_url.trim())
        if (iconParsed.protocol !== 'https:') throw new Error()
        safeIconUrl = iconParsed.href
      } catch {
        return NextResponse.json(
          { error: 'app_icon_url must be a valid https:// URL' },
          { status: 400 }
        )
      }
    }

    // ── Validate callback_url if provided ───────────────────────────────────
    let callbackUrl: string | undefined
    if (callback_url !== undefined) {
      if (typeof callback_url !== 'string') {
        return NextResponse.json({ error: 'callback_url must be a string' }, { status: 400 })
      }
      try {
        const cbParsed = new URL(callback_url)
        if (!['http:', 'https:'].includes(cbParsed.protocol)) throw new Error()
        // SSRF guard on callback URL too — prevent internal webhook abuse
        const cbSsrf = await checkSsrf(callback_url)
        if (!cbSsrf.allowed) {
          return NextResponse.json({ error: `callback_url not allowed: ${cbSsrf.reason}` }, { status: 400 })
        }
        callbackUrl = cbParsed.href
      } catch {
        return NextResponse.json({ error: 'callback_url must be a valid https URL' }, { status: 400 })
      }
    }

    const validDepths = ['quick', 'standard', 'deep']
    const auditDepth = validDepths.includes(depth as string) ? (depth as string) : 'quick'

    const validPlatforms = ['mobile', 'desktop', 'all']
    const auditPlatform = validPlatforms.includes(target_platform as string) ? (target_platform as string) : 'all'

    // ── Atomic counter increment via Postgres RPC ───────────────────────────
    // Falls back to the legacy read-modify-write if the RPC is not deployed yet.
    const serviceClient = createSupabaseServiceClient()
    let planForDepthCheck = 'free'

    const { data: rpcResult, error: rpcError } = await serviceClient
      .rpc('increment_audit_count', {
        p_user_id: userId,
        p_limit: PLAN_LIMITS['free'], // placeholder — RPC uses the user's actual plan limit
      })

    if (rpcError) {
      // RPC not deployed yet — fall back to safe manual check
      const { data: profile } = await serviceClient
        .from('profiles')
        .select('plan, audits_used_this_month, audits_reset_at')
        .eq('id', userId)
        .single()

      planForDepthCheck = profile?.plan || 'free'
      const limit = PLAN_LIMITS[planForDepthCheck] ?? 3
      const now = new Date()
      const resetAt = profile?.audits_reset_at ? new Date(profile.audits_reset_at) : now

      if (now >= resetAt) {
        await serviceClient
          .from('profiles')
          .update({
            audits_used_this_month: 0,
            audits_reset_at: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString(),
          })
          .eq('id', userId)
      }

      const used = now >= resetAt ? 0 : (profile?.audits_used_this_month ?? 0)
      if (used >= limit) {
        return NextResponse.json(
          { error: 'Monthly audit limit reached', plan: planForDepthCheck, limit, used, upgrade_url: '/pricing' },
          { status: 429 }
        )
      }
      await serviceClient
        .from('profiles')
        .update({ audits_used_this_month: used + 1 })
        .eq('id', userId)
    } else {
      // RPC succeeded
      const row = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult
      if (!row?.success) {
        const { data: profile } = await serviceClient
          .from('profiles')
          .select('plan')
          .eq('id', userId)
          .single()
        planForDepthCheck = profile?.plan || 'free'
        const limit = PLAN_LIMITS[planForDepthCheck] ?? 3
        return NextResponse.json(
          { error: 'Monthly audit limit reached', plan: planForDepthCheck, limit, upgrade_url: '/pricing' },
          { status: 429 }
        )
      }
      planForDepthCheck = row.plan || 'free'
    }

    if (planForDepthCheck === 'free' && auditDepth !== 'quick') {
      return NextResponse.json(
        { error: 'Full scan depths require a Builder or Studio plan', upgrade_url: '/pricing' },
        { status: 403 }
      )
    }

    // ── Validate auth_config if provided ────────────────────────────────────
    // auth_config is stored temporarily in audit_jobs.auth_config (JSONB) and
    // cleared by the worker before any audit runs.
    // SQL: ALTER TABLE audit_jobs ADD COLUMN IF NOT EXISTS auth_config JSONB;
    let validatedAuthConfig: Record<string, unknown> | undefined
    if (auth_config !== undefined) {
      if (typeof auth_config !== 'object' || auth_config === null) {
        return NextResponse.json({ error: 'auth_config must be an object' }, { status: 400 })
      }
      const ac = auth_config as Record<string, unknown>
      if (ac.type === 'form') {
        if (typeof ac.email !== 'string' || !ac.email) {
          return NextResponse.json({ error: 'auth_config.email is required for form auth' }, { status: 400 })
        }
        if (typeof ac.password !== 'string' || !ac.password) {
          return NextResponse.json({ error: 'auth_config.password is required for form auth' }, { status: 400 })
        }
        validatedAuthConfig = ac
      } else if (ac.type === 'cookie') {
        if (!Array.isArray(ac.cookies) || ac.cookies.length === 0) {
          return NextResponse.json({ error: 'auth_config.cookies must be a non-empty array' }, { status: 400 })
        }
        validatedAuthConfig = ac
      } else {
        return NextResponse.json({ error: 'auth_config.type must be "form" or "cookie"' }, { status: 400 })
      }
    }

    const { data: job, error: insertError } = await serviceClient
      .from('audit_jobs')
      .insert({
        user_id: userId,
        url: parsedUrl.href,
        description: description.trim(),
        flows: Array.isArray(flows) ? flows.filter((f: unknown) => typeof f === 'string') : [],
        depth: auditDepth,
        target_platform: auditPlatform,
        is_public: is_public !== false,
        ...(safeIconUrl ? { app_icon_url: safeIconUrl } : {}),
        status: 'queued',
        ...(callbackUrl ? { callback_url: callbackUrl } : {}),
        ...(validatedAuthConfig ? { auth_config: validatedAuthConfig } : {}),
      })
      .select()
      .single()

    if (insertError || !job) {
      console.error('[API] Job insert error:', insertError)
      return NextResponse.json({ error: 'Failed to create audit job' }, { status: 500 })
    }

    // ── Dispatch to executor ────────────────────────────────────────────────
    // Priority: Trigger.dev (if TRIGGER_SECRET_KEY set) → BullMQ (if REDIS_URL set) → Supabase polling
    if (process.env.TRIGGER_SECRET_KEY) {
      setImmediate(async () => {
        try {
          const { tasks } = await import('@trigger.dev/sdk/v3')
          await tasks.trigger('audit-pipeline', job)
        } catch (err) {
          console.error('[API] Trigger.dev dispatch failed (polling will pick up):', err)
        }
      })
    } else if (process.env.REDIS_URL) {
      const redisUrl = process.env.REDIS_URL
      const jobId = job.id
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
    }
    // else: Supabase polling worker picks it up on its next 5-second poll

    return NextResponse.json({ job_id: job.id, status: 'queued' }, { status: 201 })
  } catch (err) {
    console.error('[API] Audit POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    if (DOCKER_MODE) {
      const { dockerDb } = await import('@/lib/docker-db')
      const jobs = dockerDb.listJobs()
      return NextResponse.json({ jobs })
    }

    const identity = await resolveUser(req)
    if (!identity) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceClient = createSupabaseServiceClient()
    const { data: jobs, error } = await serviceClient
      .from('audit_jobs')
      .select('*, audit_reports(id, ship_score, ship_verdict)')
      .eq('user_id', identity.userId)
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

// ── Docker mode POST handler ───────────────────────────────────────────────

async function handleDockerPost(req: NextRequest) {
  const { dockerDb } = await import('@/lib/docker-db')

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { url, description, flows, depth, callback_url, target_platform, is_public, app_icon_url, auth_config } = body

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }
  if (!description || typeof description !== 'string' || description.trim().length < 10) {
    return NextResponse.json({ error: 'description must be at least 10 characters' }, { status: 400 })
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url.trim().startsWith('http') ? url.trim() : `https://${url.trim()}`)
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error()
  } catch {
    return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 })
  }

  // SSRF guard still applies in Docker mode — prevent auditing localhost/internal IPs
  // unless ALLOW_PRIVATE_IPS=true (opt-in for auditing staging on local network)
  if (process.env.ALLOW_PRIVATE_IPS !== 'true') {
    const ssrfCheck = await checkSsrf(parsedUrl.href)
    if (!ssrfCheck.allowed) {
      return NextResponse.json(
        { error: `URL not allowed: ${ssrfCheck.reason}. Set ALLOW_PRIVATE_IPS=true to audit local/staging URLs.` },
        { status: 400 }
      )
    }
  }

  let callbackUrl: string | undefined
  if (callback_url && typeof callback_url === 'string') {
    try {
      callbackUrl = new URL(callback_url).href
    } catch {
      return NextResponse.json({ error: 'callback_url must be a valid URL' }, { status: 400 })
    }
  }

  const validDepths = ['quick', 'standard', 'deep']
  const auditDepth = validDepths.includes(depth as string) ? (depth as string) : 'quick'

  const validPlatforms = ['mobile', 'desktop', 'all']
  const auditPlatform = validPlatforms.includes(target_platform as string) ? (target_platform as 'mobile' | 'desktop' | 'all') : 'all'

  // Minimal auth_config passthrough — Docker mode trusts local callers
  const validatedAuthConfig = (auth_config && typeof auth_config === 'object')
    ? auth_config as import('@/lib/supabase').AuthConfig
    : undefined

  const job = dockerDb.createJob({
    user_id: 'docker-local',
    url: parsedUrl.href,
    description: (description as string).trim(),
    flows: Array.isArray(flows) ? (flows as unknown[]).filter((f): f is string => typeof f === 'string') : [],
    depth: auditDepth as 'quick' | 'standard' | 'deep',
    target_platform: auditPlatform,
    is_public: is_public !== false,
    app_icon_url: app_icon_url && typeof app_icon_url === 'string' ? (app_icon_url as string).trim() : undefined,
    callback_url: callbackUrl,
    auth_config: validatedAuthConfig,
  })

  return NextResponse.json({ job_id: job.id, status: 'queued' }, { status: 201 })
}
