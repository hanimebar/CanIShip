/**
 * Report writer — Docker mode
 *
 * After each audit completes, writes output files to OUTPUT_DIR if set.
 * Supports JSON, HTML, or both (controlled by REPORT_FORMAT env var).
 *
 * Files are named: <sanitized-url>_<timestamp>.<ext>
 */

import * as fs from 'fs'
import * as path from 'path'
import type { ClaudeReport } from './supabase'
import type { LighthouseResults } from './lighthouse-runner'

export type ReportPayload = {
  job_id: string
  url: string
  depth: string
  ship_score: number
  ship_verdict: 'yes' | 'no' | 'conditional'
  report: ClaudeReport
  lighthouse?: LighthouseResults
  audited_at: string
}

function sanitizeFilename(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80)
}

function verdictEmoji(verdict: string): string {
  if (verdict === 'yes') return '✅'
  if (verdict === 'no') return '❌'
  return '⚠️'
}

function buildHtmlReport(payload: ReportPayload): string {
  const { url, ship_score, ship_verdict, report, audited_at } = payload
  const r = report

  const issueRows = (issues: Array<{ title: string; description: string; severity?: string }>, color: string) =>
    issues.map(i => `
      <div style="border-left:3px solid ${color};padding:10px 16px;margin:8px 0;background:#f9f9f9">
        <strong>${i.title}</strong>
        ${i.severity ? `<span style="font-size:11px;color:#666;margin-left:8px">[${i.severity}]</span>` : ''}
        <p style="margin:4px 0 0;color:#444;font-size:13px">${i.description}</p>
      </div>`).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>CanIShip Audit — ${url}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 40px auto; padding: 0 20px; color: #222; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    .meta { color: #666; font-size: 13px; margin-bottom: 32px; }
    .score-badge { display: inline-block; padding: 8px 20px; border-radius: 6px; font-size: 28px; font-weight: 700; color: #fff; background: ${ship_score >= 80 ? '#2d6a2d' : ship_score >= 60 ? '#b87300' : '#cc2200'}; }
    h2 { font-size: 16px; margin: 32px 0 8px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
    .passed { color: #2d6a2d; }
    pre { background: #f4f4f4; padding: 16px; border-radius: 4px; overflow-x: auto; font-size: 12px; }
  </style>
</head>
<body>
  <h1>CanIShip Audit Report</h1>
  <div class="meta">
    URL: <strong>${url}</strong> &nbsp;|&nbsp;
    Audited: ${new Date(audited_at).toLocaleString()} &nbsp;|&nbsp;
    Depth: ${payload.depth}
  </div>

  <div>
    <span class="score-badge">${ship_score}</span>
    &nbsp;&nbsp;
    <span style="font-size:20px">${verdictEmoji(ship_verdict)} ${ship_verdict === 'yes' ? 'SHIP IT' : ship_verdict === 'no' ? 'DO NOT SHIP' : 'SHIP WITH CAUTION'}</span>
  </div>

  <h2>Summary</h2>
  <p>${r.plain_english_summary}</p>

  ${r.critical_bugs?.length ? `<h2 style="color:#cc2200">Critical Bugs (${r.critical_bugs.length})</h2>${issueRows(r.critical_bugs, '#cc2200')}` : ''}
  ${r.ux_issues?.length ? `<h2 style="color:#c46000">UX Issues (${r.ux_issues.length})</h2>${issueRows(r.ux_issues, '#c46000')}` : ''}
  ${r.security_flags?.length ? `<h2 style="color:#8a1a1a">Security Flags (${r.security_flags.length})</h2>${issueRows(r.security_flags, '#8a1a1a')}` : ''}
  ${r.accessibility_violations?.length ? `<h2 style="color:#6b3fa0">Accessibility Violations (${r.accessibility_violations.length})</h2>${issueRows(r.accessibility_violations, '#6b3fa0')}` : ''}
  ${r.performance_issues?.length ? `<h2 style="color:#1a5c8a">Performance Issues (${r.performance_issues.length})</h2>${issueRows(r.performance_issues, '#1a5c8a')}` : ''}
  ${r.warnings?.length ? `<h2 style="color:#b87300">Warnings (${r.warnings.length})</h2>${issueRows(r.warnings, '#b87300')}` : ''}

  ${r.top_5_fixes?.length ? `
  <h2>Top Fixes</h2>
  ${r.top_5_fixes.map((f, i) => `
    <div style="padding:10px 16px;margin:8px 0;background:#f9f9f9;border-radius:4px">
      <strong>#${i+1}: ${f.title}</strong>
      ${f.estimated_effort ? `<span style="font-size:11px;color:#666;margin-left:8px">effort: ${f.estimated_effort}</span>` : ''}
      <p style="margin:4px 0 0;color:#444;font-size:13px">${f.description}</p>
    </div>`).join('')}
  ` : ''}

  ${r.passed_checks?.length ? `
  <h2 class="passed">Passed Checks (${r.passed_checks.length})</h2>
  ${r.passed_checks.map(p => `<div style="padding:6px 0;font-size:13px;color:#2d6a2d">✓ <strong>${p.title}</strong> — ${p.description}</div>`).join('')}
  ` : ''}

  <h2>Raw JSON</h2>
  <pre>${JSON.stringify(payload, null, 2)}</pre>
</body>
</html>`
}

export function writeReports(payload: ReportPayload): void {
  const outputDir = process.env.OUTPUT_DIR
  if (!outputDir) return

  try {
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })
  } catch (err) {
    console.error('[CanIShip] Could not create OUTPUT_DIR:', err)
    return
  }

  const fmt = (process.env.REPORT_FORMAT || 'both').toLowerCase()
  const slug = sanitizeFilename(payload.url)
  const ts = new Date(payload.audited_at).toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const base = path.join(outputDir, `${slug}_${ts}`)

  if (fmt === 'json' || fmt === 'both') {
    try {
      fs.writeFileSync(`${base}.json`, JSON.stringify(payload, null, 2), 'utf-8')
      console.log(`[CanIShip] Report written: ${base}.json`)
    } catch (err) {
      console.error('[CanIShip] Failed to write JSON report:', err)
    }
  }

  if (fmt === 'html' || fmt === 'both') {
    try {
      fs.writeFileSync(`${base}.html`, buildHtmlReport(payload), 'utf-8')
      console.log(`[CanIShip] Report written: ${base}.html`)
    } catch (err) {
      console.error('[CanIShip] Failed to write HTML report:', err)
    }
  }

  // Write a fixed-name "latest" symlink / copy for CI to reference predictably
  try {
    const latestJson = path.join(outputDir, 'latest.json')
    fs.writeFileSync(latestJson, JSON.stringify(payload, null, 2), 'utf-8')
  } catch { /* non-fatal */ }
}

/** Checks MIN_SCORE and exits with code 1 if score is below threshold. */
export function enforceMinScore(score: number): void {
  const minScore = parseInt(process.env.MIN_SCORE || '0', 10)
  if (minScore > 0 && score < minScore) {
    console.error(
      `[CanIShip] FAIL — Score ${score} is below MIN_SCORE threshold of ${minScore}.\n` +
      `Set MIN_SCORE=0 to disable this check.`
    )
    process.exit(1)
  }
}
