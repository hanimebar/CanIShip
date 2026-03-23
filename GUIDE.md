# CanIShip — User Guide
### From Installation to Your First Quality Audit

---

## Table of Contents

1. [What Is CanIShip?](#1-what-is-caniship)
2. [What You Need Before You Start](#2-what-you-need-before-you-start)
3. [Step 1 — Set Up Supabase (Your Database)](#3-step-1--set-up-supabase-your-database)
4. [Step 2 — Set Up Stripe (Payments)](#4-step-2--set-up-stripe-payments)
5. [Step 3 — Get Your Anthropic API Key](#5-step-3--get-your-anthropic-api-key)
6. [Step 4 — Install the App on Your Machine](#6-step-4--install-the-app-on-your-machine)
7. [Step 5 — Configure Your Environment Variables](#7-step-5--configure-your-environment-variables)
8. [Step 6 — Start the App](#8-step-6--start-the-app)
9. [Step 7 — Create Your Account](#9-step-7--create-your-account)
10. [Step 8 — Run Your First Audit](#10-step-8--run-your-first-audit)
11. [Step 9 — Read Your Report](#11-step-9--read-your-report)
12. [Understanding the ShipScore](#12-understanding-the-shipscore)
13. [Understanding Each Report Section](#13-understanding-each-report-section)
14. [Plans and What Each Unlocks](#14-plans-and-what-each-unlocks)
15. [Deploying to the Web (Railway)](#15-deploying-to-the-web-railway)
16. [Running as a Docker Container (Studio Plan)](#16-running-as-a-docker-container-studio-plan)
17. [Troubleshooting](#17-troubleshooting)

---

## 1. What Is CanIShip?

CanIShip is an AI-powered quality assurance tool. You give it the URL of your web app and a plain-English description of what it does. It then:

- Clicks through your app like a real user (Playwright)
- Finds every broken link and network failure
- Catches hidden JavaScript errors your users would never see
- Runs a full accessibility audit (WCAG 2.1 AA)
- Measures performance and Core Web Vitals (Lighthouse)
- Scans for basic security issues
- Sends all findings to Claude AI, which synthesizes everything into a structured report

The result is a **ShipScore** (0–100) and a plain-English verdict: ship it, fix these things first, or do not ship yet.

---

## 2. What You Need Before You Start

| Requirement | What it is | Cost |
|-------------|-----------|------|
| **Node.js 18+** | JavaScript runtime | Free |
| **npm** | Package manager (comes with Node.js) | Free |
| **Git** | Version control | Free |
| **A Supabase account** | Database and authentication | Free tier available |
| **An Anthropic account** | Powers the AI analysis | Pay per use (~$0.003/1K tokens) |
| **A Stripe account** | Payments (required even in development) | Free to set up |

### Install Node.js (if you don't have it)

Go to https://nodejs.org and download the LTS version. Run the installer. When done, confirm it works:

```bash
node --version
# Should print: v18.x.x or higher

npm --version
# Should print: 10.x.x or similar
```

---

## 3. Step 1 — Set Up Supabase (Your Database)

Supabase stores your user accounts and all audit results.

### 3.1 Create a project

1. Go to **https://supabase.com** and sign in (or create a free account)
2. Click **New project**
3. Choose a name (e.g. `caniship`), set a strong database password, pick a region close to you
4. Click **Create new project** — wait about 2 minutes for it to provision

### 3.2 Run the database schema

1. In your Supabase project, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Open the file `supabase/schema.sql` from the CanIShip project folder on your computer
4. Copy the entire contents and paste it into the SQL editor
5. Click **Run** (or press Ctrl+Enter / Cmd+Enter)
6. You should see "Success. No rows returned." — this means all tables were created

### 3.3 Create a storage bucket for screenshots

1. In the left sidebar, click **Storage**
2. Click **New bucket**
3. Name it exactly: `screenshots`
4. Leave it set to **Private**
5. Click **Save**

### 3.4 Configure authentication

1. In the left sidebar, click **Authentication** → **URL Configuration**
2. Set **Site URL** to: `http://localhost:3000`
3. Under **Redirect URLs**, add: `http://localhost:3000/auth/callback`
4. Click **Save**

### 3.5 Collect your credentials

1. In the left sidebar, click **Project Settings** → **API**
2. Copy and save these three values — you'll need them soon:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key (a long string starting with `eyJ`)
   - **service_role** key (another long string starting with `eyJ`) — keep this secret

---

## 4. Step 2 — Set Up Stripe (Payments)

Even in development, Stripe must be configured so the app can gate free vs paid features.

### 4.1 Create a Stripe account

Go to **https://stripe.com** and sign up. You can use test mode — no real money involved.

### 4.2 Create the two subscription products

1. In the Stripe dashboard, go to **Products** → **Add product**
2. Create the **Builder plan**:
   - Name: `Builder`
   - Price: `$19.00` per month, recurring
   - Click **Save product**
   - Copy the **Price ID** (looks like `price_1Abc...`)
3. Create the **Studio plan**:
   - Name: `Studio`
   - Price: `$49.00` per month, recurring
   - Click **Save product**
   - Copy the **Price ID** for this one too

### 4.3 Collect your Stripe credentials

1. Go to **Developers** → **API keys**
2. Copy and save:
   - **Publishable key** (starts with `pk_test_...`)
   - **Secret key** (starts with `sk_test_...`) — keep this secret

### 4.4 Set up the Stripe webhook (for local development)

Stripe needs to notify your app when a subscription is created or cancelled. For local development, use the Stripe CLI.

**Install the Stripe CLI:**

- Mac: `brew install stripe/stripe-cli/stripe`
- Windows/Linux: https://stripe.com/docs/stripe-cli#install

**Log in:**
```bash
stripe login
```

**Start forwarding (run this while developing):**
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

This will print a webhook signing secret starting with `whsec_...` — copy it.

> For production, you will create a webhook endpoint in the Stripe dashboard pointing to `https://your-domain.com/api/stripe/webhook` with events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.

---

## 5. Step 3 — Get Your Anthropic API Key

The AI analysis that generates your ShipScore and report is powered by Claude.

1. Go to **https://console.anthropic.com** and sign in (or create an account)
2. Click **API Keys** in the left sidebar
3. Click **Create Key**
4. Give it a name (e.g. `caniship-local`)
5. Copy the key — it starts with `sk-ant-...`

> You will be charged per audit. A typical audit sends roughly 5,000–15,000 tokens to Claude, costing approximately $0.02–$0.08 per audit run.

---

## 6. Step 4 — Install the App on Your Machine

Open a terminal and run:

```bash
# Clone the repository
git clone https://github.com/hanimebar/CanIShip.git

# Move into the project folder
cd CanIShip

# Install all dependencies (this may take 2-3 minutes)
npm install

# Install the Playwright browser (Chromium) used for testing
npx playwright install chromium
```

When `playwright install` finishes, you should see something like:
```
Chromium 120.0.6099.71 downloaded
```

---

## 7. Step 5 — Configure Your Environment Variables

Environment variables are how the app knows your credentials without them being hardcoded in the code.

### 7.1 Create your local config file

```bash
cp .env.example .env.local
```

### 7.2 Open `.env.local` in a text editor and fill in every value

```
# Supabase — from Step 3.5
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key...
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key...

# Anthropic — from Step 5
ANTHROPIC_API_KEY=sk-ant-...your-key...

# Stripe — from Step 4.3 and 4.4
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...       ← from stripe listen output
STRIPE_BUILDER_PRICE_ID=price_...     ← Builder plan price ID
STRIPE_STUDIO_PRICE_ID=price_...      ← Studio plan price ID

# Leave these as-is for local development
REDIS_URL=
DOCKER_MODE=false
DOCKER_LICENSE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> Do not add quotes around values. Do not commit `.env.local` to Git — it is already in `.gitignore`.

---

## 8. Step 6 — Start the App

CanIShip requires **two processes** running at the same time. Open two terminal windows (or two tabs in your terminal).

### Terminal 1 — The web server

```bash
cd CanIShip
npm run dev
```

You should see:
```
▲ Next.js 14.x.x
- Local: http://localhost:3000
- Ready in 2.3s
```

### Terminal 2 — The audit worker

```bash
cd CanIShip
npm run worker
```

You should see:
```
[worker] CanIShip audit worker started
[worker] Mode: Supabase polling
[worker] Polling for jobs every 5s...
```

> The worker is what actually runs your audits. If it is not running, submitted audits will sit in a "queued" state forever and never complete.

### Confirm it's running

Open your browser and go to **http://localhost:3000**

You should see the CanIShip landing page.

---

## 9. Step 7 — Create Your Account

1. Click **Get Started** or **Sign Up** on the landing page
2. Enter your email address and a password (minimum 8 characters)
3. Click **Create Account**
4. Check your email — Supabase will send a confirmation link
5. Click the link in the email
6. You will be redirected back to the app, now logged in

> If you don't receive the email within a few minutes, check your spam folder. In development, you can also disable email confirmation in Supabase: **Authentication → Providers → Email → disable "Confirm email"**.

---

## 10. Step 8 — Run Your First Audit

### 10.1 Go to the new audit page

Click **New Audit** in the navigation, or go to **http://localhost:3000/audit/new**

### 10.2 Fill in the audit form

You will see four fields:

---

**Field 1: App URL**

Paste the full URL of the app you want to test.

```
https://your-app.com
```

- Must start with `https://` or `http://`
- Must be a publicly accessible URL (not `localhost` — the testing engine runs on the server)
- If testing a local app, use a tunneling tool like [ngrok](https://ngrok.com): `ngrok http 3000` → use the `https://xxx.ngrok.io` URL

---

**Field 2: What does this app do?**

Write a plain-English description of your app. The more detail, the better the audit.

Good example:
```
It's a task manager. Users sign up with email and password.
After logging in they see a dashboard with their tasks.
They can create a new task with a title and due date, mark
tasks as complete, and delete tasks. There is also a profile
page where they can update their name and change their password.
```

Bad example:
```
A to-do app.
```

The description is what tells Claude what your app is supposed to do, so it can judge whether it actually does it.

---

**Field 3: Specific flows to test (optional)**

List any specific user journeys you are worried about. One per line.

Examples:
```
Make sure the signup flow works end to end
Test that a user can create and then delete a task
Check that the password reset email is sent
Verify the checkout process completes successfully
```

Leave this blank if you want CanIShip to infer all flows from your description.

---

**Field 4: Test depth**

Choose how thorough the audit should be:

| Option | Duration | What it covers |
|--------|----------|----------------|
| **Quick Scan** | ~5 minutes | Key pages, basic flows, critical errors only |
| **Standard Check** | ~15 minutes | All flows, full accessibility, full performance |
| **Deep Audit** | ~30 minutes | Everything in Standard + edge cases, mobile viewports, exhaustive link crawl |

> Free plan users can only use Quick Scan. Builder and Studio plans unlock all depths.

---

### 10.3 Submit the audit

Click **Start Audit**.

The app will redirect you to a status page that shows:
```
Audit in progress...
Running functional tests
```

The status updates every 5 seconds. Do not close this tab. The audit is running in the background.

Typical wait times:
- Quick Scan: 3–8 minutes
- Standard Check: 10–20 minutes
- Deep Audit: 20–35 minutes

When the audit completes, the page automatically redirects to your report.

---

## 11. Step 9 — Read Your Report

The report is divided into the following sections, top to bottom:

### The header

At the top you will see:
- The URL that was tested
- The date and time of the audit
- The scan depth used

### The ShipScore and Verdict

The most important part of the report. A large number (0–100) and a verdict:

- **YES** — Ship it. The app is in good shape.
- **CONDITIONAL** — Ship it only after fixing the items listed under Top 5 Fixes.
- **NO** — Do not ship. Critical issues were found that would harm your users.

### Top 5 Fixes

Directly below the verdict. These are the five most important things to fix, in priority order. Start here.

### Plain English Summary

A 3–4 sentence summary written for a non-technical founder. Read this if you want the short version.

### Critical Bugs (red)

Things that are broken and will affect your users immediately. Examples:
- A button that does nothing when clicked
- A form that submits but shows no confirmation and saves nothing
- A page that returns a blank screen

### UX Issues (orange)

Things that technically work but feel broken or confusing. Examples:
- No loading spinner during a slow operation
- Error messages that say "Something went wrong" with no detail
- A button that is too small to tap on mobile

### Accessibility Violations (purple)

WCAG 2.1 AA failures, sorted by severity (critical → minor). Examples:
- Images with no alt text
- Form inputs with no label
- Text with insufficient color contrast

### Performance Issues (blue)

Core Web Vitals failures. Examples:
- LCP (Largest Contentful Paint) over 2.5 seconds
- Cumulative Layout Shift (CLS) over 0.1
- Render-blocking scripts

### Security Flags (dark red)

Basic security issues. Examples:
- Missing Content-Security-Policy header
- Pages that should require login but are accessible without it
- Sensitive data visible in the page URL

### Warnings (yellow)

Minor issues that won't block launch but should be addressed soon.

### What Passed (green)

A list of everything that worked correctly. Read this to understand what your app does well.

### Risk Assessment

What could go wrong in production if shipped as-is. For example: "Users are likely to abandon the signup flow because the error state on invalid email addresses shows nothing."

### Rewards

What is working well and why it matters for your business. For example: "The onboarding flow is clear and gets users to their first task in under 60 seconds — this directly reduces churn."

### Future Recommendations

Improvements beyond the current bugs. Things like: "Consider adding a keyboard shortcut for creating a new task" or "Images are unoptimized — switching to WebP would cut page weight by ~40%."

---

## 12. Understanding the ShipScore

| Score | Verdict | Meaning |
|-------|---------|---------|
| 90–100 | Ship it | The app is solid. Known issues are minor. |
| 70–89 | Almost there | Fix the top issues first, then ship. |
| 50–69 | Not yet | Significant work needed before launch. |
| 0–49 | Do not ship | Critical issues found. Would damage user trust. |

The score is calculated by Claude based on the severity and volume of issues found across all audit layers. A single critical bug (e.g. login is broken) will dramatically lower the score even if everything else is fine.

---

## 13. Understanding Each Report Section

### What the colors mean

| Color | Category | Action required? |
|-------|----------|-----------------|
| Red | Critical Bug | Yes — fix before shipping |
| Orange | UX Issue | Yes — high priority |
| Purple | Accessibility | Yes (critical/serious) / Soon (moderate/minor) |
| Blue | Performance | Yes if score < 70 |
| Dark Red | Security | Yes — fix before shipping |
| Yellow | Warning | Soon — not blocking |
| Green | Passed | No action needed |

### What each issue card contains

Every issue card shows:
- **What happened** — what the tester observed
- **What should have happened** — the expected behaviour
- **Where** — the URL or element where the issue was found
- **Screenshot** — a screenshot taken at the moment the issue was detected (where applicable)
- **Suggested fix** — a concrete action you can take

---

## 14. Plans and What Each Unlocks

| Feature | Free | Builder ($19/mo) | Studio ($49/mo) |
|---------|------|-------------------|-----------------|
| Audits per month | 3 | 20 | Unlimited |
| Quick Scan | Yes | Yes | Yes |
| Standard Check | No | Yes | Yes |
| Deep Audit | No | Yes | Yes |
| Full reports (Risk, Rewards, Recommendations) | No | Yes | Yes |
| Audit history and re-testing | No | Yes | Yes |
| Docker self-hosted image | No | No | Yes |

### To upgrade

1. Click **Upgrade** in the navigation or go to **/pricing**
2. Select a plan and click **Get Started**
3. You will be redirected to Stripe's secure checkout
4. Enter your card details and confirm
5. You are redirected back to the app — your new plan is active immediately

---

## 15. Deploying to the Web (Railway)

When you are ready to put CanIShip on the internet as a live app:

### 15.1 Create a Railway project

1. Go to **https://railway.app** and sign in
2. Click **New Project** → **Deploy from GitHub repo**
3. Connect your GitHub account and select the `CanIShip` repository
4. Railway will detect the `docker/Dockerfile` automatically

### 15.2 Add environment variables

1. In your Railway project, click the service → **Variables**
2. Add every variable from your `.env.local` file
3. Change `NEXT_PUBLIC_APP_URL` to your production URL (e.g. `https://caniship.actvli.com`)
4. Change `DOCKER_MODE` to `false`

### 15.3 Add the worker as a second service

1. In Railway, click **New Service** → **GitHub repo** → same repository
2. Set the start command to: `node scripts/run-worker.js`
3. Add the same environment variables to this service

### 15.4 Set up your domain

1. In Railway, go to your main service → **Settings** → **Custom Domain**
2. Add your domain (e.g. `caniship.actvli.com`)
3. In your DNS provider (GreenGeeks), add a CNAME record:
   - Name: `caniship`
   - Value: the Railway-provided domain (e.g. `xxx.up.railway.app`)

### 15.5 Update Supabase and Stripe for production

**Supabase:**
1. Go to **Authentication** → **URL Configuration**
2. Change Site URL to: `https://caniship.actvli.com`
3. Add redirect URL: `https://caniship.actvli.com/auth/callback`

**Stripe:**
1. Go to **Developers** → **Webhooks** → **Add endpoint**
2. URL: `https://caniship.actvli.com/api/stripe/webhook`
3. Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
4. Copy the new signing secret and update `STRIPE_WEBHOOK_SECRET` in Railway

---

## 16. Running as a Docker Container (Studio Plan)

Studio plan subscribers can run CanIShip entirely on their own machine. No data leaves your network.

### Requirements

- Docker Desktop installed (https://www.docker.com/products/docker-desktop)
- A Studio plan license key (from your account at caniship.actvli.com)
- An Anthropic API key

### Run the container

```bash
docker run -d \
  -p 3000:3000 \
  -e ANTHROPIC_API_KEY=sk-ant-...your-key... \
  -e DOCKER_LICENSE_KEY=cis_...your-license-key... \
  -v $(pwd)/caniship-data:/app/data \
  --name caniship \
  hanimebar/caniship
```

**On Windows (Command Prompt):**
```cmd
docker run -d -p 3000:3000 -e ANTHROPIC_API_KEY=sk-ant-... -e DOCKER_LICENSE_KEY=cis_... -v %cd%/caniship-data:/app/data --name caniship hanimebar/caniship
```

Open **http://localhost:3000** in your browser. No account needed — Docker mode is single-user with no authentication.

### Stop the container

```bash
docker stop caniship
```

### Restart it later

```bash
docker start caniship
```

### Update to the latest version

```bash
docker pull hanimebar/caniship
docker stop caniship && docker rm caniship
# Re-run the docker run command above
```

---

## 17. Troubleshooting

---

**Audits stay in "queued" status and never start**

The worker is not running. Open a second terminal and run:
```bash
npm run worker
```

---

**"Failed to launch Chromium" error in the worker**

Playwright's browser wasn't installed. Run:
```bash
npx playwright install chromium
```

---

**"Invalid Supabase credentials" or blank dashboard**

Check that your `.env.local` values for `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correct. They must match what is in your Supabase project's API settings exactly.

---

**Signup works but I am not redirected back correctly**

Make sure the redirect URL in Supabase → Authentication → URL Configuration includes:
```
http://localhost:3000/auth/callback
```

---

**Stripe checkout opens but returns me to a broken page**

Make sure `NEXT_PUBLIC_APP_URL` in `.env.local` is set to `http://localhost:3000` (no trailing slash).

---

**I see "STRIPE_WEBHOOK_SECRET not set" errors**

The Stripe CLI must be running in a separate terminal to forward webhooks locally:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```
Copy the `whsec_...` secret it prints and put it in `.env.local`.

---

**The audit runs but the report is empty or shows an error**

This usually means the Claude API call failed. Check:
- `ANTHROPIC_API_KEY` is set correctly in `.env.local`
- Your Anthropic account has available credits
- The worker terminal — it will print the error from the API call

---

**Port 3000 is already in use**

Another process is using the port. Either stop it, or start CanIShip on a different port:
```bash
PORT=3001 npm run dev
```
Remember to update `NEXT_PUBLIC_APP_URL` to `http://localhost:3001` as well.

---

*Built by Äctvli Responsible Consulting — https://actvli.com*
*Contact: reachout@actvli.com*
