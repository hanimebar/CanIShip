/**
 * Axe-core accessibility runner — server-side only
 * Injects axe-core via Playwright and runs WCAG 2.1 AA audit
 */

import { chromium } from 'playwright'
import AxeBuilder from '@axe-core/playwright'

export type AxeOptions = {
  url: string
  jobId: string
  deadline: number
}

export type AxeViolation = {
  id: string
  impact: 'critical' | 'serious' | 'moderate' | 'minor'
  tags: string[]
  description: string
  help: string
  helpUrl: string
  nodes: Array<{
    html: string
    target: string[]
    failureSummary?: string
  }>
}

export type AxeResults = {
  violations: AxeViolation[]
  passes: Array<{ id: string; description: string; nodes: number }>
  incomplete: AxeViolation[]
  violationCounts: {
    critical: number
    serious: number
    moderate: number
    minor: number
    total: number
  }
  error?: string
}

export async function runAxeAudit(options: AxeOptions): Promise<AxeResults> {
  const { url, deadline } = options

  const emptyResults: AxeResults = {
    violations: [],
    passes: [],
    incomplete: [],
    violationCounts: { critical: 0, serious: 0, moderate: 0, minor: 0, total: 0 },
  }

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-zygote',
    ],
  })

  try {
    const page = await browser.newPage()

    // Use domcontentloaded — networkidle can hang on sites with strict CSP
    // (CSP blocks external resources that never resolve, so idle is never reached)
    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: Math.min(30000, deadline - Date.now()),
    })

    // Brief pause for JS-rendered content
    await page.waitForTimeout(1500)

    const axeBuilder = new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'])
      .exclude('#axe-temp')

    const axeRaw = await axeBuilder.analyze()

    const violations = axeRaw.violations.map((v) => ({
      id: v.id,
      impact: (v.impact || 'minor') as 'critical' | 'serious' | 'moderate' | 'minor',
      tags: v.tags,
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      nodes: v.nodes.slice(0, 5).map((n) => ({
        html: n.html.slice(0, 300),
        target: n.target.map(String),
        failureSummary: n.failureSummary,
      })),
    }))

    const passes = axeRaw.passes.map((p) => ({
      id: p.id,
      description: p.description,
      nodes: p.nodes.length,
    }))

    const incomplete = axeRaw.incomplete.map((v) => ({
      id: v.id,
      impact: (v.impact || 'minor') as 'critical' | 'serious' | 'moderate' | 'minor',
      tags: v.tags,
      description: v.description,
      help: v.help,
      helpUrl: v.helpUrl,
      nodes: v.nodes.slice(0, 3).map((n) => ({
        html: n.html.slice(0, 300),
        target: n.target.map(String),
        failureSummary: n.failureSummary,
      })),
    }))

    const counts = violations.reduce(
      (acc, v) => {
        acc[v.impact] = (acc[v.impact] || 0) + 1
        acc.total += 1
        return acc
      },
      { critical: 0, serious: 0, moderate: 0, minor: 0, total: 0 }
    )

    return { violations, passes, incomplete, violationCounts: counts }
  } catch (err) {
    return {
      ...emptyResults,
      error: err instanceof Error ? err.message : String(err),
    }
  } finally {
    await browser.close()
  }
}
