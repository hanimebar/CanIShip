/**
 * Claude API analyzer — server-side only
 * Sends all audit layer results to Claude and gets back a structured report
 */

import Anthropic from '@anthropic-ai/sdk'
import type { PlaywrightResults } from './playwright-runner'
import type { AxeResults } from './axe-runner'
import type { LighthouseResults } from './lighthouse-runner'
import type { SecurityResults } from './security-checker'
import type { ClaudeReport } from './supabase'

const MODEL = 'claude-sonnet-4-20250514'

export type ClaudeAnalyzerInput = {
  url: string
  description: string
  flows: string[]
  playwrightResults: PlaywrightResults
  axeResults: AxeResults
  lighthouseResults: LighthouseResults
  securityResults: SecurityResults
  screenshots: Array<{ filename: string; storage_path: string; step_label: string }>
}

export async function analyzeWithClaude(input: ClaudeAnalyzerInput): Promise<ClaudeReport> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
  })

  const systemPrompt = `You are CanIShip, a senior QA engineer and product reviewer for web applications.
You are conducting a comprehensive pre-launch audit on behalf of a solo builder.
Your job is to think like a real user, a security reviewer, and a product manager simultaneously.

Be honest. Be specific. Be constructive. Your report determines whether this app ships.

Rules:
- Never fabricate data. Only report what the automated tests actually found.
- If a test layer had an error and returned no data, note it as "test layer unavailable" rather than guessing.
- Be specific: name the exact element, URL, or metric that has the issue.
- Severity must be accurate: "critical" means the app is broken or users will be blocked. "high" means significant UX harm. "medium" is a real issue but not a showstopper. "low" is good-to-fix.
- The overall_score should reflect actual findings: 90+ only if the app is genuinely production-ready.
- ship_verdict: "yes" if score >= 85 and no critical bugs; "no" if score < 50 or critical bugs exist; "conditional" otherwise.
- CRITICAL: Strict Content Security Policy (CSP) headers like frame-ancestors 'none' or script-src 'self' are SECURITY BEST PRACTICES. Never penalize an app for having strict CSP headers. If the audit data contains a "hasStrictCsp" or CSP-enforcement notes, treat them as positive security signals and add them to passed_checks instead.
- CRITICAL: Console messages about CSP violations, blocked frames, or refused resources caused by the app's own CSP are NOT app defects. They are the security policy working correctly. Never include these in critical_bugs, ux_issues, or security_flags.
- CRITICAL: If the Playwright data contains a note saying results are "unverifiable", "test runner lost context", or "test infrastructure issue" — do NOT penalise the app for those checks. Score only on what was successfully verified. A runner crash is not evidence of an application bug.`

  const userPrompt = buildUserPrompt(input)

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude')
    }

    // Extract JSON from response
    const jsonMatch = content.text.match(/```json\n?([\s\S]*?)\n?```/) ||
                      content.text.match(/(\{[\s\S]*\})/)

    if (!jsonMatch) {
      throw new Error('Claude did not return valid JSON')
    }

    const parsed = JSON.parse(jsonMatch[1]) as ClaudeReport

    // Validate required fields
    return validateAndNormalizeReport(parsed)
  } catch (err) {
    // Return a fallback report if Claude fails
    console.error('[Claude] Analysis failed:', err)
    return buildFallbackReport(input)
  }
}

function buildUserPrompt(input: ClaudeAnalyzerInput): string {
  const { url, description, flows, playwrightResults, axeResults, lighthouseResults, securityResults } = input

  const sections: string[] = []

  sections.push(`# App Audit Request

**URL**: ${url}
**Description**: ${description}
**Flows to check**: ${flows.length > 0 ? flows.join(', ') : 'General navigation and core functionality'}`)

  // Playwright results
  const cspNote = playwrightResults.hasStrictCsp
    ? `\n⚠️ IMPORTANT — STRICT CSP DETECTED: This app has a Content Security Policy header (${playwrightResults.detectedCsp?.slice(0, 120) || 'present'}). This is a GOOD security practice, not a defect. Do NOT penalize the app for having strict CSP headers. Any CSP-related console messages or blocked resource errors below are caused by the test environment, NOT by bugs in the app. Do not include them as issues in your report.`
    : ''

  sections.push(`## Functional Test Results (Playwright)
${cspNote}
**Pages visited**: ${playwrightResults.pagesVisited.join(', ') || 'None'}
**Load time**: ${playwrightResults.loadTimeMs ? `${playwrightResults.loadTimeMs}ms` : 'N/A'}
**Page title**: ${playwrightResults.pageTitle || 'N/A'}

**Functional issues found (${playwrightResults.functionalIssues.length})**:
${playwrightResults.functionalIssues.map((i) =>
  `- [${i.severity.toUpperCase()}] ${i.title}: ${i.description}${i.location ? ` (at: ${i.location})` : ''}`
).join('\n') || 'None'}

**Broken links (${playwrightResults.brokenLinks.length})**:
${playwrightResults.brokenLinks.map((l) =>
  `- ${l.href} → HTTP ${l.status}`
).join('\n') || 'None'}

**Console errors (${playwrightResults.consoleErrors.length})** (these are real app errors):
${playwrightResults.consoleErrors.slice(0, 10).map((e) =>
  `- [${e.type}] ${e.text}${e.location ? ` (${e.location})` : ''}`
).join('\n') || 'None'}

**CSP enforcement messages (${playwrightResults.cspViolations?.length ?? 0})** (these are security headers working correctly — NOT app bugs):
${(playwrightResults.cspViolations ?? []).slice(0, 5).map((e) =>
  `- [${e.type}] ${e.text}`
).join('\n') || 'None'}

**Network failures (${playwrightResults.networkFailures.length})**:
${playwrightResults.networkFailures.slice(0, 10).map((n) =>
  `- ${n.method} ${n.url} → ${n.status || n.failureText || 'failed'}`
).join('\n') || 'None'}

${playwrightResults.error
  ? playwrightResults.error.includes('unverifiable') || playwrightResults.error.includes('lost browser context') || playwrightResults.error.includes('test infrastructure')
    ? `**⚠️ Test runner note (NOT an app defect)**: ${playwrightResults.error}`
    : `**Runner error**: ${playwrightResults.error}`
  : ''}`)

  // Axe results
  sections.push(`## Accessibility Audit Results (axe-core WCAG 2.1 AA)

**Total violations**: ${axeResults.violationCounts.total}
- Critical: ${axeResults.violationCounts.critical}
- Serious: ${axeResults.violationCounts.serious}
- Moderate: ${axeResults.violationCounts.moderate}
- Minor: ${axeResults.violationCounts.minor}

**Violations**:
${axeResults.violations.slice(0, 15).map((v) =>
  `- [${v.impact.toUpperCase()}] ${v.help} (Rule: ${v.id}, WCAG: ${v.tags.filter((t) => t.includes('wcag')).join(', ')})
    Affects ${v.nodes.length} element(s). Example: ${v.nodes[0]?.html?.slice(0, 100) || 'N/A'}
    Fix: ${v.helpUrl}`
).join('\n') || 'None'}

**Checks that passed**: ${axeResults.passes.length} accessibility rules passed.

${axeResults.error ? `**Runner error**: ${axeResults.error}` : ''}`)

  // Lighthouse results
  sections.push(`## Performance Audit Results (Lighthouse)

**Performance score**: ${lighthouseResults.categories.performance?.score ?? 'N/A'}/100
**Accessibility score**: ${lighthouseResults.categories.accessibility?.score ?? 'N/A'}/100
**Best Practices score**: ${lighthouseResults.categories.bestPractices?.score ?? 'N/A'}/100
**SEO score**: ${lighthouseResults.categories.seo?.score ?? 'N/A'}/100

**Core Web Vitals**:
- LCP (Largest Contentful Paint): ${formatMs(lighthouseResults.coreWebVitals.lcp)} (target: < 2500ms)
- CLS (Cumulative Layout Shift): ${lighthouseResults.coreWebVitals.cls?.toFixed(3) ?? 'N/A'} (target: < 0.1)
- FCP (First Contentful Paint): ${formatMs(lighthouseResults.coreWebVitals.fcp)} (target: < 1800ms)
- TTI (Time to Interactive): ${formatMs(lighthouseResults.coreWebVitals.tti)} (target: < 3800ms)
- TBT (Total Blocking Time): ${formatMs(lighthouseResults.coreWebVitals.tbt)} (target: < 200ms)
- INP (Interaction to Next Paint): ${formatMs(lighthouseResults.coreWebVitals.inp)} (target: < 200ms)

**Opportunities to improve performance**:
${lighthouseResults.opportunities.slice(0, 8).map((o) =>
  `- [${o.severity.toUpperCase()}] ${o.title}${o.displayValue ? `: ${o.displayValue}` : ''}`
).join('\n') || 'None'}

${lighthouseResults.error ? `**Runner error**: ${lighthouseResults.error}` : ''}`)

  // Security results
  sections.push(`## Security Surface Scan

**HTTPS**: ${securityResults.isHttps ? 'Yes' : 'No — CRITICAL'}
**Mixed content**: ${securityResults.hasMixedContent ? 'Yes — ISSUE' : 'No'}
**Security score**: ${securityResults.score}/100
**Strict CSP detected**: ${playwrightResults.hasStrictCsp ? `Yes — STRONG SECURITY POSTURE. Raw header: ${playwrightResults.detectedCsp?.slice(0, 200) || 'present'}` : 'No'}

**Security flags (${securityResults.flags.length})**:
${securityResults.flags.map((f) =>
  `- [${f.severity.toUpperCase()}] ${f.title}: ${f.description}
    Remediation: ${f.remediation}`
).join('\n') || 'None'}

**Headers checked**:
${Object.entries(securityResults.headers).map(([h, v]) =>
  `- ${h}: ${v ? 'PRESENT' : 'MISSING'}`
).join('\n')}

${securityResults.error ? `**Runner error**: ${securityResults.error}` : ''}`)

  sections.push(`---

Now produce a comprehensive audit report as a single JSON object with this exact structure:

\`\`\`json
{
  "overall_score": <0-100 integer>,
  "ship_verdict": "<yes|no|conditional>",
  "critical_bugs": [
    {
      "title": "...",
      "description": "...",
      "location": "...",
      "severity": "critical",
      "remediation": "..."
    }
  ],
  "ux_issues": [
    {
      "title": "...",
      "description": "...",
      "location": "...",
      "severity": "<high|medium|low>",
      "remediation": "..."
    }
  ],
  "accessibility_violations": [
    {
      "title": "...",
      "description": "...",
      "wcag_reference": "...",
      "wcag_level": "<A|AA|AAA>",
      "impact": "<critical|serious|moderate|minor>",
      "elements_affected": <number>,
      "remediation": "..."
    }
  ],
  "performance_issues": [
    {
      "title": "...",
      "description": "...",
      "metric": "...",
      "value": "...",
      "target": "...",
      "severity": "<high|medium|low>",
      "remediation": "..."
    }
  ],
  "security_flags": [
    {
      "title": "...",
      "description": "...",
      "severity": "<critical|high|medium|low>",
      "remediation": "..."
    }
  ],
  "warnings": [
    {
      "title": "...",
      "description": "...",
      "severity": "low"
    }
  ],
  "passed_checks": [
    {
      "title": "...",
      "description": "..."
    }
  ],
  "risks": [
    {
      "title": "...",
      "description": "...",
      "impact": "<high|medium|low>"
    }
  ],
  "rewards": [
    {
      "title": "...",
      "description": "..."
    }
  ],
  "future_recommendations": [
    {
      "title": "...",
      "description": "...",
      "priority": "<high|medium|low>",
      "effort": "<low|medium|high>"
    }
  ],
  "plain_english_summary": "...",
  "top_5_fixes": [
    {
      "priority": 1,
      "title": "...",
      "description": "...",
      "estimated_effort": "..."
    }
  ]
}
\`\`\``)

  return sections.join('\n\n')
}

function formatMs(value?: number): string {
  if (value === undefined || value === null) return 'N/A'
  return `${Math.round(value)}ms`
}

function validateAndNormalizeReport(report: Partial<ClaudeReport>): ClaudeReport {
  return {
    overall_score: Math.min(100, Math.max(0, report.overall_score ?? 50)),
    ship_verdict: ['yes', 'no', 'conditional'].includes(report.ship_verdict as string)
      ? (report.ship_verdict as 'yes' | 'no' | 'conditional')
      : 'conditional',
    critical_bugs: Array.isArray(report.critical_bugs) ? report.critical_bugs : [],
    ux_issues: Array.isArray(report.ux_issues) ? report.ux_issues : [],
    accessibility_violations: Array.isArray(report.accessibility_violations) ? report.accessibility_violations : [],
    performance_issues: Array.isArray(report.performance_issues) ? report.performance_issues : [],
    security_flags: Array.isArray(report.security_flags) ? report.security_flags : [],
    warnings: Array.isArray(report.warnings) ? report.warnings : [],
    passed_checks: Array.isArray(report.passed_checks) ? report.passed_checks : [],
    risks: Array.isArray(report.risks) ? report.risks : [],
    rewards: Array.isArray(report.rewards) ? report.rewards : [],
    future_recommendations: Array.isArray(report.future_recommendations) ? report.future_recommendations : [],
    plain_english_summary: report.plain_english_summary || 'Audit complete. See findings above.',
    top_5_fixes: Array.isArray(report.top_5_fixes) ? report.top_5_fixes : [],
  }
}

function buildFallbackReport(input: ClaudeAnalyzerInput): ClaudeReport {
  const { playwrightResults, axeResults, lighthouseResults, securityResults } = input

  const criticalCount = playwrightResults.functionalIssues.filter((i) => i.severity === 'critical').length +
    axeResults.violationCounts.critical +
    securityResults.flags.filter((f) => f.severity === 'critical').length

  const score = Math.max(0, 100 - criticalCount * 20 - axeResults.violationCounts.total * 2)

  return {
    overall_score: score,
    ship_verdict: criticalCount > 0 ? 'no' : score >= 85 ? 'yes' : 'conditional',
    critical_bugs: playwrightResults.functionalIssues
      .filter((i) => i.severity === 'critical')
      .map((i) => ({
        title: i.title,
        description: i.description,
        location: i.location,
        severity: 'critical' as const,
        remediation: 'Investigate and resolve this issue before shipping.',
      })),
    ux_issues: playwrightResults.functionalIssues
      .filter((i) => i.severity !== 'critical')
      .map((i) => ({
        title: i.title,
        description: i.description,
        location: i.location,
        severity: i.severity,
        remediation: 'Review and address this UX friction point.',
      })),
    accessibility_violations: axeResults.violations.slice(0, 5).map((v) => ({
      title: v.help,
      description: v.description,
      wcag_reference: v.tags.find((t) => t.includes('wcag'))?.replace('wcag', 'WCAG ') || '',
      wcag_level: 'AA' as const,
      impact: v.impact,
      elements_affected: v.nodes.length,
      remediation: `See: ${v.helpUrl}`,
    })),
    performance_issues: lighthouseResults.opportunities.slice(0, 3).map((o) => ({
      title: o.title,
      description: o.description,
      metric: o.id,
      value: o.displayValue || '',
      target: 'See Lighthouse recommendations',
      severity: o.severity === 'error' ? 'high' as const : 'medium' as const,
      remediation: 'Review Lighthouse audit report for specific guidance.',
    })),
    security_flags: securityResults.flags.map((f) => ({
      title: f.title,
      description: f.description,
      severity: f.severity,
      remediation: f.remediation,
    })),
    warnings: playwrightResults.brokenLinks.slice(0, 5).map((l) => ({
      title: `Broken link: ${l.href}`,
      description: `Returns HTTP ${l.status}`,
      severity: 'low' as const,
    })),
    passed_checks: axeResults.passes.slice(0, 5).map((p) => ({
      title: p.description,
      description: `${p.nodes} elements passed this check`,
    })),
    risks: [],
    rewards: [],
    future_recommendations: [],
    plain_english_summary: `Automated analysis complete. Found ${criticalCount} critical issue(s) and ${axeResults.violationCounts.total} accessibility violation(s). Note: AI analysis was unavailable for this audit — raw tool data is shown above.`,
    top_5_fixes: [],
  }
}
