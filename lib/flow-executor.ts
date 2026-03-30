/**
 * Flow Executor — Phase 2 interactive testing
 *
 * Each user-defined flow (plain English) is sent to Claude to be parsed into
 * structured Playwright steps. The executor then runs each step, captures
 * before/after screenshots, and records pass/fail per step.
 *
 * This makes the "Specific flows to test" field actually run instead of just
 * being forwarded as context text to Claude's main analysis.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { Browser, Page } from 'playwright'
import type { AuthConfig, FlowExecutionResult, FlowStepResult } from './supabase'

const MODEL = 'claude-haiku-4-5-20251001' // fast + cheap for step parsing

const MAX_STEPS_PER_FLOW = 10
const STEP_TIMEOUT_MS = 8000
const POST_ACTION_WAIT_MS = 1200

// ── Types ──────────────────────────────────────────────────────────────────

type ParsedStep = {
  action: 'navigate' | 'click' | 'fill' | 'wait' | 'assert_visible' | 'assert_text' | 'assert_url' | 'press_key'
  selector?: string      // CSS / text / aria selector
  value?: string         // for fill, assert_text, navigate (URL), press_key (key name)
  description: string    // human-readable description of this step
}

// ── Main export ────────────────────────────────────────────────────────────

const BROWSER_ARGS = [
  '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
  '--single-process', '--disable-gpu', '--no-first-run',
]

/**
 * Executes all user-defined flows against the app.
 * Manages its own browser lifecycle — callers do not need to pass a Browser.
 * Each flow gets its own isolated context (and auth session if provided).
 * Results are returned in order — failures don't abort subsequent flows.
 */
export async function executeFlows(
  baseUrl: string,
  flows: string[],
  jobId: string,
  authConfig: AuthConfig | undefined,
  deadline: number,
): Promise<FlowExecutionResult[]> {
  if (flows.length === 0) return []

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const results: FlowExecutionResult[] = []

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { chromium } = require(/* webpackIgnore: true */ 'playwright')
  let browser: Browser | null = null

  try {
    browser = await chromium.launch({ headless: true, args: BROWSER_ARGS })

    for (const flowText of flows) {
      if (Date.now() > deadline - 60000) {
        results.push({
          flow_text: flowText,
          overall_status: 'skipped',
          steps: [],
          error: 'Deadline reached — remaining flows were skipped.',
        })
        continue
      }

      const result = await executeOneFlow(client, browser!, baseUrl, flowText, jobId, authConfig, deadline)
      results.push(result)
    }
  } catch (err) {
    results.push({
      flow_text: 'flow runner startup',
      overall_status: 'skipped',
      steps: [],
      error: `Flow runner could not start browser: ${err instanceof Error ? err.message : String(err)}`,
    })
  } finally {
    if (browser) { try { await browser.close() } catch { /* ignore */ } }
  }

  return results
}

// ── Single flow execution ──────────────────────────────────────────────────

async function executeOneFlow(
  client: Anthropic,
  browser: Browser,
  baseUrl: string,
  flowText: string,
  jobId: string,
  authConfig: AuthConfig | undefined,
  deadline: number,
): Promise<FlowExecutionResult> {
  // Step 1 — ask Claude to parse the flow into structured steps
  let steps: ParsedStep[]
  try {
    steps = await parseFlowWithClaude(client, baseUrl, flowText)
  } catch (err) {
    return {
      flow_text: flowText,
      overall_status: 'skipped',
      steps: [],
      error: `Could not parse flow into steps: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  if (steps.length === 0) {
    return {
      flow_text: flowText,
      overall_status: 'skipped',
      steps: [],
      error: 'Claude could not generate executable steps from this flow description.',
    }
  }

  // Step 2 — execute steps in a fresh isolated context
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let context: any = null
  const stepResults: FlowStepResult[] = []

  try {
    context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (compatible; CanIShip-FlowRunner/1.0)',
      ignoreHTTPSErrors: true,
    })
    const page = await context.newPage()

    // Apply auth before running the flow
    if (authConfig) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { applyAuth } = require(/* webpackIgnore: true */ './auth-runner')
      const authResult = await applyAuth(context, page, baseUrl, authConfig)
      if (!authResult.success) {
        return {
          flow_text: flowText,
          overall_status: 'failed',
          steps: [],
          error: `Auth failed before flow could run: ${authResult.error}`,
        }
      }
    }

    // Navigate to the base URL as starting point
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })

    // Step 3 — run each parsed step
    for (const step of steps.slice(0, MAX_STEPS_PER_FLOW)) {
      if (Date.now() > deadline - 30000) {
        stepResults.push({
          description: step.description,
          action: step.action,
          selector: step.selector,
          value: step.value,
          status: 'skipped',
          details: 'Deadline reached.',
        })
        break
      }

      const stepResult = await runStep(page, step, jobId, stepResults.length)
      stepResults.push(stepResult)

      if (stepResult.status === 'failed') break // stop on first failure
    }

  } catch (err) {
    stepResults.push({
      description: 'Flow runner error',
      action: 'navigate',
      status: 'failed',
      details: err instanceof Error ? err.message : String(err),
    })
  } finally {
    if (context) {
      try { await context.close() } catch { /* ignore */ }
    }
  }

  const passed  = stepResults.filter((s) => s.status === 'passed').length
  const failed  = stepResults.filter((s) => s.status === 'failed').length
  const skipped = stepResults.filter((s) => s.status === 'skipped').length

  const overall_status: FlowExecutionResult['overall_status'] =
    failed > 0 && passed === 0  ? 'failed'  :
    failed > 0 && passed > 0    ? 'partial' :
    skipped > 0 && passed === 0 ? 'skipped' :
    'passed'

  return { flow_text: flowText, overall_status, steps: stepResults }
}

// ── Step runner ────────────────────────────────────────────────────────────

async function runStep(
  page: Page,
  step: ParsedStep,
  jobId: string,
  stepIndex: number,
): Promise<FlowStepResult> {
  const base: Omit<FlowStepResult, 'status' | 'details'> = {
    description: step.description,
    action: step.action,
    selector: step.selector,
    value: step.value,
  }

  // Screenshot before
  const beforeLabel = `flow-step-${stepIndex}-before`
  const beforeShot = await captureStepScreenshot(page, jobId, beforeLabel)

  try {
    switch (step.action) {
      case 'navigate': {
        const target = step.value?.startsWith('http')
          ? step.value
          : new URL(step.value ?? '/', page.url()).href
        await page.goto(target, { waitUntil: 'domcontentloaded', timeout: STEP_TIMEOUT_MS })
        break
      }

      case 'click': {
        if (!step.selector) throw new Error('click step missing selector')
        await page.click(step.selector, { timeout: STEP_TIMEOUT_MS })
        await page.waitForTimeout(POST_ACTION_WAIT_MS)
        break
      }

      case 'fill': {
        if (!step.selector) throw new Error('fill step missing selector')
        await page.fill(step.selector, step.value ?? '', { timeout: STEP_TIMEOUT_MS })
        break
      }

      case 'press_key': {
        await page.keyboard.press(step.value ?? 'Enter')
        await page.waitForTimeout(POST_ACTION_WAIT_MS)
        break
      }

      case 'wait': {
        const ms = parseInt(step.value ?? '1000', 10)
        await page.waitForTimeout(Math.min(ms, 5000))
        break
      }

      case 'assert_visible': {
        if (!step.selector) throw new Error('assert_visible step missing selector')
        const el = await page.waitForSelector(step.selector, { state: 'visible', timeout: STEP_TIMEOUT_MS })
        if (!el) throw new Error(`Element not found: ${step.selector}`)
        break
      }

      case 'assert_text': {
        if (!step.selector) throw new Error('assert_text step missing selector')
        const el = await page.waitForSelector(step.selector, { state: 'visible', timeout: STEP_TIMEOUT_MS })
        if (!el) throw new Error(`Element not found: ${step.selector}`)
        const text = await el.textContent()
        if (!text?.includes(step.value ?? '')) {
          throw new Error(`Text mismatch: expected "${step.value}" but got "${(text ?? '').slice(0, 100)}"`)
        }
        break
      }

      case 'assert_url': {
        const currentUrl = page.url()
        if (!currentUrl.includes(step.value ?? '')) {
          throw new Error(`URL mismatch: expected URL to contain "${step.value}" but current URL is "${currentUrl}"`)
        }
        break
      }

      default:
        throw new Error(`Unknown action: ${step.action}`)
    }

    const afterShot = await captureStepScreenshot(page, jobId, `flow-step-${stepIndex}-after`)

    return {
      ...base,
      status: 'passed',
      details: `Step completed successfully.`,
      screenshot_before: beforeShot ?? undefined,
      screenshot_after: afterShot ?? undefined,
    }

  } catch (err) {
    const afterShot = await captureStepScreenshot(page, jobId, `flow-step-${stepIndex}-fail`)
    return {
      ...base,
      status: 'failed',
      details: err instanceof Error ? err.message : String(err),
      screenshot_before: beforeShot ?? undefined,
      screenshot_after: afterShot ?? undefined,
    }
  }
}

// ── Claude flow parser ─────────────────────────────────────────────────────

async function parseFlowWithClaude(
  client: Anthropic,
  baseUrl: string,
  flowText: string,
): Promise<ParsedStep[]> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: `You are a test automation engineer. Convert a plain-English user flow description into a JSON array of Playwright test steps.

Rules:
- Use text-based selectors where possible (e.g. button:has-text("Login"), [aria-label="Close"])
- Prefer data-testid attributes when they exist
- Use CSS selectors only as a last resort
- assert_visible checks an element is present and visible
- assert_text checks element contains specific text
- assert_url checks current URL contains a string
- fill is for text inputs
- Maximum ${MAX_STEPS_PER_FLOW} steps
- If the flow cannot be reasonably executed (e.g. "make sure the app looks good"), return []

Return ONLY a valid JSON array, no explanation:
[{"action":"navigate|click|fill|wait|assert_visible|assert_text|assert_url|press_key","selector":"...","value":"...","description":"..."}]`,
    messages: [{
      role: 'user',
      content: `App base URL: ${baseUrl}\n\nFlow to execute: "${flowText}"`,
    }],
  })

  const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) return []

  const parsed = JSON.parse(match[0]) as ParsedStep[]
  return Array.isArray(parsed) ? parsed : []
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function captureStepScreenshot(page: Page, jobId: string, label: string): Promise<string | null> {
  try {
    const filename = `${jobId}-${label}-${Date.now()}.png`
    await page.screenshot({ path: `/tmp/${filename}`, fullPage: false, type: 'png' })
    return `screenshots/${jobId}/${filename}`
  } catch {
    return null
  }
}
