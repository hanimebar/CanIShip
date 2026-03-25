/**
 * Report generator — merges Claude's analysis with raw tool data
 * into a final unified ClaudeReport
 */

import type { ClaudeReport } from './supabase'
import type { PlaywrightResults } from './playwright-runner'
import type { AxeResults } from './axe-runner'
import type { LighthouseResults } from './lighthouse-runner'
import type { SecurityResults } from './security-checker'

export type RawResults = {
  playwrightResults: PlaywrightResults
  axeResults: AxeResults
  lighthouseResults: LighthouseResults
  securityResults: SecurityResults
}

/**
 * Takes the Claude-generated report and enriches it with raw tool data.
 * Claude handles synthesis and scoring; this function adds data integrity.
 */
export function generateReport(claudeReport: ClaudeReport, raw: RawResults): ClaudeReport {
  const report = { ...claudeReport }

  // ---- Ensure all broken links are captured ----
  const existingWarningTitles = new Set(report.warnings.map((w) => w.title))
  for (const link of raw.playwrightResults.brokenLinks) {
    const title = `Broken link: ${link.href}`
    if (!existingWarningTitles.has(title)) {
      report.warnings.push({
        title,
        description: `This link returns HTTP ${link.status}. Found on: ${link.sourceUrl}`,
        severity: link.status === 404 ? 'medium' as const : 'low' as const,
      })
    }
  }

  // ---- Ensure all console errors are surfaced ----
  const jsErrors = raw.playwrightResults.consoleErrors.filter((e) => e.type === 'error')
  if (jsErrors.length > 0) {
    const alreadyCovered = report.critical_bugs.some((b) => b.title.toLowerCase().includes('console'))
      || report.warnings.some((w) => w.title.toLowerCase().includes('console error'))

    if (!alreadyCovered) {
      report.warnings.push({
        title: `${jsErrors.length} JavaScript console error(s) detected`,
        description: jsErrors
          .slice(0, 3)
          .map((e) => e.text.slice(0, 200))
          .join(' | '),
        severity: 'medium' as const,
      })
    }
  }

  // ---- Add Lighthouse performance score to report metadata ----
  const perfScore = raw.lighthouseResults.categories.performance?.score
  if (perfScore !== undefined && perfScore !== null && perfScore < 50) {
    const alreadyCovered = report.performance_issues.some((p) =>
      p.title.toLowerCase().includes('performance score')
    )
    if (!alreadyCovered) {
      report.performance_issues.push({
        title: 'Low overall Lighthouse performance score',
        description: `Performance score: ${Math.round(perfScore)}/100. Users on slow connections will experience significant delays.`,
        metric: 'Lighthouse Performance',
        value: `${Math.round(perfScore)}/100`,
        target: '90+',
        severity: perfScore < 25 ? 'high' as const : 'medium' as const,
        remediation: 'Review the Lighthouse opportunities in the performance section and address the highest-impact items first.',
      })
    }
  }

  // ---- Deduplicate all arrays ----
  report.critical_bugs = deduplicateByTitle(report.critical_bugs)
  report.ux_issues = deduplicateByTitle(report.ux_issues)
  report.accessibility_violations = deduplicateByTitle(report.accessibility_violations)
  report.performance_issues = deduplicateByTitle(report.performance_issues)
  report.security_flags = deduplicateByTitle(report.security_flags)
  report.warnings = deduplicateByTitle(report.warnings)
  report.passed_checks = deduplicateByTitle(report.passed_checks)

  // ---- Clamp score ----
  report.overall_score = Math.round(Math.min(100, Math.max(0, report.overall_score)) * 100) / 100

  // ---- Ensure ship_verdict aligns with score ----
  if (report.critical_bugs.length > 0 && report.ship_verdict === 'yes') {
    report.ship_verdict = 'conditional'
  }
  if (report.overall_score < 40 && report.ship_verdict !== 'no') {
    report.ship_verdict = 'no'
  }
  if (report.overall_score >= 85 && report.critical_bugs.length === 0 && report.ship_verdict === 'no') {
    report.ship_verdict = 'conditional'
  }

  return report
}

export function getScoreLabel(score: number): string {
  if (score >= 90) return 'Ship it'
  if (score >= 70) return 'Almost there'
  if (score >= 50) return 'Needs work'
  return 'Do not ship'
}

export function getScoreDescription(score: number): string {
  if (score >= 90) return "You're good to go. Your app meets the quality bar for launch."
  if (score >= 70) return 'Fix the top issues first. You\'re close but there are gaps to address.'
  if (score >= 50) return 'Significant work needed before this app is ready for real users.'
  return 'Critical issues found. Do not ship this in its current state.'
}

export function getVerdictColor(verdict: 'yes' | 'no' | 'conditional'): string {
  return {
    yes: '#00FF88',
    conditional: '#FFD60A',
    no: '#FF3B30',
  }[verdict]
}

function deduplicateByTitle<T extends { title: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = item.title.toLowerCase().trim()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
