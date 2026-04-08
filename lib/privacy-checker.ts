/**
 * Privacy & GDPR surface checker
 *
 * All checks are purely external — no credentials required.
 * Analyses the fetched HTML for:
 *   - Cookie consent banner (common providers + generic detection)
 *   - Third-party tracker scripts (GA, Meta Pixel, GTM, Hotjar, etc.)
 *   - Privacy policy link presence in footer / page
 *   - Data deletion / contact mechanism present
 */

export type TrackerDetection = {
  name: string
  category: 'analytics' | 'advertising' | 'heatmap' | 'support' | 'social'
  detected: boolean
  evidence?: string   // The matching URL fragment
}

export type PrivacyResults = {
  cookieBannerDetected: boolean
  cookieBannerProvider?: string   // e.g. "OneTrust", "CookieBot", "generic"
  trackers: TrackerDetection[]
  privacyPolicyLinked: boolean
  privacyPolicyUrl?: string
  termsLinked: boolean
  dataDeletionMechanism: boolean  // "delete my account", "right to erasure", GDPR contact, etc.
  gdprContactPresent: boolean     // email or form for data requests
  score: number                   // 0–100, higher = better compliance posture
  flags: PrivacyFlag[]
  error?: string
}

export type PrivacyFlag = {
  title: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  remediation: string
}

// ── Known tracker patterns ────────────────────────────────────────────────────

const TRACKER_PATTERNS: Array<{
  name: string
  category: TrackerDetection['category']
  patterns: string[]
}> = [
  { name: 'Google Analytics (GA4)',    category: 'analytics',   patterns: ['google-analytics.com', 'gtag/js', 'analytics.js', 'ga.js'] },
  { name: 'Google Tag Manager',        category: 'analytics',   patterns: ['googletagmanager.com/gtm.js', 'googletagmanager.com/gtag'] },
  { name: 'Meta Pixel (Facebook)',     category: 'advertising', patterns: ['connect.facebook.net', 'fbq(', 'facebook.com/tr'] },
  { name: 'LinkedIn Insight Tag',      category: 'advertising', patterns: ['snap.licdn.com', 'platform.linkedin.com/in.js'] },
  { name: 'Twitter/X Pixel',          category: 'advertising', patterns: ['static.ads-twitter.com', 'analytics.twitter.com', 't.co/i/adsct'] },
  { name: 'Hotjar',                   category: 'heatmap',     patterns: ['hotjar.com', 'static.hotjar.com', '_hjSettings'] },
  { name: 'Microsoft Clarity',        category: 'heatmap',     patterns: ['clarity.ms', 'ms.clarity'] },
  { name: 'FullStory',                category: 'heatmap',     patterns: ['fullstory.com/s/fs.js', 'FS.identify'] },
  { name: 'Mixpanel',                 category: 'analytics',   patterns: ['cdn.mxpnl.com', 'api.mixpanel.com', 'mixpanel.track'] },
  { name: 'Amplitude',                category: 'analytics',   patterns: ['cdn.amplitude.com', 'api.amplitude.com'] },
  { name: 'Segment',                  category: 'analytics',   patterns: ['cdn.segment.com', 'api.segment.io', 'analytics.load('] },
  { name: 'HubSpot',                  category: 'support',     patterns: ['js.hs-scripts.com', 'js.hubspot.com', 'hs-analytics.net'] },
  { name: 'Intercom',                 category: 'support',     patterns: ['widget.intercom.io', 'api.intercom.io', 'intercomSettings'] },
  { name: 'Zendesk',                  category: 'support',     patterns: ['static.zdassets.com', 'zendesk.com/embeddable'] },
  { name: 'TikTok Pixel',            category: 'advertising', patterns: ['analytics.tiktok.com', 'ttq.track'] },
  { name: 'Snapchat Pixel',           category: 'advertising', patterns: ['tr.snapchat.com', 'sc-static.net/scevent'] },
]

// ── Cookie consent provider fingerprints ─────────────────────────────────────

const CONSENT_PROVIDERS: Array<{ name: string; patterns: string[] }> = [
  { name: 'OneTrust',     patterns: ['onetrust', 'optanon', 'cookiepro.com'] },
  { name: 'CookieBot',   patterns: ['cookiebot.com', 'cookieconsent', 'cc-nb'] },
  { name: 'Quantcast',   patterns: ['quantcast.mgr.consensu.org', 'quantserve'] },
  { name: 'TrustArc',    patterns: ['trustarc.com', 'truste.com/notice'] },
  { name: 'Axeptio',     patterns: ['axept.io', 'axeptio'] },
  { name: 'Didomi',      patterns: ['didomi.io', 'didomiConfig'] },
  { name: 'Osano',       patterns: ['osano.com'] },
  { name: 'Usercentrics',patterns: ['usercentrics.eu'] },
]

// ── Generic cookie banner text signals ───────────────────────────────────────

const COOKIE_BANNER_TEXT = [
  'we use cookies', 'this website uses cookies', 'accept cookies',
  'cookie consent', 'cookie policy', 'accept all cookies',
  'manage cookies', 'cookie preferences', 'gdpr', 'we value your privacy',
  'your privacy choices', 'allow cookies', 'cookie notice',
]

// ── Data deletion / GDPR contact signals ─────────────────────────────────────

const DATA_DELETION_SIGNALS = [
  'delete my account', 'delete account', 'right to erasure', 'right to be forgotten',
  'data deletion', 'data request', 'gdpr request', 'data subject request',
  'remove my data', 'personal data request',
]

const GDPR_CONTACT_SIGNALS = [
  'privacy@', 'dpo@', 'data-protection@', 'gdpr@', 'legal@',
  'contact us', 'contact@', 'reachout@', 'support@',
  '/contact', '/privacy', '/legal', '/gdpr', 'mailto:',
]

// ─── Main export ──────────────────────────────────────────────────────────────

export async function runPrivacyChecks(options: { url: string }): Promise<PrivacyResults> {
  const { url } = options

  const empty: PrivacyResults = {
    cookieBannerDetected: false,
    trackers: TRACKER_PATTERNS.map(t => ({ name: t.name, category: t.category, detected: false })),
    privacyPolicyLinked: false,
    termsLinked: false,
    dataDeletionMechanism: false,
    gdprContactPresent: false,
    score: 100,
    flags: [],
  }

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'CanIShip-Audit/1.0 (privacy-check)' },
      signal: AbortSignal.timeout(20000),
    })

    if (!res.ok) return { ...empty, error: `Fetch failed: HTTP ${res.status}` }

    const html = await res.text()
    const lower = html.toLowerCase()

    // ── Tracker detection ────────────────────────────────────────────────────
    const trackers: TrackerDetection[] = TRACKER_PATTERNS.map(t => {
      const match = t.patterns.find(p => lower.includes(p.toLowerCase()))
      return { name: t.name, category: t.category, detected: !!match, evidence: match }
    })

    // ── Cookie consent banner ────────────────────────────────────────────────
    let cookieBannerDetected = false
    let cookieBannerProvider: string | undefined

    for (const provider of CONSENT_PROVIDERS) {
      if (provider.patterns.some(p => lower.includes(p.toLowerCase()))) {
        cookieBannerDetected = true
        cookieBannerProvider = provider.name
        break
      }
    }

    if (!cookieBannerDetected) {
      cookieBannerDetected = COOKIE_BANNER_TEXT.some(t => lower.includes(t))
      if (cookieBannerDetected) cookieBannerProvider = 'generic'
    }

    // ── Privacy policy & terms links ─────────────────────────────────────────
    const linkPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
    const links: Array<{ href: string; text: string }> = []
    let m: RegExpExecArray | null
    while ((m = linkPattern.exec(html)) !== null) {
      links.push({ href: m[1].toLowerCase(), text: m[2].toLowerCase().replace(/<[^>]+>/g, '').trim() })
    }

    const privacyLink = links.find(l =>
      l.href.includes('privacy') || l.text.includes('privacy policy') || l.text.includes('privacy notice')
    )
    const termsLink = links.find(l =>
      l.href.includes('terms') || l.text.includes('terms') || l.text.includes('terms of service')
    )

    // ── Data deletion mechanism ───────────────────────────────────────────────
    const dataDeletionMechanism = DATA_DELETION_SIGNALS.some(s => lower.includes(s))

    // ── GDPR contact ─────────────────────────────────────────────────────────
    const gdprContactPresent = GDPR_CONTACT_SIGNALS.some(s => lower.includes(s))

    // ── Detected advertising trackers (no consent banner = GDPR issue) ────────
    const advertisingTrackers = trackers.filter(t => t.detected && t.category === 'advertising')
    const analyticsTrackers   = trackers.filter(t => t.detected && t.category === 'analytics')
    const allDetected         = trackers.filter(t => t.detected)

    // ── Build flags ───────────────────────────────────────────────────────────
    const flags: PrivacyFlag[] = []

    if (!cookieBannerDetected && allDetected.length > 0) {
      flags.push({
        title: 'No cookie consent banner detected',
        description: `${allDetected.length} third-party script(s) detected (${allDetected.map(t => t.name).join(', ')}) but no cookie consent mechanism found. Under GDPR and ePrivacy Directive, consent is required before setting non-essential cookies.`,
        severity: 'high',
        remediation: 'Add a cookie consent banner using a compliant CMP (e.g. CookieBot, OneTrust, or Axeptio). Ensure non-essential cookies are not loaded before consent is obtained.',
      })
    }

    if (advertisingTrackers.length > 0 && !cookieBannerDetected) {
      flags.push({
        title: 'Advertising trackers without consent',
        description: `${advertisingTrackers.map(t => t.name).join(', ')} detected. These require explicit opt-in consent under GDPR Article 6(1)(a) before any data is collected.`,
        severity: 'critical',
        remediation: 'Gate these scripts behind a consent management platform. They must not fire until the user actively accepts. Consider whether each tracker is still necessary.',
      })
    }

    if (!privacyLink) {
      flags.push({
        title: 'Privacy policy not linked from page',
        description: 'No link to a privacy policy was detected. A publicly accessible privacy policy is required under GDPR Article 13/14, CCPA, and most App Store guidelines.',
        severity: 'high',
        remediation: 'Add a visible link to your privacy policy in the footer or navigation. The policy must explain what data you collect, why, for how long, and how users can exercise their rights.',
      })
    }

    if (!dataDeletionMechanism && !gdprContactPresent) {
      flags.push({
        title: 'No data deletion or GDPR contact mechanism found',
        description: 'GDPR Article 17 gives users the right to erasure. No data deletion request mechanism or data protection contact was detected on this page.',
        severity: 'medium',
        remediation: 'Add a way for users to request data deletion — either a self-service account deletion flow, or a clearly visible contact method (email: privacy@yourdomain.com or a web form).',
      })
    }

    if (analyticsTrackers.length > 0 && !cookieBannerDetected) {
      flags.push({
        title: 'Analytics trackers detected without consent banner',
        description: `${analyticsTrackers.map(t => t.name).join(', ')} set cookies that require consent under ePrivacy rules.`,
        severity: 'medium',
        remediation: 'Consider switching to a cookie-free analytics tool (e.g. Plausible, Fathom) that does not require consent, or gate existing analytics behind your consent banner.',
      })
    }

    // ── Score ─────────────────────────────────────────────────────────────────
    let score = 100
    for (const flag of flags) {
      if (flag.severity === 'critical') score -= 30
      else if (flag.severity === 'high')   score -= 20
      else if (flag.severity === 'medium') score -= 10
      else                                 score -= 5
    }
    score = Math.max(0, score)

    return {
      cookieBannerDetected,
      cookieBannerProvider,
      trackers,
      privacyPolicyLinked: !!privacyLink,
      privacyPolicyUrl: privacyLink?.href,
      termsLinked: !!termsLink,
      dataDeletionMechanism,
      gdprContactPresent,
      score,
      flags,
    }
  } catch (err) {
    return { ...empty, error: err instanceof Error ? err.message : String(err) }
  }
}
