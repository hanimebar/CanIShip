/**
 * Auth hardening checker
 *
 * Detects two common auth enumeration vulnerabilities:
 *
 *   1. Password reset email enumeration
 *      POST to common reset endpoints with a real-looking vs obviously-fake email.
 *      If the response messages differ, the app reveals whether an email is registered.
 *
 *   2. Login failure enumeration
 *      POST to common login endpoints with different emails.
 *      If error messages differ ("wrong password" vs "email not found"), enumeration is possible.
 *
 * Only probes standard/deep audits. Uses innocuous email addresses.
 * Non-destructive — no accounts are modified.
 */

export type EnumerationResult = {
  endpoint_found: boolean
  endpoint?: string
  method?: string
  enumeration_risk: 'safe' | 'leaks' | 'unknown'
  evidence?: string   // The differing response excerpt
  response_a?: string
  response_b?: string
}

export type AuthHardeningResults = {
  password_reset: EnumerationResult
  login_failure: EnumerationResult
  flags: AuthHardeningFlag[]
  score: number
  error?: string
}

export type AuthHardeningFlag = {
  title: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  remediation: string
}

// ── Common reset/login endpoint paths ────────────────────────────────────────

const RESET_PATHS = [
  '/api/auth/forgot-password', '/api/auth/reset-password', '/api/auth/forgot',
  '/api/forgot-password', '/api/reset-password', '/api/password-reset',
  '/auth/forgot', '/auth/reset', '/forgot-password', '/reset-password',
  '/api/users/forgot-password', '/api/v1/auth/forgot-password',
  '/api/account/password-reset',
]

const LOGIN_PATHS = [
  '/api/auth/login', '/api/auth/signin', '/api/login', '/api/signin',
  '/auth/login', '/auth/signin', '/login', '/signin',
  '/api/v1/auth/login', '/api/users/login',
]

// Test emails — obviously fake, but structurally valid
const EMAIL_A = `test-user-caniship@example.com`           // Plausibly real format
const EMAIL_B = `notreal-xyzabc123caniship@no-such-domain-xyz.invalid` // Clearly not registered

// ─── Main export ──────────────────────────────────────────────────────────────

export async function runAuthHardeningChecks(options: {
  url: string
  depth: 'quick' | 'standard' | 'deep'
}): Promise<AuthHardeningResults> {
  const { url, depth } = options

  const empty: AuthHardeningResults = {
    password_reset: { endpoint_found: false, enumeration_risk: 'unknown' },
    login_failure:  { endpoint_found: false, enumeration_risk: 'unknown' },
    flags: [],
    score: 100,
  }

  // Skip on quick — too invasive for a surface scan
  if (depth === 'quick') return empty

  const base = new URL(url).origin
  const flags: AuthHardeningFlag[] = []

  const [resetResult, loginResult] = await Promise.all([
    probeEndpoints(base, RESET_PATHS, EMAIL_A, EMAIL_B, 'email'),
    probeEndpoints(base, LOGIN_PATHS,  EMAIL_A, EMAIL_B, 'email'),
  ])

  if (resetResult.endpoint_found && resetResult.enumeration_risk === 'leaks') {
    flags.push({
      title: 'Password reset reveals whether email is registered',
      description: `The password reset endpoint at ${resetResult.endpoint} returns different responses for registered vs unregistered email addresses. An attacker can enumerate valid accounts by probing this endpoint.`,
      severity: 'medium',
      remediation: 'Always return the same response regardless of whether the email exists: "If an account with that email exists, you will receive a reset link." Never reveal account existence. Apply rate limiting (e.g. 5 attempts/hour per IP) and consider CAPTCHA.',
    })
  }

  if (loginResult.endpoint_found && loginResult.enumeration_risk === 'leaks') {
    flags.push({
      title: 'Login endpoint reveals whether email is registered',
      description: `The login endpoint at ${loginResult.endpoint} returns different error messages for unknown vs known email addresses. This allows an attacker to enumerate valid accounts at scale.`,
      severity: 'medium',
      remediation: 'Return a generic error message for all failed login attempts: "Invalid email or password." Never distinguish between "email not found" and "wrong password." Implement rate limiting and account lockout policies.',
    })
  }

  let score = 100
  for (const flag of flags) {
    if (flag.severity === 'critical') score -= 30
    else if (flag.severity === 'high')   score -= 20
    else if (flag.severity === 'medium') score -= 15
    else                                 score -= 5
  }
  score = Math.max(0, score)

  return {
    password_reset: resetResult,
    login_failure:  loginResult,
    flags,
    score,
  }
}

// ── Probe helper: find endpoint and compare responses ─────────────────────────

async function probeEndpoints(
  base: string,
  paths: string[],
  emailA: string,
  emailB: string,
  emailField: string,
): Promise<EnumerationResult> {
  for (const path of paths) {
    const endpoint = `${base}${path}`

    try {
      // First — a HEAD/OPTIONS probe to see if endpoint exists
      const headRes = await fetch(endpoint, {
        method: 'OPTIONS',
        headers: { 'User-Agent': 'CanIShip-Audit/1.0 (auth-hardening)' },
        signal: AbortSignal.timeout(6000),
      })

      // Skip if clearly not a valid endpoint
      if (headRes.status === 404 || headRes.status === 405 && !headRes.headers.get('allow')) {
        // 405 is fine (method not allowed) — endpoint exists but doesn't accept OPTIONS
        if (headRes.status === 404) continue
      }

      // Now send two POST requests
      const [resA, resB] = await Promise.all([
        postEmail(endpoint, emailField, emailA),
        postEmail(endpoint, emailField, emailB),
      ])

      if (!resA || !resB) continue

      // Compare status codes and body similarity
      const statusDiffers = resA.status !== resB.status
      const bodyA = resA.body.toLowerCase()
      const bodyB = resB.body.toLowerCase()

      // Check for tell-tale enumeration phrases
      const aHasEmailNotFound = bodyA.includes('email not found') || bodyA.includes('no account') ||
        bodyA.includes('not registered') || bodyA.includes('user not found') ||
        bodyA.includes('email does not exist') || bodyA.includes('account not found')
      const bHasEmailNotFound = bodyB.includes('email not found') || bodyB.includes('no account') ||
        bodyB.includes('not registered') || bodyB.includes('user not found') ||
        bodyB.includes('email does not exist') || bodyB.includes('account not found')

      const aHasWrongPassword = bodyA.includes('invalid password') || bodyA.includes('wrong password') ||
        bodyA.includes('incorrect password') || bodyA.includes('password is incorrect')

      // Enumeration: if one mentions "email not found" and the other mentions "wrong password"
      // or if the status codes differ meaningfully
      const enumerates = (aHasEmailNotFound !== bHasEmailNotFound) ||
        (aHasWrongPassword && bHasEmailNotFound) ||
        (statusDiffers && Math.abs(resA.status - resB.status) > 0)

      return {
        endpoint_found: true,
        endpoint,
        method: 'POST',
        enumeration_risk: enumerates ? 'leaks' : 'safe',
        response_a: resA.body.slice(0, 200),
        response_b: resB.body.slice(0, 200),
        evidence: enumerates
          ? `Email A (${emailA}) → HTTP ${resA.status}: "${resA.body.slice(0, 100)}" | Email B (${emailB}) → HTTP ${resB.status}: "${resB.body.slice(0, 100)}"`
          : undefined,
      }
    } catch {
      continue
    }
  }

  return { endpoint_found: false, enumeration_risk: 'unknown' }
}

async function postEmail(
  url: string,
  emailField: string,
  email: string,
): Promise<{ status: number; body: string } | null> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CanIShip-Audit/1.0 (auth-hardening)',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ [emailField]: email }),
      signal: AbortSignal.timeout(8000),
    })
    const body = await res.text()
    return { status: res.status, body }
  } catch {
    return null
  }
}
