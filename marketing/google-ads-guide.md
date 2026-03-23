# Google Ads Campaign Guide — CanIShip

> **Honest preamble**: Google Ads makes most sense after you have organic traction.
> If you haven't done a Product Hunt launch, an HN "Show HN", or a Twitter/X thread yet — do those first.
> They're free, they reach your exact audience, and they'll tell you if the message resonates before you pay for it.
>
> This guide assumes you're ready to run a **small validation campaign** ($200–300) or you already have
> organic conversion data and want to scale. Follow it in order — each step depends on the previous one.

---

## Prerequisites (do these before touching the Ads UI)

- [ ] **Google Ads account created** — ads.google.com, link your billing card
- [ ] **Google Analytics 4 (GA4) installed** on caniship.actvli.com
  - Add the GA4 script tag to `app/layout.tsx` (or use `@next/third-parties/google`)
  - Verify it's firing on the domain in GA4 DebugView
- [ ] **Conversion actions defined** in Google Ads (linked from GA4):
  - `signup_complete` — user lands on `/dashboard` after email confirmation
  - `upgrade_started` — user hits `/api/stripe/checkout`
  - `paid_subscription` — Stripe webhook confirms payment (import from GA4 or use Ads conversion tag)
- [ ] **UTM parameters plan** — all ad URLs will use:
  `?utm_source=google&utm_medium=cpc&utm_campaign=<campaign-name>&utm_content=<ad-variant>`

> Without conversion tracking, you are flying blind. Do not skip this.

---

## Step 1 — Define Your Objective

In Google Ads, every campaign needs a goal. For CanIShip:

**Primary goal**: Signups (free tier) → measure cost-per-signup
**Secondary goal**: Paid conversions → measure cost-per-acquisition (CPA)

On a small test budget, optimise for signups first. You don't have enough paid conversions yet to
train Google's algorithm on paid events (you need ~50 conversions/month for Smart Bidding to work).

---

## Step 2 — Campaign Type

Choose **Search** campaign. Not Display, not Performance Max (yet).

Reasons:
- Search = people actively looking for something ("web app qa tool") — highest intent
- Display = interruption marketing — your audience hates banner ads
- Performance Max = black box that eats your budget while you learn nothing — avoid until you have data

**Settings to configure when creating the campaign:**

| Setting | Value |
|---|---|
| Campaign type | Search |
| Campaign goal | Leads (or Website traffic if leads isn't available without conversion tag yet) |
| Networks | Search only — **uncheck "Include Google search partners"** and **"Include Display Network"** |
| Locations | Start with English-speaking: United States, United Kingdom, Canada, Australia, Ireland, Finland |
| Languages | English |
| Start/end date | Set an end date 30 days out so you don't forget it's running |
| Budget | $10/day ($300/month) for a validation test |

---

## Step 3 — Campaign Structure

Use **one campaign, two ad groups** to start. Don't over-structure before you have data.

```
Campaign: CanIShip — Search — Validation
├── Ad Group 1: Pre-launch QA
│   Intent: people who want to check their app before launching
│   Keywords: pre-launch checklist, web app audit, app quality check, etc.
│
└── Ad Group 2: Accessibility & Performance
    Intent: people looking for WCAG or Lighthouse tools
    Keywords: wcag audit tool, accessibility checker, lighthouse audit, etc.
```

---

## Step 4 — Keywords

### Match Types

| Type | Syntax | What it matches |
|---|---|---|
| Broad | `web app testing` | Anything Google thinks is related — **avoid on a small budget** |
| Phrase | `"web app audit tool"` | Queries containing that phrase in order |
| Exact | `[pre-launch app checklist]` | That exact query (close variants included) |

**Start with Phrase and Exact only.** Add broad match only after you've seen what search terms convert.

### Ad Group 1: Pre-launch QA

```
Exact:
[pre launch app checklist]
[web app audit tool]
[app qa checklist]
[can i ship my app]
[app ready to ship]
[website qa tool]
[web app quality check]

Phrase:
"pre-launch checklist"
"app audit tool"
"website audit tool"
"launch checklist"
```

### Ad Group 2: Accessibility & Performance

```
Exact:
[wcag audit tool]
[wcag checker free]
[accessibility audit tool]
[lighthouse audit tool]
[web accessibility checker]
[core web vitals checker]

Phrase:
"wcag 2.1 checker"
"accessibility audit"
"lighthouse performance audit"
```

### Negative Keywords (apply at campaign level from day 1)

These prevent wasted spend on irrelevant searches:

```
free
crack
torrent
github
open source
enterprise
seo tool          ← too generic, high CPC, wrong intent
penetration testing
job
salary
resume
tutorial
how to
what is
stackoverflow
reddit
youtube
```

---

## Step 5 — Ad Copy

Each ad group needs **3 Responsive Search Ads (RSA)**. Google mixes and matches headlines/descriptions
to find the best combination. Give it variety.

### RSA Structure
- **15 headlines** (30 chars max each) — Google picks 3 to show at a time
- **4 descriptions** (90 chars max each) — Google picks 2 to show

### Ad Group 1: Pre-launch QA — Headlines

```
1.  Ship With Confidence
2.  AI App Audit in Minutes
3.  8 QA Layers. One Report.
4.  Is Your App Ready to Launch?
5.  Catch Bugs Before Your Users Do
6.  Pre-Launch App Checklist
7.  Functional, A11y, Perf, Security
8.  Get Your ShipScore Today
9.  Free Audit — No Credit Card
10. Playwright + Lighthouse + axe-core
11. Solo Builder Quality Check
12. Ship Without a QA Team
13. Automated App Audit Tool
14. From Idea to Production-Ready
15. Start Free. 3 Audits Included.
```

### Ad Group 1 — Descriptions

```
1. Run 8 automated QA checks on your web app in minutes. Catch bugs, a11y issues, and security gaps before launch.
2. No QA team? No problem. CanIShip runs Playwright, Lighthouse, axe-core, and more — and gives you a ShipScore.
3. Get a ShipScore for your web app. Functional tests, WCAG accessibility, Core Web Vitals, and security — in one run.
4. Used by solo builders shipping production apps. Free tier includes 3 audits/month. No credit card required.
```

### Ad Group 2: Accessibility & Performance — Headlines

```
1.  WCAG 2.1 AA Audit Tool
2.  Accessibility Check in Minutes
3.  axe-core + Lighthouse Combined
4.  Core Web Vitals Report
5.  8 Audit Layers for Your App
6.  Free WCAG Checker
7.  Is Your App Accessible?
8.  Lighthouse Score + Fixes
9.  Catch A11y Violations Before Launch
10. WCAG, Perf, Security in One Tool
11. Instant Accessibility Report
12. No Setup. Just Paste Your URL.
13. Free Tier — 3 Audits/Month
14. Ship Accessible Apps Faster
15. Solo Builder QA Tool
```

### Ad Group 2 — Descriptions

```
1. Automated WCAG 2.1 AA audit powered by axe-core. See every violation with impact severity and a fix recommendation.
2. Get Lighthouse performance scores, Core Web Vitals, and WCAG accessibility in one report. Free tier available.
3. CanIShip runs 8 QA checks including accessibility (axe-core), performance (Lighthouse), and security headers.
4. Built for solo builders. No config files, no CI setup. Paste your URL, get your ShipScore in minutes.
```

### URL rules
- Final URL: `https://caniship.actvli.com/`
- Display path: `caniship.actvli.com/audit` (or `/qa-tool`)
- Tracking template: `{lpurl}?utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_content={creative}`

---

## Step 6 — Bidding Strategy

On a small test budget, do **not** use Smart Bidding (Target CPA, Maximise Conversions) yet.
Google's algorithm needs 30–50 conversions/month to optimise effectively. Before that it just
spends your money while it "learns".

| Phase | Budget | Strategy |
|---|---|---|
| Week 1–2 (data gathering) | $10/day | Manual CPC — set max CPC to $3.00 |
| Week 3–4 (enough data?) | $10/day | Switch to Maximise Clicks with $4 max CPC cap |
| Month 2+ (50+ conversions) | Increase | Switch to Target CPA |

**Starting max CPCs by keyword type:**
- Exact match branded/intent: $3–4
- Phrase match: $2–3
- Reduce any keyword below 2% CTR after 50 impressions

---

## Step 7 — Landing Page

You're sending traffic to the homepage. Check it against these criteria:

- [ ] **Message match**: the headline on the page should echo the ad. If the ad says "Pre-launch App Checklist", the page should say that — not just "CanIShip"
- [ ] **CTA above the fold**: "Run your first audit free" button visible without scrolling on desktop and mobile
- [ ] **Load time**: run a Lighthouse audit on the homepage — aim for >85 performance score. Google penalises slow landing pages with a lower Quality Score (which raises your CPC)
- [ ] **Mobile**: check the page on 375px. The CTA must be tapable
- [ ] **Social proof**: one line of trust signal — "Used by X builders", or a screenshot of a real report score

> **Quality Score matters**: Google rates your ad relevance + landing page experience + expected CTR.
> A Quality Score of 7+ means you pay less per click than competitors with lower scores.
> A bad landing page directly costs you money.

---

## Step 8 — Launch Checklist

Before hitting "Enable":

- [ ] Conversion tracking verified (test a signup, confirm it fires in GA4 + Google Ads)
- [ ] All ads have 3+ headlines pinned to position 1 (brand name), rest unpinned
- [ ] Negative keyword list applied at campaign level
- [ ] Ad schedule: all hours (you don't have enough data yet to daypart)
- [ ] Location targeting: check "Presence" not "Presence or interest" — you don't want clicks from people just researching these locations
- [ ] Auto-applied recommendations: **turn off** (Google will try to expand your match types and spend)
- [ ] Ad rotation: "Do not optimise — rotate indefinitely" while testing, then switch after 30 days

---

## Step 9 — First 7 Days: What to Monitor

Check the campaign **once per day**, not more. Log into Google Ads and look at:

| Metric | What to look for | Action if bad |
|---|---|---|
| **Search terms report** | What queries triggered your ads | Add irrelevant ones as negatives immediately |
| **CTR** | >3% for exact match, >2% for phrase | Rewrite headlines with lower CTR |
| **Avg. CPC** | Should be $1.50–$4.00 | Raise/lower max CPCs per keyword |
| **Conversions** | Signups from ads | Is the cost-per-signup acceptable? |
| **Impression share** | Are you showing up? | If <50%, increase bids or Quality Score |

**Search terms report is the most important thing in week 1.** Open it daily, add negatives for anything irrelevant. You will see bizarre queries — this is normal.

---

## Step 10 — When to Kill It vs Scale It

### Kill or pause if (after 30 days):
- Cost per signup > $15 (your free plan has no immediate revenue — you need the signup-to-paid rate to justify this)
- CTR consistently < 1% (ad copy or keywords are wrong)
- Zero conversions after $100 spent (landing page or offer problem)

### Scale if:
- Cost per free signup < $5
- Free→paid conversion rate > 5%
- Cost per paid conversion < $40 (one Builder month pays for it in ~2 months)

---

## Recommended Order of Operations

If you haven't done free channels yet, run these **before or alongside** Google Ads:

1. **Product Hunt** — submit on a Tuesday/Wednesday, prepare a maker post explaining the "vibe coder" angle
2. **Hacker News Show HN** — "Show HN: I built an 8-layer automated QA tool for solo builders"
3. **Twitter/X thread** — show a real audit result (a screenshot of a 92/100 ShipScore), explain each layer
4. **r/SaaS + r/webdev** — post the same Show HN style, no hard sell
5. **Google Ads** — after you have 50+ organic signups and know the message that resonates

Free channels will teach you which message converts. Then you use that message in your ads.

---

## Useful Links

- Google Ads: https://ads.google.com
- GA4: https://analytics.google.com
- Google Tag Manager (optional, makes conversion tags easier): https://tagmanager.google.com
- Keyword Planner (inside Google Ads → Tools → Keyword Planner)
- Google Ads Editor (free desktop app — much faster than the web UI for bulk edits)

---

*Last updated: March 2026*
