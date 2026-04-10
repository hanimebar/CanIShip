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
    const chromiumPath: string | undefined = pwChromium.executablePath?.()

    // If executablePath() returns undefined (can happen when Playwright's
    // browser cache is unavailable in the current environment), chrome-launcher
    // would throw "path argument must be of type string". Skip straight to PSI.
    if (!chromiumPath || typeof chromiumPath !== 'string') {
      const psiResult = await runPsiAudit(url)
      return psiResult ?? { ...emptyResults, error: 'Chromium path unavailable and PSI fallback failed' }
    }

    const chrome = await launch({
      chromePath: chromiumPath,
      // Explicit userDataDir avoids chrome-launcher trying to compute a temp
      // path via os.tmpdir() — which can return undefined in some containerised
      // environments and triggers the same "path must be string" error.
      userDataDir: `/tmp/caniship-lighthouse-${Date.now()}`,
      chromeFlags: [
        '--headless',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--disable-extensions',
        '--disable-component-extensions-with-background-pages',
      ],
    })

    // If Chrome launched but failed to bind a port (OOM, sandbox crash, etc.),
    // chrome.port is undefined. Passing it to Lighthouse causes the cryptic
    // "path argument must be string" error deep inside Lighthouse internals.
    if (!chrome.port || typeof chrome.port !== 'number') {
      await chrome.kill().catch(() => { /* ignore */ })
      throw new Error(`Chrome launched but did not return a valid debugging port (got: ${chrome.port})`)
    }

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
    // Local Lighthouse failed (common in memory-constrained containerised environments).
    // Fall back to PageSpeed Insights API — runs Lighthouse on Google's infrastructure,
    // works for any publicly accessible URL.
    console.warn('[Lighthouse] Local run failed, trying PSI fallback:', err instanceof Error ? err.stack ?? err.message : String(err))
    const psiResult = await runPsiAudit(url)
    if (psiResult) {
      console.log('[Lighthouse] PSI fallback succeeded')
      return psiResult
    }
    return {
      ...emptyResults,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ── PageSpeed Insights API fallback ──────────────────────────────────────────

type PsiAuditItem = {
  numericValue?: number
  title?: string
  description?: string
  score?: number | null
  displayValue?: string
  details?: { type?: string }
}

async function runPsiAudit(url: string): Promise<LighthouseResults | null> {
  try {
    const apiKey = process.env.PAGESPEED_API_KEY || ''
    const endpoint = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'
    const params = new URLSearchParams({
      url,
      strategy: 'desktop',
    })
    for (const cat of ['performance', 'accessibility', 'best-practices', 'seo']) {
      params.append('category', cat)
    }
    if (apiKey) params.set('key', apiKey)

    const res = await fetch(`${endpoint}?${params.toString()}`, {
      signal: AbortSignal.timeout(45000),
    })
    if (!res.ok) return null

    const data = await res.json() as {
      lighthouseResult?: {
        categories?: Record<string, { score?: number }>
        audits?: Record<string, PsiAuditItem>
      }
    }

    const lhr = data.lighthouseResult
    if (!lhr?.categories || !lhr?.audits) return null

    const categories: LighthouseResults['categories'] = {
      performance:   lhr.categories['performance']     ? { score: (lhr.categories['performance'].score     ?? 0) * 100, title: 'Performance' }   : undefined,
      accessibility: lhr.categories['accessibility']   ? { score: (lhr.categories['accessibility'].score   ?? 0) * 100, title: 'Accessibility' } : undefined,
      bestPractices: lhr.categories['best-practices']  ? { score: (lhr.categories['best-practices'].score  ?? 0) * 100, title: 'Best Practices' } : undefined,
      seo:           lhr.categories['seo']             ? { score: (lhr.categories['seo'].score             ?? 0) * 100, title: 'SEO' }           : undefined,
    }

    const a = lhr.audits
    const coreWebVitals: CoreWebVitals = {
      lcp: a['largest-contentful-paint']?.numericValue,
      cls: a['cumulative-layout-shift']?.numericValue,
      fcp: a['first-contentful-paint']?.numericValue,
      tti: a['interactive']?.numericValue,
      tbt: a['total-blocking-time']?.numericValue,
      si:  a['speed-index']?.numericValue,
      inp: a['interaction-to-next-paint']?.numericValue,
    }

    const opportunities: LighthouseIssue[] = []
    const diagnostics: LighthouseIssue[] = []

    for (const [id, audit] of Object.entries(a)) {
      if (audit.score == null || audit.score >= 0.9) continue
      const issue: LighthouseIssue = {
        id,
        title: audit.title || id,
        description: (audit.description || '').split('\n')[0],
        score: audit.score,
        displayValue: audit.displayValue,
        severity: audit.score < 0.5 ? 'error' : 'warning',
      }
      if (audit.details?.type === 'opportunity') opportunities.push(issue)
      else if (audit.details?.type === 'table' || audit.details?.type === 'list') diagnostics.push(issue)
    }

    const score = Math.round((lhr.categories['performance']?.score ?? 0) * 100)
    return { categories, coreWebVitals, opportunities, diagnostics, score }
  } catch {
    return null
  }
}
