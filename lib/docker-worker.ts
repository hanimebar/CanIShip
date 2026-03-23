/**
 * Docker-mode audit worker
 *
 * Replaces the Supabase polling worker when DOCKER_MODE=true.
 * Polls the local SQLite/Postgres DB for queued jobs and processes them
 * using the same audit pipeline as the cloud worker.
 *
 * Also calls writeReports() and enforceMinScore() after each audit.
 */

import { dockerDb } from './docker-db'
import { checkLicenseForAudit } from './docker-license'
import { writeReports, enforceMinScore } from './report-writer'
import { createHmac } from 'crypto'
import type { ReportTier } from './supabase'

const POLL_INTERVAL_MS = 3000

let workerRunning = false

export async function startDockerWorker() {
  if (workerRunning) return
  workerRunning = true
  console.log('[CanIShip Docker Worker] Started — polling every 3s')

  while (workerRunning) {
    try {
      await processNextDockerJob()
    } catch (err) {
      console.error('[Docker Worker] Unexpected error:', err)
    }
    await sleep(POLL_INTERVAL_MS)
  }
}

export function stopDockerWorker() {
  workerRunning = false
}

async function processNextDockerJob() {
  const jobs = dockerDb.listJobs()
  const queued = jobs.find(j => j.status === 'queued')
  if (!queued) return

  const workerId = `docker-worker-${process.pid}`
  dockerDb.updateJob(queued.id, {
    status: 'running',
    worker_id: workerId,
    started_at: new Date().toISOString(),
  })

  console.log(`[Docker Worker] Processing job ${queued.id} — ${queued.url}`)

  try {
    // Re-validate license before running (throttled to once/hour inside)
    await checkLicenseForAudit()
    await runDockerAuditPipeline(queued.id)
  } catch (err) {
    console.error(`[Docker Worker] Job ${queued.id} failed:`, err)
    dockerDb.updateJob(queued.id, {
      status: 'failed',
      error_message: err instanceof Error ? err.message : String(err),
      completed_at: new Date().toISOString(),
    })
    await fireDockerWebhook(queued.id, {
      status: 'failed',
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

async function runDockerAuditPipeline(jobId: string) {
  const job = dockerDb.getJob(jobId)
  if (!job) throw new Error(`Job ${jobId} not found`)

  // In Docker mode, all users are Studio tier (they paid for the subscription)
  const tier: ReportTier = 'studio'

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

  const timeoutMs = { quick: 5 * 60 * 1000, standard: 15 * 60 * 1000, deep: 30 * 60 * 1000 }[job.depth] || 5 * 60 * 1000
  const deadline = Date.now() + timeoutMs

  const playwrightResults = await runPlaywrightAudit({
    url: job.url, description: job.description, flows: job.flows,
    depth: job.depth, jobId: job.id, deadline,
  })

  const [axeResults, lighthouseResults, securityResults] = await Promise.all([
    runAxeAudit({ url: job.url, jobId: job.id, deadline }),
    runLighthouseAudit({ url: job.url, deadline }),
    runSecurityChecks({ url: job.url }),
  ])

  const [seoResults, mobileResults] = await Promise.all([
    runSeoChecks({ url: job.url }),
    runMobileAudit({ url: job.url, deadline }),
  ])

  const claudeReport = await analyzeWithClaude({
    url: job.url, description: job.description, flows: job.flows,
    target_platform: job.target_platform ?? 'all',
    playwrightResults, axeResults, lighthouseResults, securityResults,
    seoResults, mobileResults, screenshots: playwrightResults.screenshots || [],
    tier,
  })

  const finalReport = generateReport(claudeReport, {
    playwrightResults, axeResults, lighthouseResults, securityResults,
  })

  dockerDb.createReport({
    job_id: job.id,
    user_id: 'docker-local',
    report_json: finalReport,
    ship_score: finalReport.overall_score,
    ship_verdict: finalReport.ship_verdict,
  })

  const completedAt = new Date().toISOString()

  dockerDb.updateJob(job.id, { status: 'complete', completed_at: completedAt })

  console.log(`[Docker Worker] Job ${job.id} complete. Score: ${finalReport.overall_score} — ${finalReport.ship_verdict.toUpperCase()}`)

  // Write report files to OUTPUT_DIR if configured
  writeReports({
    job_id: job.id,
    url: job.url,
    depth: job.depth,
    ship_score: finalReport.overall_score,
    ship_verdict: finalReport.ship_verdict,
    report: finalReport,
    lighthouse: lighthouseResults,
    audited_at: completedAt,
  })

  // Exit 1 if score below MIN_SCORE (CI use)
  enforceMinScore(finalReport.overall_score)

  // Fire webhook if provided
  await fireDockerWebhook(job.id, {
    status: 'complete',
    ship_score: finalReport.overall_score,
    ship_verdict: finalReport.ship_verdict,
    completed_at: completedAt,
  })
}

async function fireDockerWebhook(jobId: string, data: Record<string, unknown>) {
  const job = dockerDb.getJob(jobId)
  if (!job?.callback_url) return

  const payload = JSON.stringify({
    event: data.status === 'complete' ? 'audit.complete' : 'audit.failed',
    job_id: jobId,
    url: job.url,
    ...data,
  })

  const secret = process.env.WEBHOOK_SECRET || ''
  const signature = `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`

  try {
    await fetch(job.callback_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CanIShip-Signature': signature,
        'User-Agent': 'CanIShip-Docker-Webhook/1.0',
      },
      body: payload,
      signal: AbortSignal.timeout(10000),
    })
  } catch (err) {
    console.warn(`[Docker Worker] Webhook failed for job ${jobId}:`, err)
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
