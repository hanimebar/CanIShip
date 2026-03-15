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

export async function runSecurityChecks(options: SecurityOptions): Promise<SecurityResults> {
  const { url } = options
  const flags: SecurityFlag[] = []
  const headers: Record<string, string | null> = {}
  let isHttps = false
  let hasMixedContent = false

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

    return { flags, headers, isHttps, hasMixedContent, score }
  } catch (err) {
    return {
      flags,
      headers,
      isHttps,
      hasMixedContent,
      score: 0,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
