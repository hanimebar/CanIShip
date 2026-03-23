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
  // Mobile Lighthouse scores (simulated throttling, Moto G4 emulation)
  mobileCategories?: {
    performance?: LighthouseCategory
    accessibility?: LighthouseCategory
    bestPractices?: LighthouseCategory
    seo?: LighthouseCategory
  }
  mobileCoreWebVitals?: CoreWebVitals
  mobileScore?: number
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

  type LhrAudit = { score: number | null; title: string; description: string; displayValue?: string; details?: { type: string } }

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

    // Resolve Playwright's bundled Chromium path so chrome-launcher uses the
    // same binary as everything else. Without this, chrome-launcher scans
    // system paths (/usr/bin/chromium etc.) which are not installed in the
    // Docker image — causing a silent "Chrome not found" failure every time.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { chromium: pwChromium } = require('playwright')
    const chromiumPath: string = pwChromium.executablePath()

    const chrome = await launch({
      chromePath: chromiumPath,
      chromeFlags: [
        '--headless',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--single-process',
        '--disable-extensions',
        '--disable-component-extensions-with-background-pages',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-first-run',
      ],
    })

    try {
      // ── Desktop run ────────────────────────────────────────────
      const desktopResult = await lighthouseFn(url, {
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

      if (!desktopResult?.lhr) {
        return { ...emptyResults, error: 'Lighthouse returned no results' }
      }

      const lhr = desktopResult.lhr

      const categories: LighthouseResults['categories'] = {
        performance:  lhr.categories.performance      ? { score: (lhr.categories.performance.score ?? 0) * 100,      title: 'Performance' }   : undefined,
        accessibility: lhr.categories.accessibility   ? { score: (lhr.categories.accessibility.score ?? 0) * 100,   title: 'Accessibility' } : undefined,
        bestPractices: lhr.categories['best-practices']? { score: (lhr.categories['best-practices'].score ?? 0) * 100, title: 'Best Practices' }: undefined,
        seo:           lhr.categories.seo             ? { score: (lhr.categories.seo.score ?? 0) * 100,             title: 'SEO' }           : undefined,
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
        si:  audits['speed-index']?.numericValue,
      }

      const opportunities: LighthouseIssue[] = []
      const diagnostics: LighthouseIssue[] = []

      for (const [id, audit] of Object.entries(audits as Record<string, LhrAudit>)) {
        if (!audit.score || audit.score >= 0.9) continue
        if (audit.details?.type === 'opportunity') {
          opportunities.push({ id, title: audit.title, description: (audit.description || '').split('\n')[0], score: audit.score, displayValue: audit.displayValue, severity: audit.score < 0.5 ? 'error' : 'warning' })
        } else if (audit.details?.type === 'table' || audit.details?.type === 'list') {
          diagnostics.push({ id, title: audit.title, description: (audit.description || '').split('\n')[0], score: audit.score, displayValue: audit.displayValue, severity: audit.score < 0.5 ? 'error' : 'warning' })
        }
      }

      const score = Math.round((lhr.categories.performance?.score ?? 0) * 100)

      // ── Mobile run (only if deadline allows ≥ 45s more) ───────
      let mobileCategories: LighthouseResults['mobileCategories']
      let mobileCoreWebVitals: CoreWebVitals | undefined
      let mobileScore: number | undefined

      const remainingForMobile = deadline - Date.now()
      if (remainingForMobile >= 45000) {
        try {
          const mobileResult = await lighthouseFn(url, {
            logLevel: 'error',
            output: 'json',
            port: chrome.port,
            onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
            settings: {
              formFactor: 'mobile',
              screenEmulation: {
                mobile: true,
                width: 390,
                height: 844,
                deviceScaleFactor: 3,
                disabled: false,
              },
              throttlingMethod: 'simulate',
              // Simulate a mid-tier Android device (approx Moto G Power)
              throttling: {
                rttMs: 40,
                throughputKbps: 10240,
                cpuSlowdownMultiplier: 4,
              },
            },
          })

          if (mobileResult?.lhr) {
            const mlhr = mobileResult.lhr
            mobileCategories = {
              performance:   mlhr.categories.performance       ? { score: (mlhr.categories.performance.score ?? 0) * 100,       title: 'Performance (Mobile)' }    : undefined,
              accessibility: mlhr.categories.accessibility     ? { score: (mlhr.categories.accessibility.score ?? 0) * 100,     title: 'Accessibility (Mobile)' }  : undefined,
              bestPractices: mlhr.categories['best-practices'] ? { score: (mlhr.categories['best-practices'].score ?? 0) * 100, title: 'Best Practices (Mobile)' } : undefined,
              seo:           mlhr.categories.seo               ? { score: (mlhr.categories.seo.score ?? 0) * 100,               title: 'SEO (Mobile)' }            : undefined,
            }
            const ma = mlhr.audits
            mobileCoreWebVitals = {
              lcp: ma['largest-contentful-paint']?.numericValue,
              cls: ma['cumulative-layout-shift']?.numericValue,
              fcp: ma['first-contentful-paint']?.numericValue,
              tti: ma['interactive']?.numericValue,
              tbt: ma['total-blocking-time']?.numericValue,
              inp: ma['interaction-to-next-paint']?.numericValue,
            }
            mobileScore = Math.round((mlhr.categories.performance?.score ?? 0) * 100)
          }
        } catch { /* mobile run is non-fatal — desktop results still returned */ }
      }

      return { categories, mobileCategories, mobileCoreWebVitals, mobileScore, coreWebVitals, opportunities, diagnostics, score }
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
