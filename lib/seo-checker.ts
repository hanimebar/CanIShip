/**
 * SEO checker — pure fetch + HTML parse (no browser needed)
 * Checks meta tags, Open Graph, Twitter Card, robots.txt, sitemap, heading structure
 */

export type SeoOptions = {
  url: string
}

export type SeoIssue = {
  title: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  remediation: string
  evidence?: string
}

export type SeoResults = {
  title: string | null
  titleLength: number
  description: string | null
  descriptionLength: number
  hasCanonical: boolean
  canonical: string | null
  hasLangAttribute: boolean
  lang: string | null
  h1Count: number
  h1Text: string[]
  openGraph: {
    title: string | null
    description: string | null
    image: string | null
    url: string | null
    type: string | null
  }
  twitterCard: {
    card: string | null
    title: string | null
    image: string | null
  }
  hasRobotsTxt: boolean
  hasSitemap: boolean
  imagesWithoutAlt: number
  structuredData: {
    hasJsonLd: boolean
    types: string[]       // e.g. ["WebSite", "Organization", "Product"]
  }
  redirectChain: {
    hops: number
    chain: string[]
  } | null
  issues: SeoIssue[]
  score: number
  error?: string
}

async function detectRedirectChain(
  url: string,
): Promise<{ hops: number; chain: string[] } | null> {
  let current = url
  const chain: string[] = [current]

  try {
    for (let i = 0; i < 8; i++) {
      const res = await fetch(current, {
        method: 'HEAD',
        redirect: 'manual', // Do not follow — capture each hop
        signal: AbortSignal.timeout(5000),
        headers: { 'User-Agent': 'CanIShip-SEO-Checker/1.0' },
      })

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get('location')
        if (!location) break
        current = location.startsWith('http')
          ? location
          : new URL(location, current).href
        chain.push(current)
      } else {
        break
      }
    }
  } catch { /* non-fatal */ }

  return chain.length > 1 ? { hops: chain.length - 1, chain } : null
}

function extractMeta(html: string, name: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']*?)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*?)["'][^>]+name=["']${name}["']`, 'i'),
  ]
  for (const p of patterns) {
    const m = html.match(p)
    if (m) return m[1]
  }
  return null
}

function extractProperty(html: string, property: string): string | null {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']*?)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*?)["'][^>]+property=["']${property}["']`, 'i'),
  ]
  for (const p of patterns) {
    const m = html.match(p)
    if (m) return m[1]
  }
  return null
}

export async function runSeoChecks(options: SeoOptions): Promise<SeoResults> {
  const { url } = options
  const issues: SeoIssue[] = []

  const empty: SeoResults = {
    title: null,
    titleLength: 0,
    description: null,
    descriptionLength: 0,
    hasCanonical: false,
    canonical: null,
    hasLangAttribute: false,
    lang: null,
    h1Count: 0,
    h1Text: [],
    openGraph: { title: null, description: null, image: null, url: null, type: null },
    twitterCard: { card: null, title: null, image: null },
    hasRobotsTxt: false,
    hasSitemap: false,
    imagesWithoutAlt: 0,
    structuredData: { hasJsonLd: false, types: [] },
    redirectChain: null,
    issues: [],
    score: 0,
  }

  try {
    const origin = new URL(url).origin

    // ── Redirect chain ────────────────────────────────────────────
    const redirectChain = await detectRedirectChain(url)
    if (redirectChain && redirectChain.hops >= 2) {
      issues.push({
        title: `Redirect chain detected (${redirectChain.hops} hop${redirectChain.hops > 1 ? 's' : ''})`,
        description: `The URL goes through ${redirectChain.hops} redirect(s) before reaching the final destination. Each hop adds latency and dilutes PageRank passed through the chain.`,
        severity: redirectChain.hops >= 3 ? 'high' : 'medium',
        remediation: 'Update all inbound links to point directly to the final destination URL. Avoid chaining redirects — each redirect wastes a round-trip.',
        evidence: redirectChain.chain.slice(0, 4).join(' → '),
      })
    }

    // Fetch page HTML
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { 'User-Agent': 'CanIShip-SEO-Checker/1.0' },
    })
    const html = await res.text()

    // ── Title ──────────────────────────────────────────────────────
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : null
    const titleLength = title?.length ?? 0

    if (!title) {
      issues.push({
        title: 'Missing <title> tag',
        description: 'The page has no title tag. Search engines use this as the primary listing headline.',
        severity: 'critical',
        remediation: 'Add a descriptive <title> tag (50–60 characters) to every page.',
      })
    } else if (titleLength < 10) {
      issues.push({
        title: 'Title tag too short',
        description: `Title is only ${titleLength} characters. Too short to be descriptive.`,
        severity: 'medium',
        remediation: 'Expand the title to 50–60 characters with your primary keyword.',
        evidence: title,
      })
    } else if (titleLength > 60) {
      issues.push({
        title: 'Title tag too long',
        description: `Title is ${titleLength} characters. Search engines truncate at ~60 chars.`,
        severity: 'low',
        remediation: 'Trim the title to 50–60 characters to avoid truncation in SERPs.',
        evidence: title,
      })
    }

    // ── Meta description ───────────────────────────────────────────
    const description = extractMeta(html, 'description')
    const descriptionLength = description?.length ?? 0

    if (!description) {
      issues.push({
        title: 'Missing meta description',
        description: 'No meta description found. Google often uses this as the search snippet.',
        severity: 'high',
        remediation: 'Add <meta name="description" content="..."> with 120–160 characters summarising the page.',
      })
    } else if (descriptionLength < 50) {
      issues.push({
        title: 'Meta description too short',
        description: `Description is only ${descriptionLength} characters.`,
        severity: 'medium',
        remediation: 'Expand to 120–160 characters with a compelling call to action.',
        evidence: description,
      })
    } else if (descriptionLength > 160) {
      issues.push({
        title: 'Meta description too long',
        description: `Description is ${descriptionLength} characters — will be truncated in search results.`,
        severity: 'low',
        remediation: 'Shorten to 120–160 characters.',
        evidence: description.slice(0, 160) + '…',
      })
    }

    // ── Canonical ──────────────────────────────────────────────────
    const canonicalMatch = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)
      || html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)
    const canonical = canonicalMatch ? canonicalMatch[1] : null
    const hasCanonical = !!canonical

    if (!hasCanonical) {
      issues.push({
        title: 'Missing canonical URL',
        description: 'No <link rel="canonical"> found. This can lead to duplicate content issues.',
        severity: 'medium',
        remediation: 'Add <link rel="canonical" href="https://yourdomain.com/page"> to the <head>.',
      })
    }

    // ── Language attribute ─────────────────────────────────────────
    const langMatch = html.match(/<html[^>]+lang=["']([^"']+)["']/i)
    const lang = langMatch ? langMatch[1] : null
    const hasLangAttribute = !!lang

    if (!hasLangAttribute) {
      issues.push({
        title: 'Missing lang attribute on <html>',
        description: 'Screen readers and search engines use the lang attribute to determine page language.',
        severity: 'medium',
        remediation: 'Add lang="en" (or your locale) to the <html> tag.',
      })
    }

    // ── H1 headings ────────────────────────────────────────────────
    const h1Regex = /<h1[^>]*>([\s\S]*?)<\/h1>/gi
    const h1Matches: RegExpExecArray[] = []
    let h1Match: RegExpExecArray | null
    while ((h1Match = h1Regex.exec(html)) !== null) h1Matches.push(h1Match)
    const h1Count = h1Matches.length
    const h1Text = h1Matches.map((m) => m[1].replace(/<[^>]+>/g, '').trim()).slice(0, 3)

    if (h1Count === 0) {
      issues.push({
        title: 'No H1 heading found',
        description: 'The page has no H1 tag. H1 is the primary on-page SEO signal after the title.',
        severity: 'high',
        remediation: 'Add exactly one H1 heading that contains your primary keyword.',
      })
    } else if (h1Count > 1) {
      issues.push({
        title: `Multiple H1 headings (${h1Count} found)`,
        description: 'Only one H1 per page is best practice. Multiple H1s dilute the primary keyword signal.',
        severity: 'medium',
        remediation: 'Keep exactly one H1 and use H2/H3 for subheadings.',
        evidence: h1Text.join(' | '),
      })
    }

    // ── Open Graph ─────────────────────────────────────────────────
    const openGraph = {
      title: extractProperty(html, 'og:title'),
      description: extractProperty(html, 'og:description'),
      image: extractProperty(html, 'og:image'),
      url: extractProperty(html, 'og:url'),
      type: extractProperty(html, 'og:type'),
    }

    if (!openGraph.title || !openGraph.description || !openGraph.image) {
      const missing = [
        !openGraph.title && 'og:title',
        !openGraph.description && 'og:description',
        !openGraph.image && 'og:image',
      ].filter(Boolean).join(', ')
      issues.push({
        title: 'Incomplete Open Graph tags',
        description: `Missing: ${missing}. When shared on LinkedIn, Twitter, or Slack the link preview will be generic.`,
        severity: 'medium',
        remediation: 'Add og:title, og:description, og:image, and og:url to the <head> of every page.',
        evidence: `Missing: ${missing}`,
      })
    }

    // ── Twitter Card ───────────────────────────────────────────────
    const twitterCard = {
      card: extractMeta(html, 'twitter:card'),
      title: extractMeta(html, 'twitter:title'),
      image: extractMeta(html, 'twitter:image'),
    }

    if (!twitterCard.card) {
      issues.push({
        title: 'Missing Twitter Card meta tags',
        description: 'Without twitter:card, Twitter/X will show a plain link instead of a rich card.',
        severity: 'low',
        remediation: 'Add <meta name="twitter:card" content="summary_large_image"> and twitter:title/image.',
      })
    }

    // ── Images without alt ─────────────────────────────────────────
    const imgRegex = /<img[^>]+>/gi
    const allImages: RegExpExecArray[] = []
    let imgMatch: RegExpExecArray | null
    while ((imgMatch = imgRegex.exec(html)) !== null) allImages.push(imgMatch)
    const imagesWithoutAlt = allImages.filter((m) => !/alt=["'][^"']*["']/.test(m[0])).length

    if (imagesWithoutAlt > 0) {
      issues.push({
        title: `${imagesWithoutAlt} image(s) missing alt text`,
        description: 'Images without alt text miss SEO keyword opportunities and fail accessibility checks.',
        severity: imagesWithoutAlt > 5 ? 'high' : 'medium',
        remediation: 'Add descriptive alt attributes to all <img> tags.',
        evidence: `${imagesWithoutAlt} of ${allImages.length} images`,
      })
    }

    // ── Structured data (JSON-LD) ───────────────────────────────────
    const jsonLdRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
    const jsonLdMatches: string[] = []
    let jldMatch: RegExpExecArray | null
    while ((jldMatch = jsonLdRegex.exec(html)) !== null) jsonLdMatches.push(jldMatch[1])

    const jsonLdTypes: string[] = []
    for (const raw of jsonLdMatches) {
      try {
        const parsed = JSON.parse(raw.trim())
        const items = Array.isArray(parsed) ? parsed : [parsed]
        for (const item of items) {
          if (item['@type']) {
            const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']]
            jsonLdTypes.push(...types)
          }
        }
      } catch { /* malformed JSON-LD */ }
    }

    const structuredData = {
      hasJsonLd: jsonLdMatches.length > 0,
      types: Array.from(new Set(jsonLdTypes)),
    }

    if (!structuredData.hasJsonLd) {
      issues.push({
        title: 'No structured data (JSON-LD) found',
        description: 'No JSON-LD schema.org markup was detected. Structured data enables rich results in Google Search (star ratings, FAQs, breadcrumbs, product info) and helps search engines understand your content.',
        severity: 'low',
        remediation: 'Add at least a WebSite schema with a sitelinks searchbox, and Organization or LocalBusiness schema. For product pages add Product schema. Use Google\'s Rich Results Test to validate.',
      })
    }

    // ── robots.txt ─────────────────────────────────────────────────
    let hasRobotsTxt = false
    try {
      const robotsRes = await fetch(`${origin}/robots.txt`, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'CanIShip-SEO-Checker/1.0' },
      })
      hasRobotsTxt = robotsRes.ok && (robotsRes.headers.get('content-type') || '').includes('text')
    } catch { /* non-fatal */ }

    if (!hasRobotsTxt) {
      issues.push({
        title: 'No robots.txt found',
        description: 'robots.txt tells search engine crawlers which pages to index. Without it, crawlers use defaults.',
        severity: 'low',
        remediation: 'Create /robots.txt. Minimum: "User-agent: *\\nAllow: /"',
      })
    }

    // ── sitemap.xml ────────────────────────────────────────────────
    let hasSitemap = false
    const sitemapCandidates = ['/sitemap.xml', '/sitemap_index.xml', '/sitemap/sitemap.xml']
    for (const path of sitemapCandidates) {
      try {
        const sitemapRes = await fetch(`${origin}${path}`, {
          signal: AbortSignal.timeout(8000),
          method: 'HEAD',
        })
        if (sitemapRes.ok) { hasSitemap = true; break }
      } catch { /* try next */ }
    }

    // Also check robots.txt for sitemap directive if we have it
    if (!hasSitemap && hasRobotsTxt) {
      try {
        const robotsRes = await fetch(`${origin}/robots.txt`, { signal: AbortSignal.timeout(8000) })
        const robotsText = await robotsRes.text()
        if (/^sitemap:/im.test(robotsText)) hasSitemap = true
      } catch { /* non-fatal */ }
    }

    if (!hasSitemap) {
      issues.push({
        title: 'No sitemap.xml found',
        description: 'A sitemap helps search engines discover all your pages faster.',
        severity: 'low',
        remediation: 'Generate a sitemap.xml and submit it to Google Search Console. Next.js can auto-generate one with a sitemap.ts route.',
      })
    }

    // ── Score ──────────────────────────────────────────────────────
    const deductions = { critical: 25, high: 15, medium: 8, low: 3 }
    const score = Math.max(
      0,
      100 - issues.reduce((sum, i) => sum + (deductions[i.severity] || 0), 0)
    )

    return {
      title,
      titleLength,
      description,
      descriptionLength,
      hasCanonical,
      canonical,
      hasLangAttribute,
      lang,
      h1Count,
      h1Text,
      openGraph,
      twitterCard,
      hasRobotsTxt,
      hasSitemap,
      imagesWithoutAlt,
      structuredData,
      redirectChain,
      issues,
      score,
    }
  } catch (err) {
    return {
      ...empty,
      issues,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
