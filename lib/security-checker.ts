/**
 * Security surface scanner
 * Checks for missing security headers, HTTPS issues, exposed routes, etc.
 */

export type SecurityOptions = {
  url: string
}

export type SecurityFlag = {
  title: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  remediation: string
  evidence?: string
}

export type SecurityResults = {
  flags: SecurityFlag[]
  headers: Record<string, string | null>
  isHttps: boolean
  hasMixedContent: boolean
  exposedFiles: string[]       // Paths that returned 200 but should be private
  corsIssue: boolean           // True if CORS reflects arbitrary origins or allows wildcard
  cookieIssues: string[]       // Descriptions of insecure cookie flags
  score: number
  error?: string
}

const SECURITY_HEADERS = [
  {
    header: 'content-security-policy',
    title: 'Missing Content-Security-Policy header',
    severity: 'high' as const,
    remediation:
      'Add a Content-Security-Policy header to restrict which resources can be loaded. Start with: default-src \'self\'',
    description: 'CSP prevents cross-site scripting (XSS) attacks by controlling which resources the browser is allowed to load.',
  },
  {
    header: 'x-frame-options',
    title: 'Missing X-Frame-Options header',
    severity: 'medium' as const,
    remediation: 'Add X-Frame-Options: DENY or SAMEORIGIN to prevent clickjacking attacks.',
    description: 'Without this header, your app can be embedded in iframes on malicious sites (clickjacking).',
  },
  {
    header: 'x-content-type-options',
    title: 'Missing X-Content-Type-Options header',
    severity: 'medium' as const,
    remediation: 'Add X-Content-Type-Options: nosniff to prevent MIME-type sniffing attacks.',
    description: 'Prevents browsers from interpreting files as a different MIME type than declared.',
  },
  {
    header: 'strict-transport-security',
    title: 'Missing Strict-Transport-Security (HSTS) header',
    severity: 'high' as const,
    remediation: 'Add Strict-Transport-Security: max-age=31536000; includeSubDomains to enforce HTTPS.',
    description: 'Without HSTS, browsers may attempt HTTP connections, exposing users to downgrade attacks.',
  },
  {
    header: 'referrer-policy',
    title: 'Missing Referrer-Policy header',
    severity: 'low' as const,
    remediation: 'Add Referrer-Policy: strict-origin-when-cross-origin to control referrer information.',
    description: 'Controls how much referrer information is included with requests.',
  },
  {
    header: 'permissions-policy',
    title: 'Missing Permissions-Policy header',
    severity: 'low' as const,
    remediation: 'Add a Permissions-Policy header to control which browser features can be used.',
    description: 'Controls access to browser features like camera, microphone, and geolocation.',
  },
]

// Sensitive files that should never be publicly accessible
const EXPOSED_FILE_PATHS = [
  '/.env',
  '/.env.local',
  '/.env.production',
  '/.env.development',
  '/.git/HEAD',
  '/.git/config',
  '/wp-config.php',
  '/config.php',
  '/.DS_Store',
  '/server.js',
  '/package.json',
  '/package-lock.json',
]

export async function runSecurityChecks(options: SecurityOptions): Promise<SecurityResults> {
  const { url } = options
  const flags: SecurityFlag[] = []
  const headers: Record<string, string | null> = {}
  let isHttps = false
  let hasMixedContent = false
  const exposedFiles: string[] = []
  const cookieIssues: string[] = []
  let corsIssue = false

  try {
    const parsedUrl = new URL(url)
    isHttps = parsedUrl.protocol === 'https:'

    // Check HTTPS
    if (!isHttps) {
      flags.push({
        title: 'App is not served over HTTPS',
        description: 'Your app is accessible over HTTP, which means user data can be intercepted in transit.',
        severity: 'critical',
        remediation: 'Migrate to HTTPS immediately. Use a free certificate from Let\'s Encrypt. Most hosting platforms (Vercel, Railway, Netlify) provide HTTPS automatically.',
      })
    }

    // Fetch headers
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    })

    const responseHeaders = response.headers

    // Check all security headers
    for (const check of SECURITY_HEADERS) {
      const value = responseHeaders.get(check.header)
      headers[check.header] = value

      if (!value) {
        flags.push({
          title: check.title,
          description: check.description,
          severity: check.severity,
          remediation: check.remediation,
        })
      }
    }

    // Check for server header disclosure
    const serverHeader = responseHeaders.get('server')
    if (serverHeader && /[0-9]/.test(serverHeader)) {
      flags.push({
        title: 'Server version disclosure via Server header',
        description: `The Server header reveals: "${serverHeader}". Attackers use version info to target known vulnerabilities.`,
        severity: 'low',
        remediation: 'Configure your web server to suppress or genericize the Server header.',
        evidence: serverHeader,
      })
    }

    // Check for X-Powered-By disclosure
    const poweredBy = responseHeaders.get('x-powered-by')
    if (poweredBy) {
      flags.push({
        title: 'Technology stack disclosed via X-Powered-By header',
        description: `X-Powered-By: ${poweredBy} reveals your tech stack to attackers.`,
        severity: 'low',
        remediation: 'Disable or remove the X-Powered-By header in your framework settings.',
        evidence: poweredBy,
      })
    }

    // Check for mixed content (fetch page content)
    if (isHttps) {
      try {
        const pageResponse = await fetch(url, {
          signal: AbortSignal.timeout(10000),
        })
        const html = await pageResponse.text()
        const mixedContentPatterns = [
          /src="http:\/\//gi,
          /href="http:\/\//gi,
          /url\(http:\/\//gi,
        ]
        hasMixedContent = mixedContentPatterns.some((p) => p.test(html))

        if (hasMixedContent) {
          flags.push({
            title: 'Mixed content detected',
            description: 'The page loads some resources over HTTP even though it is served over HTTPS.',
            severity: 'high',
            remediation: 'Update all resource URLs to use HTTPS or protocol-relative URLs (//example.com/...).',
          })
        }

        // Check for sensitive data in page source
        const sensitivePatterns = [
          { pattern: /api[_-]?key\s*[:=]\s*['"]([^'"]{10,})['"]/gi, label: 'API key' },
          { pattern: /secret\s*[:=]\s*['"]([^'"]{10,})['"]/gi, label: 'Secret value' },
          { pattern: /password\s*[:=]\s*['"]([^'"]{6,})['"]/gi, label: 'Password' },
          { pattern: /private[_-]?key\s*[:=]\s*['"]([^'"]{10,})['"]/gi, label: 'Private key' },
        ]

        for (const { pattern, label } of sensitivePatterns) {
          if (pattern.test(html)) {
            flags.push({
              title: `Potential ${label} exposed in page source`,
              description: `A pattern matching a ${label} was found in the page HTML. This could be a critical security leak.`,
              severity: 'critical',
              remediation: 'Move all sensitive values to server-side environment variables. Never embed API keys or secrets in client-side HTML or JavaScript.',
            })
          }
        }
      } catch {
        // Non-fatal
      }
    }

    // ── Exposed sensitive files ─────────────────────────────────────
    const origin = new URL(url).origin
    await checkExposedFiles(origin, flags, exposedFiles)

    // ── Cookie security flags ───────────────────────────────────────
    await checkCookieFlags(url, flags, cookieIssues)

    // ── CORS misconfiguration ───────────────────────────────────────
    const corsFlag = await checkCors(url)
    if (corsFlag) {
      flags.push(corsFlag)
      corsIssue = true
    }

    // ── Source map exposure ─────────────────────────────────────────
    if (isHttps) {
      try {
        const pageRes = await fetch(url, { signal: AbortSignal.timeout(8000) })
        const pageHtml = await pageRes.text()
        // Find first JS bundle URL from the HTML
        const scriptMatch = pageHtml.match(/src=["']([^"']+\.js)["']/i)
        if (scriptMatch) {
          const scriptUrl = scriptMatch[1].startsWith('http')
            ? scriptMatch[1]
            : `${origin}${scriptMatch[1].startsWith('/') ? '' : '/'}${scriptMatch[1]}`
          const mapUrl = `${scriptUrl}.map`
          const mapRes = await fetch(mapUrl, {
            method: 'HEAD',
            signal: AbortSignal.timeout(5000),
          })
          if (mapRes.ok) {
            flags.push({
              title: 'Source map file publicly accessible',
              description: `${mapUrl} is reachable. Source maps expose your original unminified source code to anyone who visits the site.`,
              severity: 'medium',
              remediation: 'Set your bundler to not emit source maps in production, or restrict access to .map files at the CDN/server level.',
              evidence: mapUrl,
            })
          }
        }
      } catch { /* non-fatal */ }
    }

    // Score calculation: start at 100, deduct for each flag
    const deductions = {
      critical: 25,
      high: 15,
      medium: 8,
      low: 3,
    }
    const score = Math.max(
      0,
      100 - flags.reduce((sum, f) => sum + (deductions[f.severity] || 0), 0)
    )

    return { flags, headers, isHttps, hasMixedContent, exposedFiles, cookieIssues, corsIssue, score }
  } catch (err) {
    return {
      flags,
      headers,
      isHttps,
      hasMixedContent,
      exposedFiles,
      cookieIssues,
      corsIssue,
      score: 0,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ─── Exposed file check ────────────────────────────────────────────────────

async function checkExposedFiles(
  origin: string,
  flags: SecurityFlag[],
  exposedFiles: string[],
): Promise<void> {
  const results = await Promise.allSettled(
    EXPOSED_FILE_PATHS.map(async (path) => {
      const res = await fetch(`${origin}${path}`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
        redirect: 'follow',
      })
      // 200 on a sensitive path = exposed. Ignore 3xx/4xx/5xx.
      if (res.ok) {
        const text = await res.text().catch(() => '')
        // Sanity check: .env files contain KEY=VALUE patterns, git HEAD contains "ref:"
        const looksReal =
          path.includes('.env')    ? /[A-Z_]+=/.test(text) :
          path.includes('.git')    ? text.includes('ref:') || text.length < 500 :
          path.includes('config')  ? text.length > 20 :
          text.length > 0
        if (looksReal) return path
      }
      return null
    })
  )

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      const p = result.value
      exposedFiles.push(p)

      const isGit = p.includes('.git')
      const isEnv = p.includes('.env')

      flags.push({
        title: `Sensitive file exposed: ${p}`,
        description: isGit
          ? 'Your .git directory is publicly accessible. Attackers can reconstruct your entire source code, history, and any secrets ever committed.'
          : isEnv
          ? 'Your .env file is publicly accessible. This exposes API keys, database credentials, and other secrets.'
          : `The file ${p} is publicly accessible and may contain sensitive configuration or source code.`,
        severity: isGit || isEnv ? 'critical' : 'high',
        remediation: isGit
          ? 'Block access to /.git/ at your web server or CDN. For Vercel/Netlify this is automatic. For Nginx: "location ~ /\\.git { deny all; }"'
          : isEnv
          ? 'Remove .env from your web root. Never deploy .env files — use environment variable settings in your hosting platform instead.'
          : `Restrict public access to ${p} via your server/CDN configuration.`,
        evidence: p,
      })
    }
  }
}

// ─── Cookie security flags ────────────────────────────────────────────────

async function checkCookieFlags(
  url: string,
  flags: SecurityFlag[],
  cookieIssues: string[],
): Promise<void> {
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    })

    const setCookieHeaders = res.headers.getSetCookie?.() ?? []
    if (setCookieHeaders.length === 0) return

    const missingHttpOnly: string[] = []
    const missingSecure: string[] = []
    const missingSameSite: string[] = []

    for (const cookie of setCookieHeaders) {
      // Extract cookie name (first segment before '=')
      const name = cookie.split('=')[0].trim()
      const lower = cookie.toLowerCase()

      if (!lower.includes('httponly')) missingHttpOnly.push(name)
      if (!lower.includes('secure'))   missingSecure.push(name)
      if (!lower.includes('samesite')) missingSameSite.push(name)
    }

    if (missingHttpOnly.length > 0) {
      const desc = `Cookie(s) missing HttpOnly flag: ${missingHttpOnly.slice(0, 3).join(', ')}. Without HttpOnly, client-side JavaScript can read these cookies — a successful XSS attack can steal session tokens.`
      cookieIssues.push(desc)
      flags.push({
        title: 'Session cookies missing HttpOnly flag',
        description: desc,
        severity: 'high',
        remediation: 'Set the HttpOnly flag on all session and auth cookies. In Express: res.cookie("name", val, { httpOnly: true }). In Next.js: use { httpOnly: true } in cookie options.',
        evidence: missingHttpOnly.slice(0, 3).join(', '),
      })
    }

    if (missingSecure.length > 0) {
      const desc = `Cookie(s) missing Secure flag: ${missingSecure.slice(0, 3).join(', ')}. These cookies can be transmitted over HTTP, exposing them to network interception.`
      cookieIssues.push(desc)
      flags.push({
        title: 'Cookies missing Secure flag',
        description: desc,
        severity: 'high',
        remediation: 'Add the Secure flag to all cookies. This ensures they are only sent over HTTPS connections.',
        evidence: missingSecure.slice(0, 3).join(', '),
      })
    }

    if (missingSameSite.length > 0) {
      const desc = `Cookie(s) missing SameSite attribute: ${missingSameSite.slice(0, 3).join(', ')}. Without SameSite, cookies are sent on cross-site requests, enabling CSRF attacks.`
      cookieIssues.push(desc)
      flags.push({
        title: 'Cookies missing SameSite attribute',
        description: desc,
        severity: 'medium',
        remediation: 'Add SameSite=Lax (default safe) or SameSite=Strict to all cookies. Avoid SameSite=None unless you explicitly need cross-site cookie sharing (and pair it with Secure).',
        evidence: missingSameSite.slice(0, 3).join(', '),
      })
    }
  } catch { /* non-fatal */ }
}

// ─── CORS misconfiguration ────────────────────────────────────────────────

async function checkCors(url: string): Promise<SecurityFlag | null> {
  const ATTACKER_ORIGIN = 'https://evil-attacker-test.com'

  try {
    // OPTIONS preflight with a spoofed origin
    const res = await fetch(url, {
      method: 'OPTIONS',
      headers: {
        Origin: ATTACKER_ORIGIN,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'Authorization',
      },
      signal: AbortSignal.timeout(8000),
    })

    const acao = res.headers.get('access-control-allow-origin')
    const acac = res.headers.get('access-control-allow-credentials')

    if (!acao) return null

    // Wildcard with credentials is spec-invalid but some servers do it
    if (acao === '*' && acac === 'true') {
      return {
        title: 'CORS: wildcard origin with credentials (spec-invalid, dangerous)',
        description: 'The server returns Access-Control-Allow-Origin: * combined with Access-Control-Allow-Credentials: true. Browsers block this per spec, but some non-browser clients honour it, potentially exposing authenticated data.',
        severity: 'high',
        remediation: 'Never combine Allow-Origin: * with Allow-Credentials: true. Use an explicit origin allowlist with credentials.',
        evidence: `ACAO: ${acao}, ACAC: ${acac}`,
      }
    }

    // Reflects the attacker origin back verbatim
    if (acao === ATTACKER_ORIGIN) {
      if (acac === 'true') {
        return {
          title: 'CORS: server reflects arbitrary origins with credentials allowed',
          description: 'The server echoes back any Origin header and also sets Access-Control-Allow-Credentials: true. This allows any website to make authenticated requests on behalf of your users.',
          severity: 'critical',
          remediation: 'Replace dynamic origin reflection with an explicit allowlist. Validate inbound Origin headers against a known-good list before echoing them back.',
          evidence: `ACAO: ${acao}, ACAC: ${acac}`,
        }
      }
      return {
        title: 'CORS: server reflects arbitrary origins (no credentials)',
        description: 'The server echoes back any Origin header. Without credentials this does not allow reading authenticated data, but it permits cross-origin reads of unauthenticated responses.',
        severity: 'medium',
        remediation: 'Use an explicit origin allowlist rather than reflecting the inbound Origin header. E.g.: const allowed = ["https://yourdomain.com"]; if (allowed.includes(origin)) res.setHeader("Access-Control-Allow-Origin", origin)',
        evidence: `ACAO: ${acao}`,
      }
    }
  } catch { /* non-fatal */ }

  return null
}
