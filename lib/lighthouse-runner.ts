/**
 * Lighthouse performance runner — server-side only
 * Uses the programmatic Lighthouse Node.js API
 *
 * NOTE: Lighthouse is loaded via require() to avoid webpack bundling.
 * This file must never be statically imported in webpack-traced paths.
 */

/* eslint-disable @typescript-eslint/no-require-imports */

export type LighthouseOptions = {
  url: string
  deadline: number
}

export type CoreWebVitals = {
  lcp?: number   // Largest Contentful Paint (ms)
  cls?: number   // Cumulative Layout Shift
  fid?: number   // First Input Delay (ms)
  inp?: number   // Interaction to Next Paint (ms)
  fcp?: number   // First Contentful Paint (ms)
  tti?: number   // Time to Interactive (ms)
  tbt?: number   // Total Blocking Time (ms)
  si?: number    // Speed Index
}

export type LighthouseCategory = {
  score: number | null
  title: string
}

export type LighthouseIssue = {
  id: string
  title: string
  description: string
  score: number | null
  displayValue?: string
  severity: 'error' | 'warning' | 'info'
}

export type LighthouseResults = {
  categories: {
    performance?: LighthouseCategory
    accessibility?: LighthouseCategory
    bestPractices?: LighthouseCategory
    seo?: LighthouseCategory
  }
  coreWebVitals: CoreWebVitals
  opportunities: LighthouseIssue[]
  diagnostics: LighthouseIssue[]
  score: number
  error?: string
}

export async function runLighthouseAudit(options: LighthouseOptions): Promise<LighthouseResults> {
  const { url, deadline } = options

  const emptyResults: LighthouseResults = {
    categories: {},
    coreWebVitals: {},
    opportunities: [],
    diagnostics: [],
    score: 0,
  }

  try {
    const remainingMs = deadline - Date.now()
    if (remainingMs < 30000) {
      return { ...emptyResults, error: 'Insufficient time for Lighthouse audit' }
    }

    // Use require() so webpack does NOT bundle these — they are runtime-loaded
    // eslint-disable-next-line
    const lighthouse = require('lighthouse')
    // eslint-disable-next-line
    const chromeLauncher = require('chrome-launcher')

    const lighthouseFn = lighthouse.default || lighthouse
    const launch = chromeLauncher.launch || chromeLauncher.default?.launch

    const chrome = await launch({
      chromeFlags: [
        '--headless',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
      ],
    })

    try {
      const runnerResult = await lighthouseFn(url, {
        logLevel: 'error',
        output: 'json',
        port: chrome.port,
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        settings: {
          formFactor: 'desktop',
          screenEmulation: {
            mobile: false,
            width: 1280,
            height: 800,
            deviceScaleFactor: 1,
            disabled: false,
          },
          throttlingMethod: 'simulate',
        },
      })

      if (!runnerResult?.lhr) {
        return { ...emptyResults, error: 'Lighthouse returned no results' }
      }

      const { lhr } = runnerResult

      const categories: LighthouseResults['categories'] = {
        performance: lhr.categories.performance
          ? { score: (lhr.categories.performance.score ?? 0) * 100, title: 'Performance' }
          : undefined,
        accessibility: lhr.categories.accessibility
          ? { score: (lhr.categories.accessibility.score ?? 0) * 100, title: 'Accessibility' }
          : undefined,
        bestPractices: lhr.categories['best-practices']
          ? { score: (lhr.categories['best-practices'].score ?? 0) * 100, title: 'Best Practices' }
          : undefined,
        seo: lhr.categories.seo
          ? { score: (lhr.categories.seo.score ?? 0) * 100, title: 'SEO' }
          : undefined,
      }

      const audits = lhr.audits
      const coreWebVitals: CoreWebVitals = {
        lcp: audits['largest-contentful-paint']?.numericValue,
        cls: audits['cumulative-layout-shift']?.numericValue,
        fid: audits['max-potential-fid']?.numericValue,
        inp: audits['interaction-to-next-paint']?.numericValue,
        fcp: audits['first-contentful-paint']?.numericValue,
        tti: audits['interactive']?.numericValue,
        tbt: audits['total-blocking-time']?.numericValue,
        si: audits['speed-index']?.numericValue,
      }

      const opportunities: LighthouseIssue[] = []
      const diagnostics: LighthouseIssue[] = []

      type LhrAudit = { score: number | null; title: string; description: string; displayValue?: string; details?: { type: string } }
      for (const [id, audit] of Object.entries(audits as Record<string, LhrAudit>)) {
        if (!audit.score || audit.score >= 0.9) continue
        if (audit.details?.type === 'opportunity') {
          opportunities.push({
            id,
            title: audit.title,
            description: (audit.description || '').split('\n')[0],
            score: audit.score,
            displayValue: audit.displayValue,
            severity: audit.score < 0.5 ? 'error' : 'warning',
          })
        } else if (audit.details?.type === 'table' || audit.details?.type === 'list') {
          diagnostics.push({
            id,
            title: audit.title,
            description: (audit.description || '').split('\n')[0],
            score: audit.score,
            displayValue: audit.displayValue,
            severity: audit.score < 0.5 ? 'error' : 'warning',
          })
        }
      }

      const score = Math.round((lhr.categories.performance?.score ?? 0) * 100)

      return { categories, coreWebVitals, opportunities, diagnostics, score }
    } finally {
      await chrome.kill()
    }
  } catch (err) {
    return {
      ...emptyResults,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
