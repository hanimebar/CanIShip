/**
 * Mobile audit runner — Playwright at 375×812 (iPhone viewport)
 * Checks: viewport meta tag, horizontal scroll, touch target sizes, tap target density
 */

import { chromium } from 'playwright'

export type MobileOptions = {
  url: string
  deadline: number
}

export type MobileIssue = {
  title: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  remediation: string
  evidence?: string
}

export type SmallTarget = {
  selector: string
  text: string
  width: number
  height: number
}

export type MobileResults = {
  hasViewportMeta: boolean
  viewportContent: string | null
  hasHorizontalScroll: boolean
  scrollWidth: number
  clientWidth: number
  smallTouchTargets: SmallTarget[]
  tapTargetsTested: number
  issues: MobileIssue[]
  score: number
  error?: string
}

export async function runMobileAudit(options: MobileOptions): Promise<MobileResults> {
  const { url, deadline } = options

  const empty: MobileResults = {
    hasViewportMeta: false,
    viewportContent: null,
    hasHorizontalScroll: false,
    scrollWidth: 0,
    clientWidth: 375,
    smallTouchTargets: [],
    tapTargetsTested: 0,
    issues: [],
    score: 0,
  }

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  })

  try {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    })

    const page = await context.newPage()
    const issues: MobileIssue[] = []

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: Math.min(30000, deadline - Date.now()),
    })
    await page.waitForTimeout(1500)

    // ── Viewport meta tag ──────────────────────────────────────────
    const viewportContent = await page.evaluate(() => {
      const meta = document.querySelector('meta[name="viewport"]')
      return meta ? meta.getAttribute('content') : null
    })
    const hasViewportMeta = !!viewportContent

    if (!hasViewportMeta) {
      issues.push({
        title: 'Missing viewport meta tag',
        description: 'Without <meta name="viewport">, mobile browsers render the page at desktop width and scale it down. Users will need to pinch-zoom to read anything.',
        severity: 'critical',
        remediation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to the <head>.',
      })
    } else if (viewportContent && viewportContent.includes('user-scalable=no')) {
      issues.push({
        title: 'Zoom disabled via user-scalable=no',
        description: 'Disabling user zoom breaks accessibility for users with low vision and violates WCAG 1.4.4.',
        severity: 'high',
        remediation: 'Remove user-scalable=no from the viewport meta tag.',
        evidence: viewportContent,
      })
    }

    // ── Horizontal scroll ──────────────────────────────────────────
    const scrollData = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    const hasHorizontalScroll = scrollData.scrollWidth > scrollData.clientWidth + 5

    if (hasHorizontalScroll) {
      issues.push({
        title: 'Horizontal scroll detected on mobile',
        description: `Page content (${scrollData.scrollWidth}px) overflows the mobile viewport (${scrollData.clientWidth}px). Users must scroll horizontally to see all content.`,
        severity: 'high',
        remediation: 'Add "overflow-x: hidden" on body/html, check for fixed-width elements wider than the viewport, use max-width: 100% on images.',
        evidence: `Content width: ${scrollData.scrollWidth}px vs viewport: ${scrollData.clientWidth}px`,
      })
    }

    // ── Touch target sizes ─────────────────────────────────────────
    // WCAG 2.5.5 recommends 44×44 CSS pixels minimum for touch targets
    const targetData = await page.evaluate(() => {
      const MIN_SIZE = 44
      const interactiveSelectors = 'a, button, [role="button"], input[type="submit"], input[type="button"], input[type="checkbox"], input[type="radio"], select, label[for]'
      const elements = Array.from(document.querySelectorAll(interactiveSelectors))

      const small: Array<{ selector: string; text: string; width: number; height: number }> = []

      for (const el of elements.slice(0, 100)) {
        const rect = el.getBoundingClientRect()
        // Skip invisible elements
        if (rect.width === 0 && rect.height === 0) continue
        // Skip elements that are just containers for other interactive elements
        const hasInteractiveChild = el.querySelector('a, button, [role="button"]')
        if (hasInteractiveChild) continue

        if (rect.width < MIN_SIZE || rect.height < MIN_SIZE) {
          const tag = el.tagName.toLowerCase()
          const text = (el.textContent || '').trim().slice(0, 40) ||
            el.getAttribute('aria-label') ||
            el.getAttribute('placeholder') ||
            el.getAttribute('href') ||
            tag
          small.push({
            selector: tag + (el.id ? `#${el.id}` : el.className ? `.${el.className.split(' ')[0]}` : ''),
            text,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          })
        }
      }

      return { small: small.slice(0, 10), total: elements.length }
    })

    if (targetData.small.length > 0) {
      issues.push({
        title: `${targetData.small.length} touch target(s) too small for mobile`,
        description: `Found ${targetData.small.length} interactive element(s) smaller than the recommended 44×44px minimum. Small targets are hard to tap accurately on mobile, especially for users with motor impairments.`,
        severity: targetData.small.length >= 5 ? 'high' : 'medium',
        remediation: 'Increase the padding or min-height/min-width on buttons and links to at least 44×44px. Use padding rather than explicit size to maintain visual design.',
        evidence: targetData.small.map((t) => `${t.selector} (${t.width}×${t.height}px): "${t.text}"`).slice(0, 3).join(' | '),
      })
    }

    await context.close()

    // ── Score ──────────────────────────────────────────────────────
    const deductions = { critical: 25, high: 15, medium: 8, low: 3 }
    const score = Math.max(
      0,
      100 - issues.reduce((sum, i) => sum + (deductions[i.severity] || 0), 0)
    )

    return {
      hasViewportMeta,
      viewportContent,
      hasHorizontalScroll,
      scrollWidth: scrollData.scrollWidth,
      clientWidth: scrollData.clientWidth,
      smallTouchTargets: targetData.small,
      tapTargetsTested: targetData.total,
      issues,
      score,
    }
  } catch (err) {
    return {
      ...empty,
      error: err instanceof Error ? err.message : String(err),
    }
  } finally {
    await browser.close()
  }
}
