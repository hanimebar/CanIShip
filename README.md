# CanIShip

AI-powered app QA for solo builders. Paste a URL, get a ShipScore, know exactly what to fix before real users find it.

---

## What it does

CanIShip runs a full QA audit against any web app URL:

- **Functional testing** — Playwright navigates pages, clicks buttons, checks for broken interactions
- **Broken link detection** — Every internal link checked for 404s and network failures
- **Console error capture** — JS errors and unhandled rejections surfaced
- **Accessibility audit** — axe-core WCAG 2.1 AA (critical, serious, moderate, minor)
- **Performance audit** — Lighthouse Core Web Vitals (LCP, CLS, FCP, TTI, TBT)
- **Security surface scan** — Missing headers, HTTPS issues, exposed data
- **AI analysis** — Claude synthesizes all findings into a plain-English report with ShipScore (0-100)

---

## Tech stack

- **Next.js 14** (App Router, TypeScript, Tailwind CSS)
- **Supabase** (Auth, Postgres, Storage)
- **Playwright** (functional + link + console + network testing)
- **axe-core** (accessibility via @axe-core/playwright)
- **Lighthouse** (performance, programmatic Node.js API)
- **Anthropic Claude API** (claude-sonnet-4-20250514)
- **Stripe** (payments)
- **BullMQ / Supabase polling** (job queue — Redis optional)
- **Railway** (Docker deployment)

---

## Local development setup

### 1. Clone and install

```bash
git clone <repo>
cd CanIShip
npm install
```

### 2. Install Playwright browsers

```bash
npx playwright install chromium
```

### 3. Set up environment variables

```bash
cp .env.example .env.local
```

Fill in all values in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_BUILDER_PRICE_ID=price_...
STRIPE_STUDIO_PRICE_ID=price_...
REDIS_URL=                          # Optional — leave blank for Supabase polling
DOCKER_MODE=false
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Set up Supabase

1. Create a new Supabase project at https://supabase.com
2. Run the schema SQL — paste contents of `supabase/schema.sql` into Supabase SQL editor
3. Create a Storage bucket named `screenshots` (set to private)
4. Enable Email auth in Supabase Auth settings
5. Set Site URL and Redirect URLs in Auth settings:
   - Site URL: `http://localhost:3000`
   - Redirect URLs: `http://localhost:3000/auth/callback`

### 5. Set up Stripe

1. Create products in Stripe dashboard:
   - Builder plan: $19/month recurring
   - Studio plan: $49/month recurring
2. Copy price IDs to `.env.local`
3. Set up webhook: endpoint `/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

For local testing, use Stripe CLI:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

### 6. Start development server

```bash
npm run dev
```

App runs at http://localhost:3000

### 7. Start the worker (required for audits to process)

In a separate terminal:

```bash
npm run worker
```

Or trigger via API in development:
```bash
curl -H "Authorization: Bearer caniship-worker-internal" http://localhost:3000/api/worker
```

Audits will not process without the worker running.

---

## Architecture

### Job queue pattern

Audits are long-running (5-30 minutes). They never run synchronously in an API route.

1. User submits audit form — `POST /api/audit` creates a job with `status: queued`
2. Worker picks up the job, sets `status: running`
3. Worker runs all audit layers: Playwright, axe, Lighthouse, Security
4. Worker calls Claude API with all results
5. Worker saves report, sets `status: complete`
6. Frontend polls `GET /api/audit/[id]` every 5 seconds
7. On `status: complete`, frontend redirects to `/report/[id]`

### Dual queue modes

- **No REDIS_URL** (default): Supabase polling — worker queries Supabase every 5s for queued jobs
- **With REDIS_URL**: BullMQ with retries, concurrency, and backoff

### Server-side only

All heavy tooling runs server-side:
- Playwright — never in browser
- axe-core — injected via Playwright server-side
- Lighthouse — Node.js programmatic API
- Claude API — never exposed to client

---

## Deployment on Railway

### Steps

1. Create a Railway project from this GitHub repo
2. Add environment variables in Railway dashboard
3. Railway detects `docker/Dockerfile` — set Docker file path to `docker/Dockerfile`
4. Add optional Redis service for BullMQ (`REDIS_URL`)
5. Set custom domain: `caniship.actvli.com`
   - Add CNAME in GreenGeeks DNS pointing to Railway domain
6. Update Supabase Auth redirect URLs with production domain
7. Update Stripe webhook endpoint to production URL

### Running the worker

Add a second Railway service (same repo) with start command:
```
node scripts/run-worker.js
```

---

## Docker self-hosted (Studio plan)

```bash
docker run -d \
  -p 3000:3000 \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -e DOCKER_LICENSE_KEY=cis_... \
  -v $(pwd)/caniship-data:/app/data \
  --name caniship \
  caniship/caniship
```

Open http://localhost:3000 — no signup required in Docker mode.

License keys available at https://caniship.actvli.com/pricing (Studio plan).

---

## Environment variables reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `ANTHROPIC_API_KEY` | Yes | Claude API key |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret |
| `STRIPE_BUILDER_PRICE_ID` | Yes | Stripe price ID for Builder plan |
| `STRIPE_STUDIO_PRICE_ID` | Yes | Stripe price ID for Studio plan |
| `REDIS_URL` | No | Redis URL (enables BullMQ mode) |
| `DOCKER_MODE` | No | Set `true` in Docker self-hosted |
| `DOCKER_LICENSE_KEY` | Docker only | Studio license key |
| `NEXT_PUBLIC_APP_URL` | Yes | Full app URL for Stripe redirects |
| `WORKER_SECRET` | No | Auth token for `/api/worker` endpoint |

---

## Plans and limits

| Feature | Free | Builder ($19/mo) | Studio ($49/mo) |
|---------|------|-------------------|-----------------|
| Audits/month | 3 | 20 | Unlimited |
| Scan depth | Quick only | All depths | All depths |
| Full reports | No | Yes | Yes |
| Risk and Rewards | No | Yes | Yes |
| Future Recommendations | No | Yes | Yes |
| Audit history | No | Yes | Yes |
| Docker self-hosted | No | No | Yes |

---

## File structure

```
CanIShip/
├── app/
│   ├── page.tsx                    Landing page
│   ├── dashboard/page.tsx          Audit history
│   ├── audit/new/page.tsx          New audit form
│   ├── audit/[id]/status/page.tsx  Polling status page
│   ├── report/[id]/page.tsx        Full report view
│   ├── login/page.tsx              Login
│   ├── signup/page.tsx             Signup
│   ├── pricing/page.tsx            Pricing
│   └── api/                        API routes
├── components/
│   ├── ShipScore.tsx               Animated score circle
│   ├── ShipVerdict.tsx             YES/NO/CONDITIONAL
│   ├── BugCard.tsx                 Issue card
│   ├── RiskSection.tsx             Production risks
│   ├── RewardsSection.tsx          What is working
│   ├── FutureRecommendations.tsx   Roadmap
│   ├── AuditForm.tsx               Audit intake form
│   └── ReportView.tsx              Full report layout
├── lib/
│   ├── supabase.ts                 Clients + types
│   ├── playwright-runner.ts        Browser automation
│   ├── axe-runner.ts               Accessibility
│   ├── lighthouse-runner.ts        Performance
│   ├── security-checker.ts         Security scan
│   ├── claude-analyzer.ts          Claude API
│   ├── report-generator.ts         Report normalizer
│   └── job-queue.ts                Worker
├── supabase/schema.sql             Database schema
├── docker/Dockerfile               Production image
├── docker/docker-entrypoint.sh     License validation
├── scripts/run-worker.js           Standalone worker
└── .env.example                    Environment template
```

---

Built by Actvli Responsible Consulting — https://actvli.com
