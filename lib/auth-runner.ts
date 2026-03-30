/**
 * Auth Runner — executes a login flow or injects cookies before an audit.
 *
 * Used when the user provides auth_config on an audit job so CanIShip can
 * reach pages behind a login wall.
 *
 * SECURITY NOTES:
 * - Only test/staging credentials should ever be supplied.
 * - auth_config is cleared from the DB before this module runs.
 * - Cookie values are never logged.
 */

import type { Page, BrowserContext } from 'playwright'
import type { AuthConfig } from './supabase'

export type AuthResult = {
  success: boolean
  method: 'form' | 'cookie' | 'none'
  error?: string
  loggedInUrl?: string
}

/**
 * Applies auth to an existing Playwright context.
 * For cookie auth: injects cookies directly into the context.
 * For form auth: navigates to the login page and fills credentials.
 *
 * Returns success/failure — callers should still audit if auth fails
 * (report the auth failure as a finding, don't abort the whole job).
 */
export async function applyAuth(
  context: BrowserContext,
  page: Page,
  baseUrl: string,
  config: AuthConfig,
): Promise<AuthResult> {
  if (config.type === 'cookie') {
    return applyCookieAuth(context, config)
  }
  return applyFormAuth(page, baseUrl, config)
}

// ── Cookie auth ────────────────────────────────────────────────────────────

async function applyCookieAuth(
  context: BrowserContext,
  config: Extract<AuthConfig, { type: 'cookie' }>,
): Promise<AuthResult> {
  try {
    await context.addCookies(
      config.cookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path ?? '/',
        httpOnly: c.httpOnly ?? false,
        secure: c.secure ?? true,
        sameSite: 'Lax' as const,
      }))
    )
    return { success: true, method: 'cookie' }
  } catch (err) {
    return {
      success: false,
      method: 'cookie',
      error: `Failed to inject cookies: ${err instanceof Error ? err.message : String(err)}`,
    }
  }
}

// ── Form auth ──────────────────────────────────────────────────────────────

async function applyFormAuth(
  page: Page,
  baseUrl: string,
  config: Extract<AuthConfig, { type: 'form' }>,
): Promise<AuthResult> {
  const loginUrl = config.login_url
    ? resolveUrl(baseUrl, config.login_url)
    : resolveUrl(baseUrl, '/login')

  try {
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })
  } catch (err) {
    return {
      success: false,
      method: 'form',
      error: `Could not load login page ${loginUrl}: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  // ── Locate email field ────────────────────────────────────────────────────
  const emailSelector = config.email_selector ?? await detectEmailSelector(page)
  if (!emailSelector) {
    return {
      success: false,
      method: 'form',
      error: `Could not find email/username input on ${loginUrl}. Provide email_selector in auth_config.`,
    }
  }

  // ── Locate password field ─────────────────────────────────────────────────
  const passwordSelector = config.password_selector ?? 'input[type="password"]'

  const passwordExists = await page.$(passwordSelector)
  if (!passwordExists) {
    return {
      success: false,
      method: 'form',
      error: `Could not find password input on ${loginUrl}. Provide password_selector in auth_config.`,
    }
  }

  // ── Fill and submit ───────────────────────────────────────────────────────
  try {
    await page.fill(emailSelector, config.email, { timeout: 5000 })
    await page.fill(passwordSelector, config.password, { timeout: 5000 })
  } catch (err) {
    return {
      success: false,
      method: 'form',
      error: `Failed to fill login form: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  const submitSelector = config.submit_selector ?? await detectSubmitSelector(page)
  if (!submitSelector) {
    return {
      success: false,
      method: 'form',
      error: `Could not find submit button on ${loginUrl}. Provide submit_selector in auth_config.`,
    }
  }

  try {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
      page.click(submitSelector),
    ])
  } catch {
    // waitForNavigation may time out on SPA apps that don't navigate — that is OK
    await page.waitForTimeout(2000)
  }

  const currentUrl = page.url()

  // ── Verify login succeeded ────────────────────────────────────────────────
  if (config.success_url_pattern && currentUrl.includes(config.success_url_pattern)) {
    return { success: true, method: 'form', loggedInUrl: currentUrl }
  }

  if (config.success_selector) {
    const el = await page.$(config.success_selector)
    if (el) return { success: true, method: 'form', loggedInUrl: currentUrl }
    return {
      success: false,
      method: 'form',
      error: `Login appeared to complete but success_selector "${config.success_selector}" was not found. Check credentials.`,
    }
  }

  // Heuristic: if we left the login URL and didn't land on an error page, assume success
  const stillOnLoginPage = currentUrl.includes('login') || currentUrl.includes('signin')
  const pageText = await page.evaluate(() => document.body.innerText.toLowerCase())
  const hasErrorText =
    pageText.includes('invalid') ||
    pageText.includes('incorrect') ||
    pageText.includes('wrong password') ||
    pageText.includes('login failed')

  if (hasErrorText) {
    return {
      success: false,
      method: 'form',
      error: 'Login failed — error message detected on page. Check test credentials.',
    }
  }

  if (stillOnLoginPage) {
    return {
      success: false,
      method: 'form',
      error: 'Login may have failed — still on login URL after submit. Provide success_url_pattern or success_selector to confirm.',
    }
  }

  return { success: true, method: 'form', loggedInUrl: currentUrl }
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function detectEmailSelector(page: Page): Promise<string | null> {
  const candidates = [
    'input[type="email"]',
    'input[name="email"]',
    'input[name="username"]',
    'input[name="user"]',
    'input[autocomplete="email"]',
    'input[autocomplete="username"]',
    'input[placeholder*="email" i]',
    'input[placeholder*="username" i]',
  ]
  for (const sel of candidates) {
    const el = await page.$(sel)
    if (el) return sel
  }
  return null
}

async function detectSubmitSelector(page: Page): Promise<string | null> {
  const candidates = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Log in")',
    'button:has-text("Sign in")',
    'button:has-text("Login")",',
    'button:has-text("Continue")',
    '[data-testid*="login"]',
    '[data-testid*="submit"]',
  ]
  for (const sel of candidates) {
    try {
      const el = await page.$(sel)
      if (el) return sel
    } catch { /* invalid selector for this page — skip */ }
  }
  return null
}

function resolveUrl(base: string, path: string): string {
  try {
    return new URL(path, base).href
  } catch {
    return base
  }
}
