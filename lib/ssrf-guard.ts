/**
 * SSRF guard — validates that a URL does not point to internal/private resources.
 * Resolves the hostname to its IP addresses and checks against all blocked ranges
 * before the audit runners are allowed to connect to it.
 */

import dns from 'dns/promises'
import net from 'net'

// Blocked IP patterns: loopback, RFC-1918, link-local (AWS metadata), cloud metadata,
// broadcast, and IPv6 equivalents.
const BLOCKED_PATTERNS: RegExp[] = [
  /^127\./,                              // loopback (127.0.0.0/8)
  /^0\./,                                // this-network (0.0.0.0/8)
  /^10\./,                               // RFC-1918 class A (10.0.0.0/8)
  /^172\.(1[6-9]|2\d|3[01])\./,         // RFC-1918 class B (172.16.0.0/12)
  /^192\.168\./,                         // RFC-1918 class C (192.168.0.0/16)
  /^169\.254\./,                         // link-local / AWS metadata (169.254.169.254)
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT (100.64.0.0/10)
  /^192\.0\.2\./,                        // TEST-NET-1 (RFC 5737)
  /^198\.51\.100\./,                     // TEST-NET-2
  /^203\.0\.113\./,                      // TEST-NET-3
  /^240\./,                              // reserved (240.0.0.0/4)
  /^255\.255\.255\.255$/,                // broadcast
  /^0\.0\.0\.0$/,                        // INADDR_ANY
  /^::1$/,                               // IPv6 loopback
  /^fc00:/i,                             // IPv6 unique local (fc00::/7)
  /^fd[0-9a-f]{2}:/i,                   // IPv6 unique local (fd00::/8)
  /^fe80:/i,                             // IPv6 link-local
  /^::$/,                                // IPv6 unspecified
]

export type SsrfCheckResult =
  | { allowed: true; ip: string }
  | { allowed: false; reason: string }

/**
 * Validates a URL is safe to audit. Resolves DNS and checks all returned IPs.
 * Call this before passing any user-supplied URL to fetch/playwright/lighthouse.
 */
export async function checkSsrf(rawUrl: string): Promise<SsrfCheckResult> {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return { allowed: false, reason: 'Invalid URL' }
  }

  const hostname = parsed.hostname

  // Direct IP input — no DNS needed
  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      return {
        allowed: false,
        reason: `Direct IP address targets a private/reserved range: ${hostname}`,
      }
    }
    return { allowed: true, ip: hostname }
  }

  // Resolve DNS — check every returned address
  let v4: string[] = []
  let v6: string[] = []
  try {
    v4 = await dns.resolve4(hostname).catch(() => [])
    v6 = await dns.resolve6(hostname).catch(() => [])
  } catch {
    return { allowed: false, reason: `DNS resolution failed for hostname: ${hostname}` }
  }

  const all = [...v4, ...v6]
  if (all.length === 0) {
    return { allowed: false, reason: `Hostname did not resolve to any address: ${hostname}` }
  }

  for (const ip of all) {
    if (isBlockedIp(ip)) {
      return {
        allowed: false,
        reason: `Hostname "${hostname}" resolves to a private/reserved IP: ${ip}`,
      }
    }
  }

  return { allowed: true, ip: all[0] }
}

function isBlockedIp(ip: string): boolean {
  return BLOCKED_PATTERNS.some((re) => re.test(ip))
}
