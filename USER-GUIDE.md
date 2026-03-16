# CanIShip — User Guide
### How to audit your app for the first time

---

CanIShip tests your web app the way a real user would — clicking buttons, filling in forms, navigating pages — and then tells you exactly what is broken, slow, or inaccessible before your real users find it. You get a score and a verdict: ship it, or fix these things first.

You do not need to install anything. You just need a URL.

---

## What you need

- A web app that is live on the internet (a real URL starting with `https://`)
- An account on CanIShip (free to create)
- 5–30 minutes depending on how deep you want the audit to go

That's it.

---

## Step 1 — Create your account

Go to **caniship.actvli.com** and click **Get Started**.

Enter your email and a password, then click **Create Account**. You will receive a confirmation email — click the link inside it to activate your account.

Once confirmed, you are logged in and ready to run your first audit.

---

## Step 2 — Start a new audit

Click **New Audit** in the top navigation.

You will see a form with four fields.

---

### Field 1: Your app's URL

Paste the full URL of the app you want to test.

```
https://myapp.com
```

This must be a live, publicly accessible URL. CanIShip's testing engine runs on our servers — it cannot reach `localhost` or private networks. If your app is still running locally, use [ngrok](https://ngrok.com) to create a public tunnel first.

---

### Field 2: What does your app do?

Write a plain-English description of your app. This is what tells CanIShip what your app is supposed to do — so it can judge whether it actually does it. You can even use the AI read-me file that was created when you first prompted it to find a short description.

**Write it like you would explain it to a friend:**

> "It's a task manager. Users sign up, create tasks with a title and due date, mark them done, and delete them. There's also a profile page where they can change their password."

**Not like this:**

> "A to-do app."

The more detail you give, the more accurate and useful your report will be. Cover the main flows: signing up, the core action of your app, any settings or account management.

---

### Field 3: Specific flows to test (optional)

If there are particular things you are worried about, list them here. One per line.

Examples:
```
Make sure sign up works end to end
Test that a user can create and delete a task
Check the password reset email gets sent
Make sure the checkout completes without errors
```

Leave this blank if you want CanIShip to figure out all the flows from your description.

---

### Field 4: How deep should the audit go?

| Option | Approx. time | Best for |
|--------|-------------|----------|
| **Quick Scan** | ~5 minutes | A fast sanity check before a small release |
| **Standard Check** | ~15 minutes | A full pre-launch review |
| **Deep Audit** | ~30 minutes | A thorough audit of a complex app |

If this is your first time, **Standard Check** is a good starting point.

> Quick Scan is available on the free plan. Standard Check and Deep Audit require a Builder or Studio plan.

---

## Step 3 — Submit and wait

Click **Start Audit**.

You will be taken to a status page that shows what CanIShip is doing in real time:

```
Running functional tests...
Checking for broken links...
Running accessibility audit...
Analysing with AI...
```

Do not close the tab. The audit runs in the background and the page updates every few seconds. When it is done, you are automatically taken to your report.

Typical wait times:
- Quick Scan: 3–8 minutes
- Standard Check: 10–20 minutes
- Deep Audit: 20–35 minutes

---

## Step 4 — Read your report

The report opens automatically when the audit finishes.

---

### The ShipScore

At the top of the report is a large number from 0 to 100. This is your **ShipScore**.

| Score | Verdict | What it means |
|-------|---------|--------------|
| 90–100 | **Ship it** | Your app is in good shape. Known issues are minor. |
| 70–89 | **Almost there** | Fix the top issues listed, then ship. |
| 50–69 | **Not yet** | Significant problems that need attention before launch. |
| 0–49 | **Do not ship** | Critical issues found. Would damage user trust. |

Next to the score is a verdict in plain text: **YES**, **NO**, or **CONDITIONAL** (meaning: ship it only after the listed fixes are done).

---

### Top 5 Fixes

Immediately below the score is a prioritised list of the five most important things to fix. This is the only list that matters if you are short on time. Fix these, re-run the audit, and watch your score go up.

---

### Plain English Summary

A short paragraph written for a non-technical founder. Read this for the quick version of what was found.

---

### The rest of the report

Below the summary, the report is broken into colour-coded sections:

| Colour | Category | Should I fix this before shipping? |
|--------|----------|-----------------------------------|
| Red | **Critical Bugs** | Yes — these break your app |
| Orange | **UX Issues** | Yes — these frustrate users |
| Purple | **Accessibility Violations** | Yes (critical/serious) — legal and ethical risk |
| Blue | **Performance Issues** | Yes if score is low — users will leave |
| Dark red | **Security Flags** | Yes — fix before going live |
| Yellow | **Warnings** | Soon — not blocking but worth noting |
| Green | **What Passed** | Nothing to do — these are working well |

Each issue card tells you:
- **What happened** — what CanIShip observed
- **What should have happened** — the expected behaviour
- **Where** — the page or element where the issue occurred
- **Screenshot** — a photo of the problem, taken during the test
- **Suggested fix** — a concrete action you can take right now

---

### Risk Assessment

What could go wrong in production if you ship as-is. For example: users dropping off during sign up, trust issues, complaints.

---

### Rewards

What is working well and why it matters. Read this to understand what you are doing right.

---

### Future Recommendations

Improvements beyond the current bugs — features users will expect, performance wins, UX patterns to upgrade. These are not urgent but give you a clear roadmap for after launch.

---

## Step 5 — Fix, re-run, and compare

Fix the issues in your app, then come back and run a new audit on the same URL.

On the **Dashboard**, you can see all your past audits. When you re-run an audit after making fixes, CanIShip shows you what changed:

```
Last audit vs this audit
You fixed 6 issues. 3 remain.
ShipScore: 61 → 84
```

Keep iterating until you hit the score and verdict you are comfortable shipping at.

---

## Plans

| | Free | Builder — €19/mo | Studio — €49/mo |
|--|------|-------------------|-----------------|
| Audits per month | 1 | 10 | Unlimited |
| Quick Scan | Yes | Yes | Yes |
| Standard Check | No | Yes | Yes |
| Deep Audit | No | Yes | Yes |
| Full reports (Risk, Rewards, Recommendations) | No | Yes | Yes |
| Audit history | No | Yes | Yes |
| Self-hosted Docker image | No | No | Yes |

To upgrade, click **Upgrade** in the navigation or visit the **Pricing** page.

---

## Tips for a better audit

**Be specific in your description.** The AI uses your description to understand what your app should do. A vague description leads to a generic report. A detailed description leads to findings that are actually relevant to your app.

**List your most critical flows.** If your app has a checkout, a sign-up flow, or a core action — name it explicitly in the "specific flows" field. That way CanIShip knows to prioritise testing it.

**Use Standard Check or Deep Audit before a real launch.** Quick Scan is good for checking a single bug fix. For a real pre-launch review, give it more time to find everything.

**Re-run after fixing.** A single audit is a snapshot. The real value is in the trend — watching your ShipScore climb as you fix issues.

**Don't ignore accessibility.** Critical and serious accessibility violations are not just ethical issues — they are potential legal liabilities in many countries.

---

## Common questions

**My app requires a login. Will CanIShip still work?**

Yes. In the "specific flows" field, note that authentication is required. If you want CanIShip to test authenticated flows, include test credentials (a test account email and password) in your description. Keep these credentials disposable — do not use your real account.

**Can I test a staging URL, not my live app?**

Yes. Any publicly accessible URL works — staging, preview deployments, or live production. Staging is often a better choice so real users are not affected during testing.

**Can I test a local app on my computer?**

Not directly. CanIShip's testing engine runs on our servers and cannot reach your localhost. Use a tunnelling tool like [ngrok](https://ngrok.com) (`ngrok http 3000`) to generate a public URL, then use that URL in CanIShip.

**How is this different from running Lighthouse in Chrome DevTools?**

Lighthouse in Chrome only covers performance and basic accessibility. CanIShip runs Lighthouse plus Playwright (functional testing, broken links, console errors), axe-core (full WCAG audit), a security scan, and then sends all the results to Claude AI to synthesise a unified report with risk assessment, rewards, and a prioritised fix list. Lighthouse gives you one dimension. CanIShip gives you the full picture.

**Will CanIShip make changes to my app or database?**

No. CanIShip only reads and navigates your app. It does not write data, place orders, or trigger any irreversible actions. If your app has destructive actions (like a "delete everything" button), CanIShip may click them during testing — so run audits against a staging environment if this is a concern.

---

*Built by Äctvli Responsible Consulting — https://actvli.com*
*Questions? reachout@actvli.com*
