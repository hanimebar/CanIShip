/**
 * Job Queue — Dual mode:
 * - If REDIS_URL is set: uses BullMQ for robust queue management
 * - Otherwise: Supabase polling pattern (no Redis dependency)
 *
 * ARCHITECTURE NOTE:
 * The runner modules (playwright, axe, lighthouse, security) are loaded
 * at runtime using a dynamic path to prevent webpack from tracing them.
 * These modules use native binaries and ESM-only packages that cannot
 * be bundled by webpack.
 */

import { createHmac } from 'crypto'
import { createSupabaseServiceClient, type AuditJob, type ReportTier } from './supabase'

const REDIS_URL = process.env.REDIS_URL
const WORKER_POLL_INTERVAL_MS = 5000

// ============================================================
// SUPABASE POLLING WORKER
// ============================================================

let workerRunning = false

export async function startPollingWorker() {
  if (workerRunning) return
  workerRunning = true

  console.log('[CanIShip Worker] Starting Supabase polling worker...')

  while (workerRunning) {
    await processNextJob()
    await sleep(WORKER_POLL_INTERVAL_MS)
  }
}

export function stopWorker() {
  workerRunning = false
}

async function processNextJob() {
  const supabase = createSupabaseServiceClient()
  const workerId = `worker-${process.pid}-${Date.now()}`

  // Atomic claim via Postgres function — uses FOR UPDATE SKIP LOCKED to prevent
  // multiple workers from picking the same job.
  //
  // SQL to deploy in Supabase (run once):
  //
  //   CREATE OR REPLACE FUNCTION claim_next_audit_job(p_worker_id TEXT)
  //   RETURNS SETOF audit_jobs LANGUAGE sql AS $$
  //     UPDATE audit_jobs
  //     SET status = 'running',
  //         worker_id = p_worker_id,
  //         started_at = NOW()
  //     WHERE id = (
  //       SELECT id FROM audit_jobs
  //       WHERE status = 'queued'
  //       ORDER BY created_at ASC
  //       LIMIT 1
  //       FOR UPDATE SKIP LOCKED
  //     )
  //     RETURNING *;
  //   $$;
  //
  const { data: jobs, error } = await supabase
    .rpc('claim_next_audit_job', { p_worker_id: workerId })

  // RPC returns 0 rows (no job) or 1 row (claimed job)
  if (error || !jobs || jobs.length === 0) return

  const job = jobs[0] as AuditJob
  console.log(`[Worker] Processing job ${job.id} for URL: ${job.url}`)

  try {
    await runAuditPipeline(job)
  } catch (err) {
    console.error(`[Worker] Job ${job.id} failed:`, err)
    await supabase
      .from('audit_jobs')
      .update({
        status: 'failed',
        error_message: err instanceof Error ? err.message : String(err),
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id)
    // Fire webhook on failure too — caller may want to know
    await fireWebhook(job, { status: 'failed', error: err instanceof Error ? err.message : String(err) })
  }
}

async function getUserTier(userId: string): Promise<ReportTier> {
  const supabase = createSupabaseServiceClient()
  const { data } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .single()
  const plan = data?.plan as string | undefined
  if (plan === 'studio') return 'studio'
  if (plan === 'builder') return 'builder'
  return 'free'
}

async function runAuditPipeline(job: AuditJob) {
  const supabase = createSupabaseServiceClient()
  const tier = await getUserTier(job.user_id)

  // Load runner modules at runtime using dynamic paths
  // webpackIgnore comment prevents webpack from tracing these requires
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const runnerDir = require('path').join(process.cwd(), 'lib')

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { runPlaywrightAudit } = require(/* webpackIgnore: true */ `${runnerDir}/playwright-runner`)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { runAxeAudit } = require(/* webpackIgnore: true */ `${runnerDir}/axe-runner`)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { runLighthouseAudit } = require(/* webpackIgnore: true */ `${runnerDir}/lighthouse-runner`)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { runSecurityChecks } = require(/* webpackIgnore: true */ `${runnerDir}/security-checker`)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { runSeoChecks } = require(/* webpackIgnore: true */ `${runnerDir}/seo-checker`)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { runMobileAudit } = require(/* webpackIgnore: true */ `${runnerDir}/mobile-runner`)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { analyzeWithClaude } = require(/* webpackIgnore: true */ `${runnerDir}/claude-analyzer`)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { generateReport } = require(/* webpackIgnore: true */ `${runnerDir}/report-generator`)

  const timeoutMs = {
    quick: 5 * 60 * 1000,
    standard: 15 * 60 * 1000,
    deep: 30 * 60 * 1000,
  }[job.depth] || 5 * 60 * 1000

  const deadline = Date.now() + timeoutMs
  let screenshots: Array<{ filename: string; storage_path: string; step_label: string }> = []

  // ── Clear auth_config from DB before it is ever used ─────────────────────
  // Credentials are needed only in-memory during this run. Remove from DB
  // now so they are never accessible after this point.
  if (job.auth_config) {
    await supabase
      .from('audit_jobs')
      .update({ auth_config: null })
      .eq('id', job.id)
  }

  const setStep = (step: string) =>
    supabase.from('audit_jobs').update({ current_step: step }).eq('id', job.id)

  await setStep('playwright')
  const playwrightResults = await runPlaywrightAudit({
    url: job.url,
    description: job.description,
    flows: job.flows,
    depth: job.depth,
    jobId: job.id,
    deadline,
    authConfig: job.auth_config,
  })

  screenshots = screenshots.concat(playwrightResults.screenshots || [])

  await setStep('axe')
  const axeResults = await runAxeAudit({
    url: job.url,
    jobId: job.id,
    deadline,
  })

  await setStep('lighthouse')
  const lighthouseResults = await runLighthouseAudit({ url: job.url, deadline })

  await setStep('security')
  const securityResults = await runSecurityChecks({ url: job.url })

  // SEO and mobile run in parallel — both are fast and independent
  const [seoResults, mobileResults] = await Promise.all([
    runSeoChecks({ url: job.url }),
    runMobileAudit({ url: job.url, deadline }),
  ])

  // ── Privacy, active security probing, and auth hardening ─────────────────
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { runPrivacyChecks }          = require(/* webpackIgnore: true */ `${runnerDir}/privacy-checker`)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { runActiveSecurityProbe }    = require(/* webpackIgnore: true */ `${runnerDir}/active-security-probe`)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { runAuthHardeningChecks }    = require(/* webpackIgnore: true */ `${runnerDir}/auth-hardening-checker`)

  await setStep('probing')
  const [privacyResults, activeSecurityResults, authHardeningResults] = await Promise.all([
    runPrivacyChecks({ url: job.url }),
    runActiveSecurityProbe({ url: job.url, depth: job.depth }),
    runAuthHardeningChecks({ url: job.url, depth: job.depth }),
  ])

  // ── Execute user-defined flows (standard/deep only) ───────────────────────
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { executeFlows } = require(/* webpackIgnore: true */ `${runnerDir}/flow-executor`)
  const flowResults = (job.depth !== 'quick' && job.flows.length > 0)
    ? await executeFlows(job.url, job.flows, job.id, job.auth_config, deadline)
    : []

  // Collect flow screenshots into the screenshots list
  for (const fr of flowResults) {
    for (const step of fr.steps) {
      for (const storagePath of [step.screenshot_before, step.screenshot_after]) {
        if (storagePath) {
          const filename = storagePath.split('/').pop() ?? storagePath
          screenshots.push({ filename, storage_path: storagePath, step_label: step.description })
        }
      }
    }
  }

  if (screenshots.length > 0) {
    await supabase.from('screenshots').insert(
      screenshots.map((s) => ({
        job_id: job.id,
        filename: s.filename,
        storage_path: s.storage_path,
        step_label: s.step_label,
      }))
    )
  }

  await setStep('claude')
  const claudeReport = await analyzeWithClaude({
    url: job.url,
    description: job.description,
    flows: job.flows,
    target_platform: job.target_platform ?? 'all',
    playwrightResults,
    axeResults,
    lighthouseResults,
    securityResults,
    seoResults,
    mobileResults,
    screenshots,
    tier,
    flowResults,
    privacyResults,
    activeSecurityResults,
    authHardeningResults,
  })

  const finalReport = generateReport(claudeReport, {
    playwrightResults,
    axeResults,
    lighthouseResults,
    securityResults,
    privacyResults,
    activeSecurityResults,
    authHardeningResults,
    flowResults,
    targetPlatform: job.target_platform ?? 'all',
  })

  // Attach flow results and page count to the stored report
  finalReport.flow_results = flowResults.length > 0 ? flowResults : undefined
  finalReport.pages_audited = playwrightResults.pageAudits.length + 1 // +1 for homepage
  finalReport.privacy_score = privacyResults?.score
  finalReport.active_security_score = activeSecurityResults?.score
  finalReport.auth_hardening_score = authHardeningResults?.score

  await supabase.from('audit_reports').insert({
    job_id: job.id,
    user_id: job.user_id,
    report_json: finalReport,
    ship_score: finalReport.overall_score,
    ship_verdict: finalReport.ship_verdict,
  })

  const completedAt = new Date().toISOString()

  await supabase
    .from('audit_jobs')
    .update({
      status: 'complete',
      completed_at: completedAt,
    })
    .eq('id', job.id)

  console.log(`[Worker] Job ${job.id} complete. Score: ${finalReport.overall_score}`)

  // Fire webhook if caller provided a callback_url
  await fireWebhook(job, {
    status: 'complete',
    ship_score: finalReport.overall_score,
    ship_verdict: finalReport.ship_verdict,
    completed_at: completedAt,
  })
}

// ============================================================
// BULLMQ WORKER (when REDIS_URL is set)
// ============================================================

export async function initBullMQWorker() {
  if (!REDIS_URL) {
    console.log('[CanIShip] No REDIS_URL — using Supabase polling worker')
    return startPollingWorker()
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Worker } = require(/* webpackIgnore: true */ 'bullmq')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const IORedis = require(/* webpackIgnore: true */ 'ioredis')

  const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null })

  const worker = new Worker(
    'audit-jobs',
    async (job: { data: AuditJob }) => {
      await runAuditPipeline(job.data)
    },
    { connection, concurrency: 2 }
  )

  worker.on('failed', async (job: { data: AuditJob } | undefined, err: Error) => {
    if (!job) return
    const supabase = createSupabaseServiceClient()
    await supabase
      .from('audit_jobs')
      .update({
        status: 'failed',
        error_message: err.message,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.data.id)
  })

  console.log('[CanIShip] BullMQ worker started')
  return worker
}

export async function enqueueAuditJob(job: AuditJob) {
  if (!REDIS_URL) return

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Queue } = require(/* webpackIgnore: true */ 'bullmq')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const IORedis = require(/* webpackIgnore: true */ 'ioredis')

  const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null })
  const queue = new Queue('audit-jobs', { connection })

  await queue.add('run-audit', job, {
    jobId: job.id,
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
  })
}

// ============================================================
// WEBHOOK DELIVERY
// ============================================================

/**
 * Fire a webhook to the job's callback_url (if set).
 * Signed with HMAC-SHA256 using WEBHOOK_SECRET env var.
 * Non-fatal — a delivery failure never affects the audit result.
 *
 * Payload shape:
 *   { event, job_id, url, status, ship_score?, ship_verdict?, completed_at?, error? }
 *
 * Signature header: X-CanIShip-Signature: sha256=<hex>
 * Consumers verify: HMAC-SHA256(secret, rawBody) === signature
 */
async function fireWebhook(
  job: AuditJob,
  data: Record<string, unknown>,
): Promise<void> {
  const callbackUrl = (job as AuditJob & { callback_url?: string }).callback_url
  if (!callbackUrl) return

  const payload = JSON.stringify({
    event: data.status === 'complete' ? 'audit.complete' : 'audit.failed',
    job_id: job.id,
    url: job.url,
    ...data,
  })

  const secret = process.env.WEBHOOK_SECRET || ''
  const signature = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`

  try {
    await fetch(callbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CanIShip-Signature': signature,
        'User-Agent': 'CanIShip-Webhook/1.0',
      },
      body: payload,
      signal: AbortSignal.timeout(10000),
    })
  } catch (err) {
    console.warn(`[Worker] Webhook delivery failed for job ${job.id}:`, err)
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
