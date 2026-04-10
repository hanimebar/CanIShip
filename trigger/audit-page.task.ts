/**
 * audit-page task — Trigger.dev child task
 *
 * Runs the full per-page audit (Playwright + axe + structure) for a single URL.
 * Triggered in parallel by the parent audit-pipeline task during multi-page crawls,
 * giving us concurrent page auditing instead of serial.
 *
 * Payload mirrors the minimum needed to reproduce what auditMultiPage does inline,
 * but with each page isolated in its own serverless invocation.
 */

import { task } from '@trigger.dev/sdk/v3'
import type { AuthConfig } from '@/lib/supabase'
import type { PageAuditResult } from '@/lib/playwright-runner'

export type AuditPagePayload = {
  url: string
  baseUrl: string
  jobId: string
  hasStrictCsp: boolean
  pageIndex: number
  authConfig?: AuthConfig
}

export const auditPageTask = task({
  id: 'audit-page',

  run: async (payload: AuditPagePayload): Promise<PageAuditResult | null> => {
    const { url, baseUrl, jobId, hasStrictCsp, pageIndex, authConfig } = payload

    // Dynamic require — prevents webpack bundling of native modules
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { chromium } = require('playwright')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { checkPageStructure, checkButtonInteractions } = require('../lib/playwright-runner')

    const browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
        '--single-process', '--disable-gpu',
      ],
    })

    try {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (compatible; CanIShip/1.0)',
        ignoreHTTPSErrors: true,
      })
      const page = await context.newPage()

      // Apply auth
      if (authConfig) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { applyAuth } = require('../lib/auth-runner')
        await applyAuth(context, page, baseUrl, authConfig)
      }

      const consoleErrors: Array<{ type: string; text: string }> = []
      page.on('console', (msg: { type(): string; text(): string }) => {
        if (msg.type() === 'error') {
          const text = msg.text()
          if (!text.includes('Content Security Policy') && !text.includes('chrome-extension://')) {
            consoleErrors.push({ type: 'error', text: text.slice(0, 300) })
          }
        }
      })

      const startTime = Date.now()
      const response = await page.goto(url, {
        waitUntil: hasStrictCsp ? 'domcontentloaded' : 'load',
        timeout: 20_000,
      })

      if (!response || response.status() >= 400) return null

      const loadTimeMs = Date.now() - startTime
      const title: string = await page.title()

      const [structure, buttonInteractions] = await Promise.all([
        checkPageStructure(page).catch(() => ({
          h1Count: 0, headingIssues: [], landmarkIssues: [], linkTextIssues: [], hasSkipLink: false,
        })),
        checkButtonInteractions(page, jobId, baseUrl, Date.now() + 30_000).catch(() => []),
      ])

      // Take screenshot
      let screenshotLabel: string | undefined
      try {
        const filename = `${jobId}-page-${pageIndex}-${Date.now()}.png`
        await page.screenshot({ path: `/tmp/${filename}`, fullPage: false, type: 'png' })
        screenshotLabel = `page-${pageIndex}`
      } catch { /* non-fatal */ }

      await context.close()

      return {
        url,
        title,
        loadTimeMs,
        structure,
        buttonInteractions,
        consoleErrors,
        screenshotLabel,
      }
    } finally {
      await browser.close().catch(() => { /* ignore */ })
    }
  },
})
