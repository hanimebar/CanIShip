/**
 * audit-pipeline task — Trigger.dev main task
 *
 * This is the Trigger.dev replacement for the BullMQ/polling worker's
 * runAuditPipeline() function. It runs the full audit and fans out per-page
 * child tasks in parallel for multi-page crawls.
 *
 * Architecture:
 *   POST /api/audit → creates Supabase job → triggers this task
 *   This task → runs Playwright/axe/Lighthouse/etc → fans out page tasks → saves report
 *
 * Trigger.dev advantages over the polling worker:
 *   - Tasks run with no function timeout limit (can go for hours)
 *   - Built-in retries with exponential backoff
 *   - Observability dashboard — see every run, its logs, duration, retries
 *   - Fan-out: parallel page auditing via batchTriggerAndWait
 *   - No Redis/BullMQ dependency needed in production
 *
 * To enable: set TRIGGER_SECRET_KEY in env. If not set, the polling worker is used.
 */

import { task, logger } from '@trigger.dev/sdk/v3'
import { createSupabaseServiceClient } from '@/lib/supabase'
import type { AuditJob, ReportTier } from '@/lib/supabase'
import { auditPageTask } from './audit-page.task'

export const auditPipelineTask = task({
  id: 'audit-pipeline',

  // Queue ensures max 5 concurrent full audits — each needs memory for Playwright
  queue: { concurrencyLimit: 5 },

  run: async (job: AuditJob) => {
    const supabase = createSupabaseServiceClient()

    // ── Clear auth_config from DB before touching credentials ────────────────
    if (job.auth_config) {
      await supabase
        .from('audit_jobs')
        .update({ auth_config: null })
        .eq('id', job.id)
    }

    logger.info('audit-pipeline started', { jobId: job.id, url: job.url, depth: job.depth })

    // ── Resolve tier ─────────────────────────────────────────────────────────
    const { data: profile } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', job.user_id)
      .single()
    const tier: ReportTier =
      profile?.plan === 'studio' ? 'studio' :
      profile?.plan === 'builder' ? 'builder' :
      'free'

    const timeoutMs = { quick: 5 * 60_000, standard: 15 * 60_000, deep: 30 * 60_000 }[job.depth] ?? 5 * 60_000
    const deadline = Date.now() + timeoutMs

    const runnerDir = require('path').join(process.cwd(), 'lib') // eslint-disable-line @typescript-eslint/no-require-imports

    // ── Load all runners ─────────────────────────────────────────────────────
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { runPlaywrightAudit }       = require(`${runnerDir}/playwright-runner`)
    const { runAxeAudit }              = require(`${runnerDir}/axe-runner`)
    const { runLighthouseAudit }       = require(`${runnerDir}/lighthouse-runner`)
    const { runSecurityChecks }        = require(`${runnerDir}/security-checker`)
    const { runSeoChecks }             = require(`${runnerDir}/seo-checker`)
    const { runMobileAudit }           = require(`${runnerDir}/mobile-runner`)
    const { runPrivacyChecks }         = require(`${runnerDir}/privacy-checker`)
    const { runActiveSecurityProbe }   = require(`${runnerDir}/active-security-probe`)
    const { runAuthHardeningChecks }   = require(`${runnerDir}/auth-hardening-checker`)
    const { analyzeWithClaude }        = require(`${runnerDir}/claude-analyzer`)
    const { generateReport }           = require(`${runnerDir}/report-generator`)
    const { executeFlows }             = require(`${runnerDir}/flow-executor`)
    /* eslint-enable @typescript-eslint/no-require-imports */

    const setStep = (step: string) =>
      supabase.from('audit_jobs').update({ current_step: step }).eq('id', job.id)

    // ── Phase 1: Playwright homepage audit ───────────────────────────────────
    logger.info('running Playwright homepage audit')
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

    // ── Phase 2: axe, Lighthouse, security — run sequentially for step tracking ─
    logger.info('running checks (axe, Lighthouse, security, SEO, mobile)')
    await setStep('axe')
    const axeResults = await runAxeAudit({ url: job.url, jobId: job.id, deadline })

    await setStep('lighthouse')
    const lighthouseResults = await runLighthouseAudit({ url: job.url, deadline })

    await setStep('security')
    const [securityResults, seoResults, mobileResults] = await Promise.all([
      runSecurityChecks({ url: job.url }),
      runSeoChecks({ url: job.url }),
      runMobileAudit({ url: job.url, deadline }),
    ])

    // ── Phase 3: Fan-out multi-page audits in PARALLEL via Trigger.dev ───────
    // This is the key advantage over the polling worker — all pages run concurrently.
    if ((job.depth === 'standard' || job.depth === 'deep') && playwrightResults.pagesVisited.length > 1) {
      const pageLimit = job.depth === 'deep' ? 12 : 5
      const baseHost = new URL(job.url).host

      const candidates = playwrightResults.pagesVisited
        .slice(1)
        .filter((u: string) => {
          try { return new URL(u).host === baseHost } catch { return false }
        })
        .filter((u: string, i: number, arr: string[]) => arr.indexOf(u) === i)
        .slice(0, pageLimit)

      if (candidates.length > 0) {
        logger.info(`fanning out ${candidates.length} page audits in parallel`)

        const batchItems = candidates.map((url: string, idx: number) => ({
          payload: {
            url,
            baseUrl: job.url,
            jobId: job.id,
            hasStrictCsp: playwrightResults.hasStrictCsp,
            pageIndex: idx + 1,
            authConfig: job.auth_config,
          },
        }))

        const batchResults = await auditPageTask.batchTriggerAndWait(batchItems)

        for (const result of batchResults.runs) {
          if (result.ok && result.output) {
            playwrightResults.pageAudits.push(result.output)
          }
        }

        logger.info(`${playwrightResults.pageAudits.length} page audits completed`)
      }
    }

    // ── Phase 3b: Privacy, active security, and auth hardening (parallel) ────
    logger.info('running privacy, active security, and auth hardening checks')
    await setStep('probing')
    const [privacyResults, activeSecurityResults, authHardeningResults] = await Promise.all([
      runPrivacyChecks({ url: job.url }),
      runActiveSecurityProbe({ url: job.url, depth: job.depth }),
      runAuthHardeningChecks({ url: job.url, depth: job.depth }),
    ])

    // ── Phase 4: Execute user flows ──────────────────────────────────────────
    const flowResults = (job.depth !== 'quick' && job.flows.length > 0)
      ? await executeFlows(job.url, job.flows, job.id, job.auth_config, deadline)
      : []

    // ── Phase 5: Claude analysis ─────────────────────────────────────────────
    logger.info('running Claude analysis')
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
      screenshots: playwrightResults.screenshots ?? [],
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
    })

    finalReport.flow_results = flowResults.length > 0 ? flowResults : undefined
    finalReport.pages_audited = playwrightResults.pageAudits.length + 1
    finalReport.privacy_score = privacyResults?.score
    finalReport.active_security_score = activeSecurityResults?.score
    finalReport.auth_hardening_score = authHardeningResults?.score

    // ── Persist screenshots ──────────────────────────────────────────────────
    const allScreenshots = playwrightResults.screenshots ?? []
    if (allScreenshots.length > 0) {
      await supabase.from('screenshots').insert(
        allScreenshots.map((s: { filename: string; storage_path: string; step_label?: string }) => ({
          job_id: job.id,
          filename: s.filename,
          storage_path: s.storage_path,
          step_label: s.step_label,
        }))
      )
    }

    // ── Save report ──────────────────────────────────────────────────────────
    await supabase.from('audit_reports').insert({
      job_id: job.id,
      user_id: job.user_id,
      report_json: finalReport,
      ship_score: finalReport.overall_score,
      ship_verdict: finalReport.ship_verdict,
    })

    await supabase
      .from('audit_jobs')
      .update({ status: 'complete', completed_at: new Date().toISOString() })
      .eq('id', job.id)

    logger.info('audit complete', {
      jobId: job.id,
      score: finalReport.overall_score,
      verdict: finalReport.ship_verdict,
      pagesAudited: finalReport.pages_audited,
      flowsRun: flowResults.length,
    })

    return {
      score: finalReport.overall_score,
      verdict: finalReport.ship_verdict,
    }
  },
})
