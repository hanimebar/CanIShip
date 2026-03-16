/**
 * Playwright Runner — server-side only
 * Runs functional tests, link checking, console error capture,
 * and network failure detection against the target URL.
 */

import { chromium, type Page, type Browser } from 'playwright'

export type PlaywrightOptions = {
  url: string
  description: string
  flows: string[]
  depth: 'quick' | 'standard' | 'deep'
  jobId: string
  deadline: number
}

export type NetworkRequest = {
  url: string
  status: number
  method: string
  resourceType: string
  failed?: boolean
  failureText?: string
}

export type ConsoleMessage = {
  type: string
  text: string
  location?: string
}

export type BrokenLink = {
  href: string
  sourceUrl: string
  status: number
  text?: string
}

export type PlaywrightScreenshot = {
  filename: string
  storage_path: string
  step_label: string
  dataUrl?: string
}

export type PlaywrightResults = {
  functionalIssues: Array<{
    title: string
    description: string
    location?: string
    severity: 'critical' | 'high' | 'medium' | 'low'
  }>
  brokenLinks: BrokenLink[]
  consoleErrors: ConsoleMessage[]
  cspViolations: ConsoleMessage[]   // CSP enforcement messages — not app defects
  networkFailures: NetworkRequest[]
  screenshots: PlaywrightScreenshot[]
  pagesVisited: string[]
  httpResponses: Array<{ url: string; status: number; method: string }>
  pageTitle?: string
  loadTimeMs?: number
  detectedCsp?: string | null       // Raw CSP value if present
  hasStrictCsp: boolean             // True if app has CSP headers
  error?: string
}

const MOBILE_VIEWPORT = { width: 375, height: 812 }
const DESKTOP_VIEWPORT = { width: 1280, height: 800 }

export async function runPlaywrightAudit(options: PlaywrightOptions): Promise<PlaywrightResults> {
  const { url, depth, jobId, deadline } = options

  const results: PlaywrightResults = {
    functionalIssues: [],
    brokenLinks: [],
    consoleErrors: [],
    cspViolations: [],
    networkFailures: [],
    screenshots: [],
    pagesVisited: [],
    httpResponses: [],
    hasStrictCsp: false,
    detectedCsp: null,
  }

  // ---- Probe security headers before launching browser ----
  const { hasStrictCsp, cspValue } = await probeSecurityHeaders(url)
  results.hasStrictCsp = hasStrictCsp
  results.detectedCsp = cspValue

  let browser: Browser | null = null

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
      ],
    })

    const context = await browser.newContext({
      viewport: DESKTOP_VIEWPORT,
      userAgent:
        'Mozilla/5.0 (compatible; CanIShip/1.0; +https://caniship.actvli.com)',
      ignoreHTTPSErrors: true,
    })

    const page = await context.newPage()

    // ---- Capture console messages ----
    page.on('console', (msg) => {
      if (['error', 'warning'].includes(msg.type())) {
        const text = msg.text()
        const isCspViolation =
          text.includes('Content Security Policy') ||
          text.includes('violated directive') ||
          text.includes('frame-ancestors') ||
          text.includes('content-security-policy')

        const entry = { type: msg.type(), text, location: msg.location()?.url }
        if (isCspViolation) {
          results.cspViolations.push(entry)
        } else {
          results.consoleErrors.push(entry)
        }
      }
    })

    // ---- Capture unhandled promise rejections ----
    page.on('pageerror', (err) => {
      results.consoleErrors.push({
        type: 'error',
        text: `Unhandled rejection: ${err.message}`,
      })
    })

    // ---- Capture network responses ----
    const allLinks: Set<string> = new Set()
    const visited: Set<string> = new Set()

    page.on('response', (response) => {
      const reqUrl = response.url()
      const status = response.status()
      const method = response.request().method()
      const resourceType = response.request().resourceType()

      results.httpResponses.push({ url: reqUrl, status, method })

      if (status >= 400 && resourceType !== 'image') {
        results.networkFailures.push({
          url: reqUrl,
          status,
          method,
          resourceType,
          failed: true,
        })
      }
    })

    page.on('requestfailed', (request) => {
      results.networkFailures.push({
        url: request.url(),
        status: 0,
        method: request.method(),
        resourceType: request.resourceType(),
        failed: true,
        failureText: request.failure()?.errorText,
      })
    })

    // ---- Navigate to URL ----
    const startTime = Date.now()
    let navigationError: string | undefined

    try {
      const response = await page.goto(url, {
        waitUntil: hasStrictCsp ? 'domcontentloaded' : 'networkidle',
        timeout: Math.min(30000, deadline - Date.now()),
      })

      results.loadTimeMs = Date.now() - startTime
      results.pageTitle = await page.title()
      results.pagesVisited.push(url)
      visited.add(url)

      if (!response || response.status() >= 400) {
        results.functionalIssues.push({
          title: 'Homepage failed to load',
          description: `The main URL returned HTTP ${response?.status() ?? 'no response'}`,
          location: url,
          severity: 'critical',
        })
      }
    } catch (err) {
      navigationError = err instanceof Error ? err.message : String(err)
      results.functionalIssues.push({
        title: 'Navigation failed',
        description: `Could not load ${url}: ${navigationError}`,
        location: url,
        severity: 'critical',
      })
    }

    // ---- Screenshot: initial load ----
    const initialScreenshot = await takeScreenshot(page, jobId, 'initial-load')
    if (initialScreenshot) results.screenshots.push(initialScreenshot)

    // ---- Collect all internal links ----
    if (!navigationError) {
      const baseHost = new URL(url).host

      const links = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a[href]'))
          .map((a) => ({
            href: (a as HTMLAnchorElement).href,
            text: (a as HTMLAnchorElement).innerText?.trim().slice(0, 100),
          }))
          .filter((l) => l.href && !l.href.startsWith('javascript:') && !l.href.startsWith('mailto:') && !l.href.startsWith('tel:'))
      })

      for (const link of links) {
        try {
          const parsed = new URL(link.href)
          if (parsed.host === baseHost) {
            allLinks.add(link.href)
          }
        } catch {
          // Invalid URL
        }
      }

      // ---- Check for broken links (limit by depth) ----
      const maxLinks = depth === 'quick' ? 10 : depth === 'standard' ? 30 : 60
      const linksToCheck = Array.from(allLinks).slice(0, maxLinks)

      for (const linkUrl of linksToCheck) {
        if (Date.now() > deadline - 10000) break
        if (visited.has(linkUrl)) continue
        visited.add(linkUrl)

        try {
          const response = await fetch(linkUrl, {
            method: 'HEAD',
            signal: AbortSignal.timeout(8000),
          })

          if (response.status === 404) {
            results.brokenLinks.push({
              href: linkUrl,
              sourceUrl: url,
              status: 404,
            })
          } else if (response.status >= 400) {
            results.brokenLinks.push({
              href: linkUrl,
              sourceUrl: url,
              status: response.status,
            })
          }
        } catch {
          results.brokenLinks.push({
            href: linkUrl,
            sourceUrl: url,
            status: 0,
          })
        }
      }

      // ---- Check for missing interactive states ----
      await checkInteractiveElements(page, results)

      // ---- Mobile responsiveness check (quick check) ----
      if (depth !== 'quick') {
        await context.close()
        const mobileContext = await browser.newContext({
          viewport: MOBILE_VIEWPORT,
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
          ignoreHTTPSErrors: true,
        })
        const mobilePage = await mobileContext.newPage()

        try {
          await mobilePage.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 })
          await checkMobileLayout(mobilePage, results)
          const mobileShot = await takeScreenshot(mobilePage, jobId, 'mobile-viewport')
          if (mobileShot) results.screenshots.push(mobileShot)
        } catch {
          // Non-fatal
        } finally {
          await mobileContext.close()
        }
      }
    }

    // ---- Classify console errors ----
    classifyConsoleErrors(results)

  } catch (err) {
    results.error = err instanceof Error ? err.message : String(err)
    results.functionalIssues.push({
      title: 'Playwright runner failed',
      description: results.error,
      severity: 'critical',
    })
  } finally {
    if (browser) {
      try { await browser.close() } catch { /* ignore */ }
    }
  }

  return results
}

async function probeSecurityHeaders(url: string): Promise<{ hasStrictCsp: boolean; cspValue: string | null }> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    })
    const csp = response.headers.get('content-security-policy') || response.headers.get('content-security-policy-report-only')
    if (!csp) return { hasStrictCsp: false, cspValue: null }

    const hasStrictCsp =
      csp.includes('frame-ancestors') ||
      csp.includes("default-src 'none'") ||
      csp.includes("default-src 'self'") ||
      csp.includes("script-src 'none'")

    return { hasStrictCsp, cspValue: csp }
  } catch {
    return { hasStrictCsp: false, cspValue: null }
  }
}

async function checkInteractiveElements(page: Page, results: PlaywrightResults) {
  try {
    // Check for buttons without visible text
    const emptyButtons = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'))
      return buttons
        .filter((b) => !b.textContent?.trim() && !b.getAttribute('aria-label'))
        .length
    })

    if (emptyButtons > 0) {
      results.functionalIssues.push({
        title: `${emptyButtons} button(s) with no visible text or aria-label`,
        description: 'Buttons without labels are inaccessible and confusing for screen reader users.',
        severity: 'high',
      })
    }

    // Check for forms without submit buttons
    const invalidForms = await page.evaluate(() => {
      const forms = Array.from(document.querySelectorAll('form'))
      return forms.filter((f) => !f.querySelector('button[type="submit"], input[type="submit"]')).length
    })

    if (invalidForms > 0) {
      results.functionalIssues.push({
        title: `${invalidForms} form(s) without a submit button`,
        description: 'Forms without submit buttons may prevent users from completing actions.',
        severity: 'high',
      })
    }

    // Check for images without alt text
    const noAltImages = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('img:not([alt])'))
        .filter((img) => !(img as HTMLImageElement).closest('[role="presentation"]'))
        .length
    })

    if (noAltImages > 0) {
      results.functionalIssues.push({
        title: `${noAltImages} image(s) missing alt text`,
        description: 'Images without alt attributes are inaccessible to screen readers.',
        severity: 'medium',
      })
    }

    // Check for 404 page indicators
    const is404 = await page.evaluate(() => {
      const title = document.title.toLowerCase()
      const body = document.body.innerText.toLowerCase()
      return title.includes('404') || title.includes('not found') ||
             body.includes('page not found') || body.includes('404 error')
    })

    if (is404) {
      results.functionalIssues.push({
        title: 'Homepage shows 404 content',
        description: 'The main page appears to display a 404 or "not found" error.',
        severity: 'critical',
      })
    }

  } catch {
    // Non-fatal
  }
}

async function checkMobileLayout(page: Page, results: PlaywrightResults) {
  try {
    const overflowIssues = await page.evaluate(() => {
      const body = document.body
      const issues: string[] = []

      // Check horizontal overflow
      if (body.scrollWidth > body.clientWidth + 5) {
        issues.push(`Horizontal scroll detected: body.scrollWidth=${body.scrollWidth} > viewport=${body.clientWidth}`)
      }

      // Check for elements that extend beyond viewport
      const overflowing = Array.from(document.querySelectorAll('*')).filter((el) => {
        const rect = el.getBoundingClientRect()
        return rect.right > window.innerWidth + 20
      })

      if (overflowing.length > 0) {
        issues.push(`${overflowing.length} element(s) extend beyond the mobile viewport`)
      }

      return issues
    })

    for (const issue of overflowIssues) {
      results.functionalIssues.push({
        title: 'Mobile layout overflow',
        description: issue,
        severity: 'high',
      })
    }
  } catch {
    // Non-fatal
  }
}

function classifyConsoleErrors(results: PlaywrightResults) {
  // Deduplicate and filter noise
  const seen = new Set<string>()
  results.consoleErrors = results.consoleErrors.filter((msg) => {
    const key = `${msg.type}:${msg.text.slice(0, 100)}`
    if (seen.has(key)) return false
    seen.add(key)
    // Filter browser extension noise
    if (msg.text.includes('chrome-extension://')) return false
    if (msg.text.includes('favicon')) return false
    return true
  })
}

async function takeScreenshot(
  page: Page,
  jobId: string,
  label: string
): Promise<PlaywrightScreenshot | null> {
  try {
    const filename = `${jobId}-${label}-${Date.now()}.png`
    const storagePath = `screenshots/${jobId}/${filename}`

    // In production: upload to Supabase Storage
    // For now: take screenshot as buffer and store path
    await page.screenshot({
      path: `/tmp/${filename}`,
      fullPage: false,
      type: 'png',
    })

    return {
      filename,
      storage_path: storagePath,
      step_label: label,
    }
  } catch {
    return null
  }
}
