# CanIShip — Claude Code Build Prompt
## AI-Powered App QA & Audit Tool for Solo Builders & Vibe Coders

---

## PRODUCT VISION

Build a web application called **CanIShip** — an AI-powered, bulletproof quality assurance and audit tool built specifically for solo builders, indie developers, and vibe coders who ship fast and need to catch bugs, risks, and hidden errors before real users do.

This is NOT a casual "vibe check." CanIShip performs legitimate, comprehensive QA: functional testing, broken link detection, accessibility audits, performance analysis, mobile responsiveness, security surface scans, and hidden error detection — then wraps all findings in a plain-English report any founder can act on.

The target user has never heard of Selenium, doesn't know what CI/CD means, and just wants a definitive answer: **can I ship this, or not?** They get a full audit report with risks, what's working, and a roadmap of future improvements — written like a senior developer reviewed their app, not like a bureaucratic QA form.

The product should feel like handing your app to a smart, rigorous, honest friend who will stress-test it, break it, score it, and tell you exactly what to fix before launch.

---

## DEPLOYMENT MODEL

CanIShip ships in two modes:

- **Web app** (hosted SaaS) — user signs up, pastes a URL, runs a test in the browser. No setup.
- **Downloadable / self-hosted** (Docker container) — available as a premium tier. User runs CanIShip locally with their own Claude API key. Full functionality, no data leaves their machine.

```bash
# Premium self-hosted mode
docker run -p 3000:3000 -e ANTHROPIC_API_KEY=sk-... caniship
```

Build the architecture to support both from day one. The Docker path requires no Supabase auth — it's single-user by default. Reports are saved to a local volume.

---

## CORE FEATURES TO BUILD

### 1. Project Intake (The Drop Zone)
- User pastes their app's URL (or uploads a ZIP of a local app)
- User writes a plain-English description of what the app does:
  - Example: "It's a task manager. Users sign up, create tasks, assign due dates, mark them done, and delete them."
- User optionally adds test credentials (username/password for login flows)
- User selects a test depth: **Quick Scan** (5 min), **Standard Check** (15 min), **Deep Audit** (30 min)
- Optional: User lists specific flows they want tested ("make sure checkout works", "test the password reset flow")

### 2. AI Test Agent (The Brain)
Use the **Anthropic Claude API** (claude-sonnet-4-20250514) as the reasoning engine.

The agent should:
- Parse the user's plain-English app description to infer all expected user flows
- Generate a structured test plan: a list of flows to attempt, actions to take, and expected outcomes
- Orchestrate all testing layers (see below) and collect all results
- For each step: take a screenshot, record what happened, compare to what was expected
- Flag mismatches as bugs, UX issues, accessibility violations, performance problems, or security concerns
- Synthesize all findings into a unified report with risk assessment and future recommendations

### 3. Testing Layers (Comprehensive QA Stack)

CanIShip runs multiple testing layers in parallel or sequence per audit:

#### a. Functional Testing — Playwright
- Navigate all user flows autonomously (navigation, button clicks, form submissions, auth flows)
- Detect: unresponsive buttons, form submission failures, blank screens after actions, missing loading/success/error states, dead ends, broken redirects
- Capture screenshots at each step

#### b. Broken Link & Network Detection — Playwright
- Crawl every internal link and asset
- Detect 404s, redirect loops, broken hrefs
- Intercept all network responses via `page.on('response')` — flag any 4xx/5xx API calls
- Capture silent failures: API calls that fail but show no error to the user

#### c. Hidden Console Errors — Playwright
- Listen via `page.on('console')` for JS errors, warnings, and unhandled promise rejections
- Surface errors the user would never see but that indicate broken logic

#### d. Accessibility Audit — axe-core
- Inject axe-core into each page via Playwright
- Detect WCAG 2.1 AA violations: missing alt text, poor color contrast, unlabelled form inputs, keyboard navigation failures, missing ARIA roles
- Report violations by severity (critical, serious, moderate, minor)

#### e. Performance Audit — Lighthouse (programmatic)
- Run Lighthouse against the URL in programmatic mode
- Capture: Core Web Vitals (LCP, CLS, FID/INP), Time to Interactive, render-blocking resources, unoptimized images
- Flag anything that would cause users to bounce before the page loads

#### f. Mobile Responsiveness — Playwright
- Re-run key flows at mobile viewport (375px, 768px)
- Detect layout breaks, overflowing elements, unclickable buttons, unreadable text
- Screenshot comparisons between desktop and mobile

#### g. Security Surface Scan — Custom Checks
- Detect pages accessible without authentication that should require it
- Check for missing security headers (CSP, X-Frame-Options, X-Content-Type-Options)
- Flag sensitive data exposed in URLs or page source
- Detect missing HTTPS or mixed content warnings

### 4. The Claude API Prompt Structure

```
System: You are CanIShip, a senior QA engineer and product reviewer for web apps.
You are conducting a comprehensive pre-launch audit on behalf of a solo builder.
Your job is to think like a real user, a security reviewer, and a product manager simultaneously.
Be honest. Be specific. Be constructive. Your report determines whether this app ships.

User: Here is the app: [URL]
Here is what it's supposed to do: [USER DESCRIPTION]
Here are the flows I want you to check: [FLOWS]
Here is what the automated tests found: [ALL LAYER RESULTS + SCREENSHOTS]

Return a structured JSON report with:
- overall_score (0-100)
- ship_verdict: "yes" | "no" | "conditional" (conditional = ship if top fixes are applied)
- critical_bugs: [] (things that break core functionality)
- ux_issues: [] (things that work but feel broken, confusing, or frustrating)
- accessibility_violations: [] (WCAG failures by severity)
- performance_issues: [] (Core Web Vitals failures, slow loads)
- security_flags: [] (exposed routes, missing headers, sensitive data)
- warnings: [] (minor issues, edge cases)
- passed_checks: [] (things that worked well)
- risks: [] (what could go wrong in production — user drop-off, complaints, trust damage)
- rewards: [] (what is working well and why it matters — conversion, retention, trust)
- future_recommendations: [] (suggested improvements beyond bugs: missing features users will expect, UX patterns to upgrade, performance wins, accessibility quick wins)
- plain_english_summary: "" (3-4 sentences a non-technical founder can understand and act on)
- top_5_fixes: [] (the 5 most important things to fix before launch, ordered by priority)
```

### 5. The Audit Report (The Output)

Generate a clean, structured, readable report that includes:

- **ShipScore™** — a 0–100 score with a verdict:
  - 90–100: "Ship it — you're good to go"
  - 70–89: "Almost there — fix the top issues first"
  - 50–69: "Not yet — significant work needed"
  - Below 50: "Do not ship — critical issues found"
- **Ship Verdict** — YES / NO / CONDITIONAL (with conditions listed)
- **Critical Bugs** — red cards: what happened, what should have happened, screenshot
- **UX Issues** — orange cards: the friction point and a suggested fix
- **Accessibility Violations** — purple cards by severity with WCAG reference
- **Performance Issues** — blue cards with metric values and targets
- **Security Flags** — dark red cards with specific remediation steps
- **Warnings** — yellow cards for minor issues
- **What Passed** — green section showing flows and checks that succeeded
- **Risk Assessment** — what could go wrong in production if shipped as-is
- **Rewards** — what is working well and the value it delivers to users
- **Future Recommendations** — improvements beyond the current bugs: features to add, patterns to upgrade, optimizations to pursue
- **Top 5 Fixes** — prioritized action list the builder can execute immediately
- **Plain English Summary** — written for a non-technical founder
- Export to PDF option

### 6. Dashboard (History & Retesting)
- User account (email + password auth)
- List of past audit runs per app
- Ability to re-run after fixes to see if ShipScore improved
- Diff view: "Last audit vs this audit — you fixed 6 issues, 3 remain"

---

## TECH STACK

- **Frontend**: Next.js 14 (App Router) + Tailwind CSS
- **Backend**: Next.js API routes (Railway for persistent Playwright process)
- **Browser Automation**: Playwright (headless Chromium)
- **Accessibility**: axe-core (injected via Playwright)
- **Performance**: Lighthouse (programmatic Node.js API)
- **AI Engine**: Anthropic Claude API — claude-sonnet-4-20250514
- **Auth**: Supabase Auth (skipped in Docker/self-hosted mode)
- **Database**: Supabase (Postgres) for storing audit runs and reports (local volume in Docker mode)
- **Screenshot Storage**: Supabase Storage (local filesystem in Docker mode)
- **PDF Export**: react-pdf or Puppeteer
- **Payments**: Stripe
- **Deployment**: Railway (Docker) — required for persistent Playwright + Lighthouse process. Vercel cannot run Playwright reliably.
- **Domain**: caniship.actvli.com (subdomain under actvli.com, DNS on GreenGeeks with CNAME to Railway)
- **Self-hosted**: Docker image published to Docker Hub as `hanimebar/caniship`

### Job Queue Architecture (required)
Audit runs are long-running (5–30 min). Do NOT run them synchronously in an API route.
- User submits → creates a job record in Supabase with status `queued`
- Background worker picks up job, runs all test layers, updates status to `running` → `complete`
- Frontend polls job status every 5 seconds and redirects to report when complete
- Use BullMQ (Redis-backed) or a simple Supabase-polling worker pattern

---

## UI/UX DESIGN DIRECTION

The aesthetic should be:
- **Confident and direct** — like a senior developer giving honest, rigorous feedback
- **Not corporate, not enterprise** — this is for builders, not boardrooms
- **Dark mode first** with a clean, high-contrast palette
- Bold monospace or technical font for the product name and scores
- Accent color: electric green or amber (think "terminal output meets modern SaaS")
- The ShipScore should be visually dominant — big number, color-coded, impossible to miss
- Report cards should feel like code review comments, not bureaucratic forms
- The overall tone: direct, rigorous, but encouraging — like the best code reviewer you've ever had

Avoid: purple gradients, generic startup aesthetics, anything that looks like a Figma template

---

## MONETIZATION PLAN (build with this in mind)

- **Free tier**: 3 audit runs per month, Quick Scan only, basic report (no risk/rewards/future recommendations)
- **Builder plan ($19/month)**: 20 runs/month, all scan depths, full reports including risk + rewards + future recommendations, PDF export, history
- **Studio plan ($49/month)**: Unlimited runs, team sharing, API access, white-label reports, **Docker self-hosted image**

The Docker self-hosted image is the Studio-tier differentiator. Gate it behind a license key check in the Docker entrypoint.

Use Stripe for payments. Build the pricing page and plan gating into the app from the start — not as an afterthought.

---

## WHAT MAKES THIS DIFFERENT FROM EXISTING TOOLS

Make these differentiators clear in the UI copy and onboarding:
1. **Zero setup** — no SDK, no browser extension, no CI/CD integration required. Just a URL.
2. **Plain English in, plain English out** — describe your app like you'd explain it to a friend; get a report you can actually act on
3. **Bulletproof QA, not vibes** — functional testing, accessibility, performance, security surface, hidden errors, broken links — all in one run
4. **Risk + Rewards + Roadmap** — not just a bug list. You get a risk assessment, what's working, and a forward-looking improvement plan
5. **Built for solo builders** — not for QA teams, not for enterprises, not for people who know what Selenium is
6. **Priced for humans** — not $500/month
7. **The ShipScore™** — one number, one verdict: ship it or don't

---

## PHASE 1 BUILD SCOPE (what to build first)

Keep it lean. Build only:
1. Landing page with clear value prop and pricing
2. Sign up / login
3. Single audit flow: URL input → description → run audit → view report
4. Playwright integration: functional flows, broken links, console errors, network failures
5. axe-core integration for accessibility
6. Lighthouse integration for performance
7. Claude API integration for analysis and report generation
8. Report page with ShipScore, all issue categories, risk/rewards/future recommendations
9. Stripe checkout for Builder plan

Do NOT build in Phase 1: team features, API access, white-label, PDF export, Docker self-hosted image, mobile viewport testing. Ship Phase 1 first. Get real users. Then iterate.

---

## IMPORTANT INSTRUCTIONS FOR CLAUDE CODE

- Build this as a full-stack application, not a prototype
- Write production-quality code with proper error handling
- All Playwright, axe-core, and Lighthouse runs happen server-side — never in the browser
- The Claude API call happens server-side — never expose the API key to the client
- Store all API keys in environment variables (.env)
- Implement the job queue pattern — do not run audits synchronously
- The app must work end-to-end: a user can sign up, paste a URL, run a full audit, and see a real comprehensive report
- Use TypeScript throughout
- Build the Docker deployment path in parallel with the web app — same codebase, different env config
- Include a README with setup instructions, all environment variables, deployment steps, and Docker usage

---

## STARTER FILE STRUCTURE SUGGESTION

```
caniship/
├── app/
│   ├── page.tsx                  (landing page)
│   ├── dashboard/page.tsx        (audit history)
│   ├── audit/new/page.tsx        (new audit form)
│   ├── report/[id]/page.tsx      (audit report view)
│   └── api/
│       ├── audit/route.ts        (creates job, queues audit)
│       ├── audit/[id]/route.ts   (polls job status)
│       └── reports/route.ts      (fetch/save reports)
├── lib/
│   ├── playwright-runner.ts      (functional + link + console + network testing)
│   ├── axe-runner.ts             (accessibility audit via axe-core)
│   ├── lighthouse-runner.ts      (performance audit)
│   ├── security-checker.ts       (security surface checks)
│   ├── claude-analyzer.ts        (Claude API integration — sends all results, gets report)
│   ├── report-generator.ts       (formats the final unified report)
│   └── job-queue.ts              (BullMQ or Supabase-polling worker)
├── components/
│   ├── ShipScore.tsx
│   ├── ShipVerdict.tsx
│   ├── BugCard.tsx
│   ├── RiskSection.tsx
│   ├── RewardsSection.tsx
│   ├── FutureRecommendations.tsx
│   ├── AuditForm.tsx
│   └── ReportView.tsx
├── docker/
│   ├── Dockerfile
│   └── docker-entrypoint.sh      (license key check for self-hosted)
└── README.md
```

---

## FINAL NOTE

This product exists because solo builders and vibe coders are shipping broken apps every day — not because they're lazy, but because they're moving fast and working alone. They don't need a watered-down "vibe check." They need a real QA audit they can actually afford and understand.

CanIShip is the rigorous, honest technical friend they don't have. Build it with that empathy and that standard baked into every screen.
