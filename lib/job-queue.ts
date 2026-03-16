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

import { createSupabaseServiceClient, type AuditJob } from './supabase'

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

  const { data: job, error } = await supabase
    .from('audit_jobs')
    .select('*')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (error || !job) return

  const workerId = `worker-${process.pid}-${Date.now()}`

  const { error: updateError } = await supabase
    .from('audit_jobs')
    .update({
      status: 'running',
      worker_id: workerId,
      started_at: new Date().toISOString(),
    })
    .eq('id', job.id)
    .eq('status', 'queued')

  if (updateError) return

  console.log(`[Worker] Processing job ${job.id} for URL: ${job.url}`)

  try {
    await runAuditPipeline(job as AuditJob)
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
  }
}

async function runAuditPipeline(job: AuditJob) {
  const supabase = createSupabaseServiceClient()

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

  const playwrightResults = await runPlaywrightAudit({
    url: job.url,
    description: job.description,
    flows: job.flows,
    depth: job.depth,
    jobId: job.id,
    deadline,
  })

  screenshots = screenshots.concat(playwrightResults.screenshots || [])

  const axeResults = await runAxeAudit({
    url: job.url,
    jobId: job.id,
    deadline,
  })

  const lighthouseResults = await runLighthouseAudit({ url: job.url, deadline })

  const securityResults = await runSecurityChecks({ url: job.url })

  // SEO and mobile run in parallel — both are fast and independent
  const [seoResults, mobileResults] = await Promise.all([
    runSeoChecks({ url: job.url }),
    runMobileAudit({ url: job.url, deadline }),
  ])

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

  const claudeReport = await analyzeWithClaude({
    url: job.url,
    description: job.description,
    flows: job.flows,
    playwrightResults,
    axeResults,
    lighthouseResults,
    securityResults,
    seoResults,
    mobileResults,
    screenshots,
  })

  const finalReport = generateReport(claudeReport, {
    playwrightResults,
    axeResults,
    lighthouseResults,
    securityResults,
  })

  await supabase.from('audit_reports').insert({
    job_id: job.id,
    user_id: job.user_id,
    report_json: finalReport,
    ship_score: finalReport.overall_score,
    ship_verdict: finalReport.ship_verdict,
  })

  await supabase
    .from('audit_jobs')
    .update({
      status: 'complete',
      completed_at: new Date().toISOString(),
    })
    .eq('id', job.id)

  console.log(`[Worker] Job ${job.id} complete. Score: ${finalReport.overall_score}`)
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
