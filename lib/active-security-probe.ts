/**
 * Active security probing
 *
 * Goes beyond header checks into observable application behaviour:
 *   1. Error leakage — do 404/500 responses expose stack traces or server info?
 *   2. Unauthenticated API probing — do common API paths return data without auth?
 *   3. XSS surface — do forms reflect unsanitized input back into the page?
 *
 * All probes are safe and non-destructive. No actual exploits are sent.
 * The XSS probe uses a unique token string (not a script tag) and checks
 * whether it appears unencoded in the response — a reflection signal only.
 */

export type ErrorLeakageResult = {
  probe_url: string
  status: number
  leaks_stack_trace: boolean
  leaks_server_info: boolean
  server_header?: string
  x_powered_by?: string
  snippet?: string   // First 300 chars of body if leakage detected
}

export type ApiProbeResult = {
  url: string
  status: number
  returns_data: boolean   // 200 with non-empty JSON body
  auth_required: boolean  // 401 or 403
  note?: string
}

export type XssProbeResult = {
  form_url: string
  forms_found: number
  probe_sent: boolean
  reflected: boolean           // Raw unescaped <> chars in response → real risk
  encoded_reflection: boolean  // Token present but HTML-encoded → framework handling correctly
  note?: string
}

export type ActiveSecurityResults = {
  error_leakage: ErrorLeakageResult[]
  api_probes: ApiProbeResult[]
  xss_surface: XssProbeResult
  flags: ActiveSecurityFlag[]
  score: number
  error?: string
}

export type ActiveSecurityFlag = {
  title: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  remediation: string
  evidence?: string
  is_informational?: boolean  // True = note only, does not affect score
}

// ── Common API paths to probe ────────────────────────────────────────────────

const API_PATHS = [
  '/api/users', '/api/user', '/api/me', '/api/profile', '/api/account',
  '/api/admin', '/api/config', '/api/settings', '/api/data',
  '/api/v1/users', '/api/v1/user', '/api/v1/me',
]

// ── Stack trace / server info fingerprints ───────────────────────────────────

const STACK_TRACE_PATTERNS = [
  'at Object.', 'at Function.', 'at Module.', 'at eval (', 'at new ',
  'Error: ', 'TypeError: ', 'ReferenceError: ', 'SyntaxError: ',
  'Traceback (most recent call last)', 'File "/', 'line \\d+, in ',
  'exception message:', 'stack trace:', 'java.lang.', 'org.springframework.',
  'System.Web.', 'Microsoft.AspNet', 'ActiveRecord::',
]

const SERVER_INFO_PATTERNS = [
  'apache/', 'nginx/', 'iis/', 'express', 'php/', 'django', 'rails',
  'laravel', 'wordpress', 'drupal', 'joomla', 'tomcat', 'jetty',
  'werkzeug', 'flask', 'gunicorn', 'uvicorn',
]

// ─── Main export ──────────────────────────────────────────────────────────────

export async function runActiveSecurityProbe(options: {
  url: string
  depth: 'quick' | 'standard' | 'deep'
}): Promise<ActiveSecurityResults> {
  const { url, depth } = options
  const base = new URL(url).origin

  const flags: ActiveSecurityFlag[] = []

  // ── 1. Error leakage probes ──────────────────────────────────────────────────
  const errorProbeUrls = [
    `${base}/this-page-does-not-exist-caniship-probe-${Date.now()}`,
    `${base}/api/this-endpoint-does-not-exist-probe`,
  ]

  const errorLeakage: ErrorLeakageResult[] = []

  for (const probeUrl of errorProbeUrls) {
    try {
      const res = await fetch(probeUrl, {
        headers: { 'User-Agent': 'CanIShip-Audit/1.0 (security-probe)' },
        signal: AbortSignal.timeout(10000),
      })

      const body = await res.text()
      const bodyLower = body.toLowerCase()
      const serverHeader = res.headers.get('server') || undefined
      const xPoweredBy  = res.headers.get('x-powered-by') || undefined

      const leaksStackTrace = STACK_TRACE_PATTERNS.some(p => {
        try { return new RegExp(p, 'i').test(body) } catch { return body.toLowerCase().includes(p.toLowerCase()) }
      })
      const leaksServerInfo = SERVER_INFO_PATTERNS.some(p => bodyLower.includes(p))
        || !!(serverHeader && SERVER_INFO_PATTERNS.some(p => serverHeader.toLowerCase().includes(p)))
        || !!(xPoweredBy)

      errorLeakage.push({
        probe_url: probeUrl,
        status: res.status,
        leaks_stack_trace: leaksStackTrace,
        leaks_server_info: leaksServerInfo,
        server_header: serverHeader,
        x_powered_by: xPoweredBy,
        snippet: (leaksStackTrace || leaksServerInfo) ? body.slice(0, 300) : undefined,
      })
    } catch {
      // Network error — skip this probe
    }
  }

  const stackLeaks = errorLeakage.filter(r => r.leaks_stack_trace)
  const serverLeaks = errorLeakage.filter(r => r.leaks_server_info)

  if (stackLeaks.length > 0) {
    flags.push({
      title: 'Error responses expose stack traces',
      description: `${stackLeaks.length} error response(s) contain what appears to be a server-side stack trace. This reveals internal file paths, library versions, and code structure to attackers.`,
      severity: 'high',
      remediation: 'Configure your framework/server to return generic error pages in production. Never expose stack traces to end users. Use structured logging to your server logs instead.',
      evidence: stackLeaks[0].snippet?.slice(0, 200),
    })
  }

  if (serverLeaks.length > 0) {
    const evidence = [
      serverLeaks[0].server_header ? `Server: ${serverLeaks[0].server_header}` : '',
      serverLeaks[0].x_powered_by  ? `X-Powered-By: ${serverLeaks[0].x_powered_by}` : '',
    ].filter(Boolean).join(' | ')
    flags.push({
      title: 'Server technology disclosed in response headers or body',
      description: `Response headers or error body reveal server/framework information (${evidence}). This aids attackers in targeting known vulnerabilities for those specific versions.`,
      severity: 'medium',
      remediation: 'Remove or obfuscate the Server and X-Powered-By headers. For Next.js: add `poweredByHeader: false` in next.config.js. For nginx: set `server_tokens off`. For Apache: set `ServerTokens Prod`.',
      evidence,
    })
  }

  // ── 2. Unauthenticated API probing ──────────────────────────────────────────
  const apiProbes: ApiProbeResult[] = []

  // Only probe on standard/deep — avoid rate-limiting on quick scans
  if (depth !== 'quick') {
    const pathsToProbe = API_PATHS.slice(0, depth === 'deep' ? 10 : 5)

    for (const path of pathsToProbe) {
      try {
        const res = await fetch(`${base}${path}`, {
          headers: {
            'User-Agent': 'CanIShip-Audit/1.0 (api-probe)',
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(8000),
        })

        let returnsData = false
        if (res.status === 200) {
          const contentType = res.headers.get('content-type') || ''
          if (contentType.includes('json')) {
            const body = await res.text()
            returnsData = body.trim().length > 10 && (body.trim().startsWith('{') || body.trim().startsWith('['))
          }
        }

        apiProbes.push({
          url: `${base}${path}`,
          status: res.status,
          returns_data: returnsData,
          auth_required: res.status === 401 || res.status === 403,
        })
      } catch {
        // Endpoint doesn't exist or network error — expected, skip
      }
    }

    const unauthDataEndpoints = apiProbes.filter(p => p.returns_data)
    if (unauthDataEndpoints.length > 0) {
      flags.push({
        title: 'API endpoints returning data without authentication',
        description: `${unauthDataEndpoints.length} API endpoint(s) returned JSON data without requiring authentication: ${unauthDataEndpoints.map(p => p.url).join(', ')}. This may expose user data or internal state.`,
        severity: 'critical',
        remediation: 'Verify each endpoint requires authentication. Add middleware that checks for a valid session/token before returning any data. Use 401 (unauthenticated) or 403 (forbidden) for protected routes.',
        evidence: unauthDataEndpoints.map(p => `${p.url} → HTTP ${p.status}`).join('\n'),
      })
    }
  }

  // ── 3. XSS surface — form reflection check ──────────────────────────────────
  // Injects a token containing HTML-special characters (<>) and checks whether
  // they appear RAW (real vulnerability) or HTML-encoded (framework handling
  // correctly → informational note only, no score penalty).
  const xssProbe = await runXssSurfaceCheck(base, url)
  if (xssProbe.reflected) {
    // Raw <> chars appeared in response — genuine reflection risk
    flags.push({
      title: 'Reflected XSS: user input reflected without HTML encoding',
      description: `A test token containing HTML-special characters (<>) was injected via query parameter and appeared unescaped in the page response. An attacker could craft a URL that injects arbitrary HTML or JavaScript into the page for any visitor who clicks it.`,
      severity: 'high',
      remediation: 'HTML-encode all user-controlled values before writing them into the page. In React/Next.js use JSX expressions (never dangerouslySetInnerHTML with user input). In template engines use auto-escaping. In raw HTML output call htmlspecialchars() or equivalent.',
    })
  } else if (xssProbe.encoded_reflection) {
    // Token appeared but HTML-encoded — framework is doing its job
    flags.push({
      title: 'URL parameters reflected in page (properly encoded — informational)',
      description: `Query parameters are reflected into the page HTML, but the framework is correctly HTML-encoding them (e.g. < → &lt;). This is not exploitable as-is. Verify no code paths use dangerouslySetInnerHTML or equivalent with these values.`,
      severity: 'low',
      remediation: 'No immediate action required. Continue to avoid dangerouslySetInnerHTML with user-supplied data. Add a Content Security Policy to provide defence-in-depth.',
      is_informational: true,
    })
  }

  // ── Score — informational notes do not affect the score ──────────────────
  let score = 100
  for (const flag of flags) {
    if (flag.is_informational) continue   // notes only, no penalty
    if (flag.severity === 'critical') score -= 35
    else if (flag.severity === 'high')   score -= 20
    else if (flag.severity === 'medium') score -= 10
    else                                 score -= 5
  }
  score = Math.max(0, score)

  return { error_leakage: errorLeakage, api_probes: apiProbes, xss_surface: xssProbe, flags, score }
}

// ── XSS surface: reflect test using an HTML-special-character token ───────────
//
// The key insight: a plain alphanumeric token reflects the same way in both
// safe and unsafe apps (there is nothing to encode), so it always produces
// false positives. Instead we use a token that CONTAINS < and >, then check:
//
//   body contains raw token (with literal < >)  → real, unescaped reflection
//   body contains HTML-encoded version (&lt; &gt;) → framework encoded it → safe
//   neither                                      → not reflected at all
//
async function runXssSurfaceCheck(base: string, url: string): Promise<XssProbeResult> {
  // Unique base — alphanumeric only so we can search for it regardless of encoding
  const id = Math.random().toString(36).slice(2, 10)
  const base64Token  = `canishipprobe${id}`          // no special chars
  const xssToken     = `${base64Token}<csp>`          // with HTML-special chars
  const encodedToken = `${base64Token}&lt;csp&gt;`    // what a safe framework emits

  try {
    const testUrl = `${url}${url.includes('?') ? '&' : '?'}q=${encodeURIComponent(xssToken)}&search=${encodeURIComponent(xssToken)}&error=${encodeURIComponent(xssToken)}`

    const res = await fetch(testUrl, {
      headers: { 'User-Agent': 'CanIShip-Audit/1.0 (xss-surface)' },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      return { form_url: testUrl, forms_found: 0, probe_sent: true, reflected: false, encoded_reflection: false }
    }

    const body = await res.text()

    // Raw reflection: literal < > chars in response → genuine risk
    const rawReflected = body.includes(xssToken)

    // Encoded reflection: framework escaped < to &lt; → handled correctly
    const encodedReflected = !rawReflected && (
      body.includes(encodedToken) ||
      body.includes(`${base64Token}&#60;`) ||   // decimal entity variant
      body.includes(`${base64Token}\\u003c`)     // JS unicode escape variant
    )

    const note = rawReflected
      ? 'Raw HTML characters reflected unescaped — genuine XSS risk'
      : encodedReflected
        ? 'Reflected but HTML-encoded by framework — informational only'
        : undefined

    return {
      form_url: testUrl,
      forms_found: (body.match(/<form/gi) || []).length,
      probe_sent: true,
      reflected: rawReflected,
      encoded_reflection: encodedReflected,
      note,
    }
  } catch (err) {
    return {
      form_url: url,
      forms_found: 0,
      probe_sent: false,
      reflected: false,
      encoded_reflection: false,
      note: err instanceof Error ? err.message : 'Probe failed',
    }
  }
}
