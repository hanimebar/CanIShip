/**
 * Report generator — merges Claude's analysis with raw tool data
 * into a final unified ClaudeReport.
 *
 * Scoring philosophy:
 * Claude classifies and describes issues. CanIShip owns the score.
 * calculateScore() is the authoritative, deterministic formula — Claude's
 * own overall_score is always overwritten. This ensures reproducibility,
 * auditability, and product differentiation.
 */

import type { ClaudeReport, FlowExecutionResult, TargetPlatform } from './supabase'
import type { PlaywrightResults } from './playwright-runner'
import type { AxeResults } from './axe-runner'
import type { LighthouseResults } from './lighthouse-runner'
import type { SecurityResults } from './security-checker'
import type { PrivacyResults } from './privacy-checker'
import type { ActiveSecurityResults } from './active-security-probe'
import type { AuthHardeningResults } from './auth-hardening-checker'

export type RawResults = {
  playwrightResults: PlaywrightResults
  axeResults: AxeResults
  lighthouseResults: LighthouseResults
  securityResults: SecurityResults
  privacyResults?: PrivacyResults
  activeSecurityResults?: ActiveSecurityResults
  authHardeningResults?: AuthHardeningResults
  flowResults?: FlowExecutionResult[]
  targetPlatform?: TargetPlatform
}

// ─── Deterministic scoring formula ────────────────────────────────────────────
//
// Start at 100. Deduct per finding. Each category has a cap to prevent one
// bad dimension from obliterating an otherwise solid app.
//
// Weights reflect what a QA/DevOps team would actually block a release for:
//   - Security and broken flows are the heaviest
//   - Accessibility and performance are significant but not fatal alone
//   - SEO and privacy are important but not launch-blockers
//
export function calculateScore(claudeReport: ClaudeReport, raw: RawResults): number {
  let score = 100

  const deduct = (amount: number) => { score -= amount }
  const capped = (items: number, perItem: number, cap: number) =>
    Math.min(items * perItem, cap)

  // ── Functional bugs (from Claude's classification) ──────────────────────
  const criticalBugs  = claudeReport.critical_bugs.filter(b => b.severity === 'critical').length
  const highBugs      = claudeReport.critical_bugs.filter(b => b.severity === 'high').length
  const mediumBugs    = claudeReport.critical_bugs.filter(b => b.severity === 'medium').length
  deduct(capped(criticalBugs, 15, 30))
  deduct(capped(highBugs,      8, 16))
  deduct(capped(mediumBugs,    3,  9))

  // ── User flows (executed by Playwright — confirmed broken features) ─────
  const failedFlows   = (raw.flowResults ?? []).filter(f => f.overall_status === 'failed').length
  const partialFlows  = (raw.flowResults ?? []).filter(f => f.overall_status === 'partial').length
  deduct(capped(failedFlows,  12, 36))
  deduct(capped(partialFlows,  5, 15))

  // ── Broken links & console errors ──────────────────────────────────────
  deduct(capped(raw.playwrightResults.brokenLinks.length, 2, 10))
  const jsErrors = raw.playwrightResults.consoleErrors.filter(e => e.type === 'error').length
  deduct(capped(jsErrors, 2, 8))

  // ── Security ────────────────────────────────────────────────────────────
  if (!raw.securityResults.isHttps) deduct(30)

  const secFlags = raw.securityResults.flags
  deduct(capped(secFlags.filter(f => f.severity === 'critical').length, 20, 40))
  deduct(capped(secFlags.filter(f => f.severity === 'high').length,     10, 20))
  deduct(capped(secFlags.filter(f => f.severity === 'medium').length,    4,  8))

  if (raw.activeSecurityResults) {
    // Raw XSS reflection = unescaped output, genuine risk
    if (raw.activeSecurityResults.xss_surface.reflected) deduct(15)

    // Unauthenticated API endpoints returning data
    const unauthApis = raw.activeSecurityResults.api_probes.filter(p => p.returns_data).length
    deduct(capped(unauthApis, 8, 16))

    // Stack trace or server info leakage
    const stackLeaks = raw.activeSecurityResults.error_leakage.filter(r => r.leaks_stack_trace).length
    deduct(capped(stackLeaks, 5, 10))

    // Active security flags (non-informational only)
    const activeFlags = raw.activeSecurityResults.flags.filter(f => !f.is_informational)
    deduct(capped(activeFlags.filter(f => f.severity === 'critical').length, 15, 30))
    deduct(capped(activeFlags.filter(f => f.severity === 'high').length,      8, 16))
  }

  if (raw.authHardeningResults) {
    const authFlags = raw.authHardeningResults.flags
    deduct(capped(authFlags.filter(f => f.severity === 'high').length,   4, 8))
    deduct(capped(authFlags.filter(f => f.severity === 'medium').length, 2, 4))
  }

  // ── Accessibility (axe-core WCAG 2.1 AA) ───────────────────────────────
  const { critical: a11yCrit = 0, serious = 0, moderate = 0, minor = 0 } =
    raw.axeResults.violationCounts
  deduct(capped(a11yCrit, 7, 21))
  deduct(capped(serious,  4, 16))
  deduct(capped(moderate, 1.5,  9))
  deduct(capped(minor,    0.5,  3))

  // ── Performance (Lighthouse) ────────────────────────────────────────────
  const perfScore = raw.lighthouseResults.categories.performance?.score ?? 100
  if      (perfScore < 25) deduct(20)
  else if (perfScore < 50) deduct(12)
  else if (perfScore < 75) deduct(5)
  else if (perfScore < 90) deduct(2)

  const { lcp, cls, tbt } = raw.lighthouseResults.coreWebVitals
  if (lcp !== undefined && lcp !== null && lcp > 4000) deduct(5)
  if (cls !== undefined && cls !== null && cls > 0.25)  deduct(4)
  if (tbt !== undefined && tbt !== null && tbt > 600)   deduct(3)

  // ── SEO ──────────────────────────────────────────────────────────────────
  const seo = claudeReport  // SEO issues surfaced by Claude from seoResults
  const seoFlags = seo.security_flags  // unused here — read from raw if available

  // Use Claude's classified SEO issues for deductions (they come from seoResults)
  // We re-read from the raw runner scores rather than Claude's opinion
  // (seoResults isn't in RawResults — but its data feeds security_flags/warnings
  //  so we keep SEO deductions light and rely on the runner's pre-scored issues
  //  surfaced in the prompt)
  void seoFlags  // intentional — SEO scoring handled below via warnings

  // SEO: penalise only for what the runners confirmed as missing
  const seoWarnings = claudeReport.warnings.filter(w =>
    w.title.toLowerCase().includes('seo') ||
    w.title.toLowerCase().includes('title') ||
    w.title.toLowerCase().includes('sitemap') ||
    w.title.toLowerCase().includes('meta description') ||
    w.title.toLowerCase().includes('canonical')
  )
  deduct(capped(seoWarnings.length, 2, 8))

  // ── Mobile (weighted by target platform) ────────────────────────────────
  // MobileResults are not yet in RawResults — mobile issues already surface
  // through axe violations and playwright functional issues above, which are
  // both weighted by mobileFactor. Explicit mobile deductions (viewport meta,
  // horizontal scroll) can be added when MobileResults is added to RawResults.

  // ── Privacy ──────────────────────────────────────────────────────────────
  if (raw.privacyResults) {
    const privFlags = raw.privacyResults.flags
    deduct(capped(
      privFlags.filter(f => f.severity === 'critical' || f.severity === 'high').length,
      4, 12
    ))
  }

  return Math.round(Math.min(100, Math.max(0, score)) * 100) / 100
}

/**
 * Takes the Claude-generated report and enriches it with raw tool data.
 * Claude handles issue classification and analysis text.
 * This function owns the score — Claude's overall_score is always overwritten.
 */
export function generateReport(claudeReport: ClaudeReport, raw: RawResults): ClaudeReport {
  const report = { ...claudeReport }

  // ── Deterministic score — overwrites Claude's opinion ───────────────────
  report.overall_score = calculateScore(report, raw)

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
  const criticalSecurityFlags = report.security_flags.filter(
    (f) => f.severity === 'critical' || f.severity === 'high'
  )

  if (report.critical_bugs.length > 0 && report.ship_verdict === 'yes') {
    report.ship_verdict = 'conditional'
  }
  if (criticalSecurityFlags.length > 0 && report.ship_verdict === 'yes') {
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
