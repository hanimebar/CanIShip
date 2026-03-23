/**
 * Claude API analyzer — server-side only
 *
 * Three distinct analysis tiers:
 *   free    — basic QA summary, one voice, surface-level remediation
 *   builder — expert-voice analysis per domain, detailed why + step-by-step fix
 *   studio  — full expert panel: AI-fixable vs human-required, exact AI prompts,
 *             honest "refer to specialist" callouts, written from the relevant
 *             expert's perspective for every issue category
 */

import Anthropic from '@anthropic-ai/sdk'
import type { PlaywrightResults } from './playwright-runner'
import type { AxeResults } from './axe-runner'
import type { LighthouseResults } from './lighthouse-runner'
import type { SecurityResults } from './security-checker'
import type { SeoResults } from './seo-checker'
import type { MobileResults } from './mobile-runner'
import type { ClaudeReport, ReportTier } from './supabase'

const MODEL = 'claude-sonnet-4-20250514'

export type ClaudeAnalyzerInput = {
  url: string
  description: string
  flows: string[]
  tier: ReportTier
  target_platform?: 'mobile' | 'desktop' | 'all'
  playwrightResults: PlaywrightResults
  axeResults: AxeResults
  lighthouseResults: LighthouseResults
  securityResults: SecurityResults
  seoResults: SeoResults
  mobileResults: MobileResults
  screenshots: Array<{ filename: string; storage_path: string; step_label: string }>
}

// ─── Token budgets per tier ────────────────────────────────────────────────
const MAX_TOKENS: Record<ReportTier, number> = {
  free:    4096,
  builder: 12000,
  studio:  16000,
}

// ─── Expert roles by issue category ───────────────────────────────────────
const EXPERT_ROLES = {
  functional: 'Senior Full-Stack Engineer',
  ux:         'Senior Product Designer (UX)',
  a11y:       'WCAG Accessibility Specialist',
  performance:'Site Reliability & Performance Engineer',
  security:   'Senior Application Security Engineer (OWASP)',
  seo:        'Technical SEO Specialist',
  mobile:     'Mobile UX Engineer',
}

// ─── System prompts ────────────────────────────────────────────────────────

const SYSTEM_FREE = `You are CanIShip, a senior QA engineer reviewing a web application before launch.
Report what the automated tests found. Be direct. Be honest.

Rules:
- Never fabricate findings. Only report what the tests actually found.
- If a test layer returned no data or had an error, note it as "test layer unavailable" — do not penalise the score for it and do NOT include it as a finding or production risk.
- Strict CSP headers are a security best practice. Never flag them as bugs.
- critical = app is broken or users will be blocked. high = significant harm. medium = real issue, not a showstopper. low = good-to-fix.
- ship_verdict: "yes" if score >= 85 and no critical APPLICATION bugs; "no" if score < 50 or critical application bugs; "conditional" otherwise. Test infrastructure failures (scanner errors, missing runner data) are NEVER a reason for a conditional verdict — only actual defects in the application itself count.`

const SYSTEM_BUILDER = `You are a panel of domain experts conducting a professional pre-launch code review of a web application.

For every issue found, you speak from the perspective of the relevant specialist:
- Functional and UX issues → ${EXPERT_ROLES.functional} and ${EXPERT_ROLES.ux}
- Accessibility issues → ${EXPERT_ROLES.a11y}
- Performance issues → ${EXPERT_ROLES.performance}
- Security issues → ${EXPERT_ROLES.security}
- SEO issues → ${EXPERT_ROLES.seo}
- Mobile issues → ${EXPERT_ROLES.mobile}

For each issue you must provide:
1. What the problem is (technically precise, not vague)
2. WHY it matters — the real-world impact on users, business, or legal risk
3. Step-by-step remediation — not a hint, an actual action plan

Rules:
- Never fabricate findings. Only report what the automated tests actually found.
- Strict CSP headers are a security best practice. Never flag them as issues.
- If a test layer had an error, mark as "test layer unavailable" — do not score-penalise for it and do NOT include it as a finding or production risk.
- ship_verdict must be "yes" if score >= 85 with no critical application bugs. Test scanner failures are NEVER grounds for a "conditional" verdict.
- Write like a senior engineer doing a thorough code review — direct, specific, no filler.
- Every remediation step should be concrete enough to execute without googling.`

const SYSTEM_STUDIO = `You are a multi-disciplinary expert panel conducting a professional pre-launch audit of a web application. This is the Studio tier — your report must be the most thorough and actionable audit this developer has ever received.

Domain experts on the panel:
- ${EXPERT_ROLES.functional} (functional/UX issues)
- ${EXPERT_ROLES.a11y} (accessibility)
- ${EXPERT_ROLES.performance} (performance)
- ${EXPERT_ROLES.security} (security)
- ${EXPERT_ROLES.seo} (SEO)
- ${EXPERT_ROLES.mobile} (mobile)

For every issue you must:
1. State which expert is writing this section (expert_role)
2. Write the issue from that expert's professional perspective (expert_perspective)
3. Explain the real-world impact — user harm, legal risk, revenue loss, or trust damage (why_it_matters)
4. Give a detailed step-by-step fix (detailed_remediation)
5. State honestly whether an AI coding assistant can fix this reliably (ai_fixable: true/false)
6. If ai_fixable is true: provide the exact prompt the developer can paste into Claude or ChatGPT to fix it (ai_prompt). Be specific — include file names if inferrable, the exact change needed, and any context the AI needs.
7. If human review is required: state that clearly (human_review_required: true), name the type of expert (human_expert_type), and explain why automated or AI fixes are insufficient (human_review_reason).

Be honest. Some things should not be fixed by AI. A penetration tester cannot be replaced by a prompt. An accessibility audit by a blind user cannot be automated. Say so when it is true.

Rules:
- Never fabricate findings.
- Strict CSP headers are a security best practice. Never flag them as issues.
- Test layer unavailability is NOT an application defect — do not include it as a finding, production risk, or reason for a conditional verdict.
- ship_verdict must be "yes" if score >= 85 with no critical application bugs. Test scanner errors never affect the verdict.
- Write with professional depth — this report may be read by the developer's clients or investors.`

// ─── Main export ───────────────────────────────────────────────────────────

export async function analyzeWithClaude(input: ClaudeAnalyzerInput): Promise<ClaudeReport> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const systemPrompt = {
    free:    SYSTEM_FREE,
    builder: SYSTEM_BUILDER,
    studio:  SYSTEM_STUDIO,
  }[input.tier]

  const userPrompt = buildUserPrompt(input)

  try {
    const response = await client.messages.create({
      model:      MODEL,
      max_tokens: MAX_TOKENS[input.tier],
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userPrompt }],
    })

    const content = response.content[0]
    if (content.type !== 'text') throw new Error('Unexpected response type from Claude')

    const jsonMatch =
      content.text.match(/```json\n?([\s\S]*?)\n?```/) ||
      content.text.match(/(\{[\s\S]*\})/)

    if (!jsonMatch) throw new Error('Claude did not return valid JSON')

    return validateAndNormalizeReport(JSON.parse(jsonMatch[1]) as ClaudeReport)
  } catch (err) {
    console.error('[Claude] Analysis failed:', err)
    return buildFallbackReport(input)
  }
}

// ─── User prompt (data payload — same for all tiers, schema request varies) ─

const PLATFORM_CONTEXT: Record<string, string> = {
  mobile: `## Target Platform: MOBILE-FIRST
This app is designed primarily for mobile devices (phones and tablets, ≤768px screens).
Mobile responsiveness, touch targets, and small-screen layout are CRITICAL — weight them heavily.
Desktop layout issues are low priority.`,

  desktop: `## Target Platform: DESKTOP / WEB APP
This app is designed primarily for desktop and laptop users (≥1024px screens).
Mobile responsiveness issues (touch target sizes, small-viewport layout, horizontal scroll on 375px) should be NOTED but carry significantly reduced weight in the overall score — approximately 30% of their normal impact.
This is a deliberate product decision, not a defect. Do not penalise heavily for mobile-only issues.
Prioritise functional correctness, performance, security, and desktop UX instead.`,

  all: `## Target Platform: ALL SCREENS
This app must work across all device sizes. Apply standard weighting to all dimensions including mobile.`,
}

function buildUserPrompt(input: ClaudeAnalyzerInput): string {
  const { url, description, flows, tier, target_platform = 'all',
          playwrightResults, axeResults,
          lighthouseResults, securityResults, seoResults, mobileResults } = input

  const sections: string[] = []

  sections.push(`# App Audit Request — Tier: ${tier.toUpperCase()}

${PLATFORM_CONTEXT[target_platform]}

**URL**: ${url}
**Description**: ${description}
**Flows to check**: ${flows.length > 0 ? flows.join(', ') : 'General navigation and core functionality'}`)

  // Playwright
  const cspNote = playwrightResults.hasStrictCsp
    ? `\n⚠️ STRICT CSP DETECTED (${playwrightResults.detectedCsp?.slice(0, 120) || 'present'}) — this is a security best practice, NOT a defect. Do not penalise for it.`
    : ''

  sections.push(`## Functional Test Results (Playwright)${cspNote}
Pages visited: ${playwrightResults.pagesVisited.join(', ') || 'None'}
Load time: ${playwrightResults.loadTimeMs ? `${playwrightResults.loadTimeMs}ms` : 'N/A'}
Page title: ${playwrightResults.pageTitle || 'N/A'}

Functional issues (${playwrightResults.functionalIssues.length}):
${playwrightResults.functionalIssues.map(i =>
  `- [${i.severity.toUpperCase()}] ${i.title}: ${i.description}${i.location ? ` (at: ${i.location})` : ''}`
).join('\n') || 'None'}

Broken links (${playwrightResults.brokenLinks.length}):
${playwrightResults.brokenLinks.map(l => `- ${l.href} → HTTP ${l.status}`).join('\n') || 'None'}

Console errors (${playwrightResults.consoleErrors.length}) — real app errors:
${playwrightResults.consoleErrors.slice(0, 10).map(e =>
  `- [${e.type}] ${e.text}${e.location ? ` (${e.location})` : ''}`
).join('\n') || 'None'}

CSP enforcement messages (${playwrightResults.cspViolations?.length ?? 0}) — security headers working, NOT bugs:
${(playwrightResults.cspViolations ?? []).slice(0, 5).map(e => `- ${e.text}`).join('\n') || 'None'}

Network failures (${playwrightResults.networkFailures.length}):
${playwrightResults.networkFailures.slice(0, 10).map(n =>
  `- ${n.method} ${n.url} → ${n.status || n.failureText || 'failed'}`
).join('\n') || 'None'}
${playwrightResults.error ? `\nRunner note: ${playwrightResults.error}` : ''}`)

  // Axe
  sections.push(`## Accessibility (axe-core WCAG 2.1 AA)
Violations: ${axeResults.violationCounts.total} total (critical: ${axeResults.violationCounts.critical}, serious: ${axeResults.violationCounts.serious}, moderate: ${axeResults.violationCounts.moderate}, minor: ${axeResults.violationCounts.minor})

${axeResults.violations.slice(0, 20).map(v =>
  `- [${v.impact.toUpperCase()}] ${v.help}
  Rule: ${v.id} | WCAG: ${v.tags.filter(t => t.includes('wcag')).join(', ')}
  Affects ${v.nodes.length} element(s). Example: ${v.nodes[0]?.html?.slice(0, 120) || 'N/A'}
  Reference: ${v.helpUrl}`
).join('\n') || 'None'}

Passed checks: ${axeResults.passes.length}
${axeResults.error ? `Runner error: ${axeResults.error}` : ''}`)

  // Lighthouse
  sections.push(`## Performance (Lighthouse)
Scores — Performance: ${lighthouseResults.categories.performance?.score ?? 'N/A'}/100 | A11y: ${lighthouseResults.categories.accessibility?.score ?? 'N/A'}/100 | Best Practices: ${lighthouseResults.categories.bestPractices?.score ?? 'N/A'}/100 | SEO: ${lighthouseResults.categories.seo?.score ?? 'N/A'}/100

Core Web Vitals:
- LCP: ${formatMs(lighthouseResults.coreWebVitals.lcp)} (target < 2500ms)
- CLS: ${lighthouseResults.coreWebVitals.cls?.toFixed(3) ?? 'N/A'} (target < 0.1)
- FCP: ${formatMs(lighthouseResults.coreWebVitals.fcp)} (target < 1800ms)
- TTI: ${formatMs(lighthouseResults.coreWebVitals.tti)} (target < 3800ms)
- TBT: ${formatMs(lighthouseResults.coreWebVitals.tbt)} (target < 200ms)
- INP: ${formatMs(lighthouseResults.coreWebVitals.inp)} (target < 200ms)

Opportunities:
${lighthouseResults.opportunities.slice(0, 10).map(o =>
  `- [${o.severity.toUpperCase()}] ${o.title}${o.displayValue ? `: ${o.displayValue}` : ''}`
).join('\n') || 'None'}
${lighthouseResults.error ? `Runner error: ${lighthouseResults.error}` : ''}`)

  // Security
  sections.push(`## Security Surface Scan
HTTPS: ${securityResults.isHttps ? 'Yes' : 'NO — CRITICAL'}
Mixed content: ${securityResults.hasMixedContent ? 'YES — issue' : 'No'}
Security score: ${securityResults.score}/100
Strict CSP: ${playwrightResults.hasStrictCsp ? `YES — good security posture (${playwrightResults.detectedCsp?.slice(0, 150) || 'present'})` : 'No'}

Flags (${securityResults.flags.length}):
${securityResults.flags.map(f =>
  `- [${f.severity.toUpperCase()}] ${f.title}: ${f.description}\n  Remediation: ${f.remediation}`
).join('\n') || 'None'}

Headers:
${Object.entries(securityResults.headers).map(([h, v]) => `- ${h}: ${v ? 'PRESENT' : 'MISSING'}`).join('\n')}
${securityResults.error ? `Runner error: ${securityResults.error}` : ''}`)

  // SEO
  sections.push(`## SEO Audit
Title: ${seoResults.title ? `"${seoResults.title}" (${seoResults.titleLength} chars)` : 'MISSING'}
Meta description: ${seoResults.description ? `"${seoResults.description.slice(0, 120)}" (${seoResults.descriptionLength} chars)` : 'MISSING'}
Canonical: ${seoResults.hasCanonical ? seoResults.canonical : 'MISSING'}
Lang attribute: ${seoResults.hasLangAttribute ? seoResults.lang : 'MISSING'}
H1 count: ${seoResults.h1Count}${seoResults.h1Text[0] ? ` — "${seoResults.h1Text[0]}"` : ''}
Open Graph: title=${seoResults.openGraph.title ? 'present' : 'MISSING'}, description=${seoResults.openGraph.description ? 'present' : 'MISSING'}, image=${seoResults.openGraph.image ? 'present' : 'MISSING'}
Twitter Card: ${seoResults.twitterCard.card || 'MISSING'}
robots.txt: ${seoResults.hasRobotsTxt ? 'Found' : 'NOT FOUND'}
sitemap.xml: ${seoResults.hasSitemap ? 'Found' : 'NOT FOUND'}
Images without alt: ${seoResults.imagesWithoutAlt}
SEO score: ${seoResults.score}/100

Issues (${seoResults.issues.length}):
${seoResults.issues.map(i =>
  `- [${i.severity.toUpperCase()}] ${i.title}: ${i.description}\n  Fix: ${i.remediation}`
).join('\n') || 'None'}
${seoResults.error ? `Runner error: ${seoResults.error}` : ''}`)

  // Mobile
  sections.push(`## Mobile Audit (375px viewport)
Viewport meta: ${mobileResults.hasViewportMeta ? `Present — "${mobileResults.viewportContent}"` : 'MISSING'}
Horizontal scroll: ${mobileResults.hasHorizontalScroll ? `YES — ${mobileResults.scrollWidth}px wide vs ${mobileResults.clientWidth}px viewport` : 'None'}
Touch targets tested: ${mobileResults.tapTargetsTested}
Undersized touch targets (<44×44px): ${mobileResults.smallTouchTargets.length}${mobileResults.smallTouchTargets.length > 0 ? ` — e.g. ${mobileResults.smallTouchTargets[0].selector} (${mobileResults.smallTouchTargets[0].width}×${mobileResults.smallTouchTargets[0].height}px)` : ''}
Mobile score: ${mobileResults.score}/100

Issues (${mobileResults.issues.length}):
${mobileResults.issues.map(i =>
  `- [${i.severity.toUpperCase()}] ${i.title}: ${i.description}\n  Fix: ${i.remediation}`
).join('\n') || 'None'}
${mobileResults.error ? `Runner error: ${mobileResults.error}` : ''}`)

  // Output schema — varies by tier
  sections.push(`---\n\n${buildOutputSchema(tier)}`)

  return sections.join('\n\n')
}

// ─── Output schema instructions per tier ──────────────────────────────────

function buildOutputSchema(tier: ReportTier): string {
  if (tier === 'free') {
    return `Produce a JSON audit report with this exact structure:

\`\`\`json
{
  "overall_score": <0-100>,
  "ship_verdict": "<yes|no|conditional>",
  "critical_bugs": [{ "title": "", "description": "", "location": "", "severity": "critical", "remediation": "" }],
  "ux_issues": [{ "title": "", "description": "", "location": "", "severity": "<high|medium|low>", "remediation": "" }],
  "accessibility_violations": [{ "title": "", "description": "", "wcag_reference": "", "wcag_level": "<A|AA|AAA>", "impact": "<critical|serious|moderate|minor>", "elements_affected": 0, "remediation": "" }],
  "performance_issues": [{ "title": "", "description": "", "metric": "", "value": "", "target": "", "severity": "<high|medium|low>", "remediation": "" }],
  "security_flags": [{ "title": "", "description": "", "severity": "<critical|high|medium|low>", "remediation": "" }],
  "warnings": [{ "title": "", "description": "", "severity": "low" }],
  "passed_checks": [{ "title": "", "description": "" }],
  "risks": [{ "title": "", "description": "", "impact": "<high|medium|low>" }],
  "rewards": [{ "title": "", "description": "" }],
  "future_recommendations": [{ "title": "", "description": "", "priority": "<high|medium|low>", "effort": "<low|medium|high>" }],
  "plain_english_summary": "3-4 sentences a non-technical founder can act on.",
  "top_5_fixes": [{ "priority": 1, "title": "", "description": "", "estimated_effort": "" }]
}
\`\`\``
  }

  if (tier === 'builder') {
    return `Produce a JSON audit report. For every issue, include the expert_role, why_it_matters, and detailed_remediation fields. These are not optional — they are the core value of the Builder tier.

\`\`\`json
{
  "overall_score": <0-100>,
  "ship_verdict": "<yes|no|conditional>",
  "critical_bugs": [{
    "title": "",
    "description": "Technically precise description of what is broken.",
    "location": "",
    "severity": "critical",
    "remediation": "Short hint",
    "expert_role": "${EXPERT_ROLES.functional}",
    "expert_perspective": "How this expert sees and frames this specific problem.",
    "why_it_matters": "The real-world user or business impact of this bug — not just 'it is broken'.",
    "detailed_remediation": "Step-by-step action plan. Each step is a concrete instruction, not a suggestion."
  }],
  "ux_issues": [{
    "title": "", "description": "", "location": "", "severity": "<high|medium|low>", "remediation": "",
    "expert_role": "${EXPERT_ROLES.ux}",
    "expert_perspective": "",
    "why_it_matters": "",
    "detailed_remediation": ""
  }],
  "accessibility_violations": [{
    "title": "", "description": "", "wcag_reference": "", "wcag_level": "<A|AA|AAA>",
    "impact": "<critical|serious|moderate|minor>", "elements_affected": 0, "remediation": "",
    "expert_role": "${EXPERT_ROLES.a11y}",
    "expert_perspective": "",
    "why_it_matters": "",
    "detailed_remediation": ""
  }],
  "performance_issues": [{
    "title": "", "description": "", "metric": "", "value": "", "target": "", "severity": "<high|medium|low>", "remediation": "",
    "expert_role": "${EXPERT_ROLES.performance}",
    "expert_perspective": "",
    "why_it_matters": "",
    "detailed_remediation": ""
  }],
  "security_flags": [{
    "title": "", "description": "", "severity": "<critical|high|medium|low>", "remediation": "",
    "expert_role": "${EXPERT_ROLES.security}",
    "expert_perspective": "",
    "why_it_matters": "",
    "detailed_remediation": ""
  }],
  "warnings": [{ "title": "", "description": "", "severity": "low" }],
  "passed_checks": [{ "title": "", "description": "" }],
  "risks": [{ "title": "", "description": "", "impact": "<high|medium|low>" }],
  "rewards": [{ "title": "", "description": "" }],
  "future_recommendations": [{ "title": "", "description": "", "priority": "<high|medium|low>", "effort": "<low|medium|high>" }],
  "plain_english_summary": "4-6 sentences. Written for a non-technical founder. Name the most important things to fix and why.",
  "top_5_fixes": [{ "priority": 1, "title": "", "description": "", "estimated_effort": "" }]
}
\`\`\``
  }

  // Studio tier
  return `Produce a full expert panel audit report. Every issue must include all expert and AI-fixability fields. The ai_prompt field, when present, must be a complete, ready-to-paste prompt — not a description of what a prompt should say.

Be honest about human_review_required. If a security issue requires manual penetration testing, say so. If an accessibility issue requires testing with a screen reader user, say so. Do not claim AI can fully resolve things it cannot.

\`\`\`json
{
  "overall_score": <0-100>,
  "ship_verdict": "<yes|no|conditional>",
  "critical_bugs": [{
    "title": "",
    "description": "Technically precise.",
    "location": "",
    "severity": "critical",
    "remediation": "Short hint",
    "expert_role": "",
    "expert_perspective": "Written in first person from the expert's voice.",
    "why_it_matters": "User harm, legal exposure, revenue impact, or trust damage.",
    "detailed_remediation": "Step-by-step. Concrete. Executable.",
    "ai_fixable": true,
    "ai_confidence": "<high|medium|low>",
    "ai_prompt": "You are a senior [role]. The following app has this issue: [precise description]. Here is the relevant code context: [ask developer to paste]. Fix it by: [exact instructions]. Return only the corrected code with a one-line explanation of each change.",
    "human_review_required": false,
    "human_expert_type": "",
    "human_review_reason": ""
  }],
  "ux_issues": [{
    "title": "", "description": "", "location": "", "severity": "<high|medium|low>", "remediation": "",
    "expert_role": "${EXPERT_ROLES.ux}",
    "expert_perspective": "", "why_it_matters": "", "detailed_remediation": "",
    "ai_fixable": true, "ai_confidence": "<high|medium|low>",
    "ai_prompt": "",
    "human_review_required": false, "human_expert_type": "", "human_review_reason": ""
  }],
  "accessibility_violations": [{
    "title": "", "description": "", "wcag_reference": "", "wcag_level": "<A|AA|AAA>",
    "impact": "<critical|serious|moderate|minor>", "elements_affected": 0, "remediation": "",
    "expert_role": "${EXPERT_ROLES.a11y}",
    "expert_perspective": "", "why_it_matters": "", "detailed_remediation": "",
    "ai_fixable": true, "ai_confidence": "<high|medium|low>",
    "ai_prompt": "",
    "human_review_required": false, "human_expert_type": "", "human_review_reason": ""
  }],
  "performance_issues": [{
    "title": "", "description": "", "metric": "", "value": "", "target": "", "severity": "<high|medium|low>", "remediation": "",
    "expert_role": "${EXPERT_ROLES.performance}",
    "expert_perspective": "", "why_it_matters": "", "detailed_remediation": "",
    "ai_fixable": true, "ai_confidence": "<high|medium|low>",
    "ai_prompt": "",
    "human_review_required": false, "human_expert_type": "", "human_review_reason": ""
  }],
  "security_flags": [{
    "title": "", "description": "", "severity": "<critical|high|medium|low>", "remediation": "",
    "expert_role": "${EXPERT_ROLES.security}",
    "expert_perspective": "", "why_it_matters": "", "detailed_remediation": "",
    "ai_fixable": false, "ai_confidence": "<high|medium|low>",
    "ai_prompt": "",
    "human_review_required": true,
    "human_expert_type": "e.g. Penetration Tester, Application Security Consultant",
    "human_review_reason": "Why AI cannot fully resolve this."
  }],
  "warnings": [{ "title": "", "description": "", "severity": "low" }],
  "passed_checks": [{ "title": "", "description": "" }],
  "risks": [{ "title": "", "description": "", "impact": "<high|medium|low>" }],
  "rewards": [{ "title": "", "description": "" }],
  "future_recommendations": [{ "title": "", "description": "", "priority": "<high|medium|low>", "effort": "<low|medium|high>" }],
  "plain_english_summary": "5-7 sentences. Written for a founder. Cover what was found, what is most urgent, what AI can fix today, and what needs a human specialist.",
  "top_5_fixes": [{ "priority": 1, "title": "", "description": "", "estimated_effort": "" }]
}
\`\`\``
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatMs(value?: number): string {
  if (value === undefined || value === null) return 'N/A'
  return `${Math.round(value)}ms`
}

function validateAndNormalizeReport(report: Partial<ClaudeReport>): ClaudeReport {
  return {
    overall_score:             Math.min(100, Math.max(0, report.overall_score ?? 50)),
    ship_verdict:              (['yes', 'no', 'conditional'].includes(report.ship_verdict as string) ? report.ship_verdict : 'conditional') as 'yes' | 'no' | 'conditional',
    critical_bugs:             Array.isArray(report.critical_bugs)             ? report.critical_bugs             : [],
    ux_issues:                 Array.isArray(report.ux_issues)                 ? report.ux_issues                 : [],
    accessibility_violations:  Array.isArray(report.accessibility_violations)  ? report.accessibility_violations  : [],
    performance_issues:        Array.isArray(report.performance_issues)        ? report.performance_issues        : [],
    security_flags:            Array.isArray(report.security_flags)            ? report.security_flags            : [],
    warnings:                  Array.isArray(report.warnings)                  ? report.warnings                  : [],
    passed_checks:             Array.isArray(report.passed_checks)             ? report.passed_checks             : [],
    risks:                     Array.isArray(report.risks)                     ? report.risks                     : [],
    rewards:                   Array.isArray(report.rewards)                   ? report.rewards                   : [],
    future_recommendations:    Array.isArray(report.future_recommendations)    ? report.future_recommendations    : [],
    plain_english_summary:     report.plain_english_summary || 'Audit complete.',
    top_5_fixes:               Array.isArray(report.top_5_fixes)               ? report.top_5_fixes               : [],
  }
}

function buildFallbackReport(input: ClaudeAnalyzerInput): ClaudeReport {
  const { playwrightResults, axeResults, lighthouseResults, securityResults } = input
  const criticalCount =
    playwrightResults.functionalIssues.filter(i => i.severity === 'critical').length +
    axeResults.violationCounts.critical +
    securityResults.flags.filter(f => f.severity === 'critical').length

  const score = Math.max(0, 100 - criticalCount * 20 - axeResults.violationCounts.total * 2)

  return {
    overall_score:  score,
    ship_verdict:   criticalCount > 0 ? 'no' : score >= 85 ? 'yes' : 'conditional',
    critical_bugs:  playwrightResults.functionalIssues.filter(i => i.severity === 'critical').map(i => ({
      title: i.title, description: i.description, location: i.location, severity: 'critical' as const, remediation: 'Investigate before shipping.',
    })),
    ux_issues:      playwrightResults.functionalIssues.filter(i => i.severity !== 'critical').map(i => ({
      title: i.title, description: i.description, location: i.location, severity: i.severity, remediation: 'Review this UX friction point.',
    })),
    accessibility_violations: axeResults.violations.slice(0, 5).map(v => ({
      title: v.help, description: v.description,
      wcag_reference: v.tags.find(t => t.includes('wcag'))?.replace('wcag', 'WCAG ') || '',
      wcag_level: 'AA' as const, impact: v.impact, elements_affected: v.nodes.length,
      remediation: `See: ${v.helpUrl}`,
    })),
    performance_issues: lighthouseResults.opportunities.slice(0, 3).map(o => ({
      title: o.title, description: o.description, metric: o.id, value: o.displayValue || '',
      target: 'See Lighthouse', severity: o.severity === 'error' ? 'high' as const : 'medium' as const,
      remediation: 'Review Lighthouse audit.',
    })),
    security_flags: securityResults.flags.map(f => ({
      title: f.title, description: f.description, severity: f.severity, remediation: f.remediation,
    })),
    warnings:            playwrightResults.brokenLinks.slice(0, 5).map(l => ({ title: `Broken link: ${l.href}`, description: `Returns HTTP ${l.status}`, severity: 'low' as const })),
    passed_checks:       axeResults.passes.slice(0, 5).map(p => ({ title: p.description, description: `${p.nodes} elements passed` })),
    risks:               [],
    rewards:             [],
    future_recommendations: [],
    plain_english_summary: `Automated analysis complete. Found ${criticalCount} critical issue(s) and ${axeResults.violationCounts.total} accessibility violation(s). AI analysis was unavailable — raw data shown.`,
    top_5_fixes:         [],
  }
}
