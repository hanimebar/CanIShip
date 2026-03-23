# CanIShip Self-Hosted — Docker Guide

Run CanIShip on your own machine or server. No data leaves your infrastructure.

---

## Who this is for

- **Solo developers** who want to audit staging apps, local apps, or apps behind a VPN
- **Teams** who want to integrate CanIShip into a CI/CD pipeline (GitHub Actions, GitLab CI, etc.)
- **Companies** with data privacy requirements who cannot send URLs to a cloud service

You need a **Studio plan** to use the Docker image. Get one at [caniship.actvli.com/pricing](https://caniship.actvli.com/pricing).

---

## Prerequisites

| Requirement | Notes |
|-------------|-------|
| Docker | Version 20+ recommended |
| CanIShip Studio license key | From Settings → Docker License |
| Anthropic API key | From [console.anthropic.com](https://console.anthropic.com) |
| 4 GB RAM | Chromium + the AI analysis needs headroom |
| Internet access | Required on first run and every 24h to validate your license |

---

## Quick Start (5 minutes)

### 1. Get your license key

1. Log in to [caniship.actvli.com](https://caniship.actvli.com)
2. Go to **Settings → Docker License**
3. Click **Generate License Key** (or copy your existing one)

### 2. Pull the image

```bash
docker pull hanimebar/caniship:latest
```

### 3. Run it

```bash
docker run -p 3000:3000 \
  -e LICENSE_KEY=your-license-key-here \
  -e ANTHROPIC_API_KEY=sk-ant-... \
  -v caniship-data:/data \
  hanimebar/caniship
```

### 4. Open the UI

Go to [http://localhost:3000](http://localhost:3000) in your browser. That's it — the same CanIShip interface you already know, running entirely on your machine.

---

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `LICENSE_KEY` | Your Studio license key from Settings → Docker License |
| `ANTHROPIC_API_KEY` | Your Anthropic API key |

### Storage

| Variable | Default | Description |
|----------|---------|-------------|
| `SQLITE_PATH` | `/data/caniship.db` | Path to the SQLite database file inside the container |
| `DATABASE_URL` | _(not set)_ | Use Postgres instead of SQLite. Format: `postgresql://user:pass@host:5432/db` |

**SQLite** (default): zero-config, perfect for solo use. Mount a volume to persist data between restarts:
```bash
-v caniship-data:/data
```

**Postgres**: better for teams sharing a server. Pass your connection string:
```bash
-e DATABASE_URL=postgresql://user:pass@your-postgres-host:5432/caniship
```

### Output & CI

| Variable | Default | Description |
|----------|---------|-------------|
| `OUTPUT_DIR` | _(not set)_ | Directory to write report files after each audit |
| `REPORT_FORMAT` | `both` | `json`, `html`, or `both` |
| `MIN_SCORE` | `0` (disabled) | Exit with code 1 if audit score falls below this value |
| `ALLOW_PRIVATE_IPS` | `false` | Set to `true` to audit apps on your local network (e.g. `http://192.168.1.x`) |

### Advanced

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port the server listens on |
| `HEADLESS` | `false` | Set to `true` to disable the web UI (API-only mode) |
| `WEBHOOK_SECRET` | _(not set)_ | Secret for signing webhook payloads (`X-CanIShip-Signature`) |
| `CANISHIP_VERSION` | `1.0.0` | Version string returned by `/api/docker-health` |

---

## Auditing Local or Staging Apps

By default, CanIShip blocks private IP addresses to prevent SSRF attacks. To audit an app running on your local network:

```bash
docker run -p 3000:3000 \
  -e LICENSE_KEY=... \
  -e ANTHROPIC_API_KEY=... \
  -e ALLOW_PRIVATE_IPS=true \
  --network host \
  -v caniship-data:/data \
  hanimebar/caniship
```

`--network host` lets the container reach your host machine's ports. Then audit `http://localhost:your-port` or `http://192.168.x.x`.

---

## Persisting Data

Without a volume, your audit history is lost when the container stops. Mount a named volume:

```bash
# Named volume (Docker manages storage)
docker run ... -v caniship-data:/data hanimebar/caniship

# Bind mount (you choose the path)
docker run ... -v /home/you/caniship-data:/data hanimebar/caniship
```

---

## Saving Reports to Disk

To write JSON and HTML reports after every audit:

```bash
docker run -p 3000:3000 \
  -e LICENSE_KEY=... \
  -e ANTHROPIC_API_KEY=... \
  -e OUTPUT_DIR=/reports \
  -e REPORT_FORMAT=both \
  -v /home/you/audit-reports:/reports \
  -v caniship-data:/data \
  hanimebar/caniship
```

Reports are written to `/home/you/audit-reports/` on your machine, named:
```
myapp_staging_2026-03-15T10-30-00.json
myapp_staging_2026-03-15T10-30-00.html
latest.json    ← always points to the most recent audit
```

---

## Using the HTTP API

The Docker container exposes the same REST API as the cloud version. No authentication required — your license key at startup is the auth.

### Create an audit

```bash
curl -X POST http://localhost:3000/api/audit \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://staging.myapp.com",
    "description": "A SaaS app for managing project tasks. Users can sign up, create projects, add tasks, and invite team members.",
    "depth": "standard",
    "flows": ["sign up", "create project", "invite team member"]
  }'
```

Response:
```json
{ "job_id": "abc123", "status": "queued" }
```

### Poll for completion

```bash
curl http://localhost:3000/api/audit/abc123
```

Response while running:
```json
{ "status": "running", "job_id": "abc123", "started_at": "..." }
```

Response when complete:
```json
{
  "status": "complete",
  "job_id": "abc123",
  "ship_score": 84,
  "ship_verdict": "conditional",
  "completed_at": "..."
}
```

### Health check

```bash
curl http://localhost:3000/api/docker-health
# → { "status": "ok", "mode": "docker", "version": "1.0.0" }
```

---

## GitHub Actions Integration

The easiest way to run CanIShip in CI. The action starts the container, waits for it to be ready, runs your audit, saves the report as a build artifact, and optionally fails the build if the score is too low.

### Setup

1. Add your secrets in GitHub: **Settings → Secrets and Variables → Actions**
   - `CANISHIP_LICENSE_KEY` — your Studio license key
   - `ANTHROPIC_API_KEY` — your Anthropic API key

2. Add a workflow file:

**`.github/workflows/quality-gate.yml`**

```yaml
name: Quality Gate

on:
  push:
    branches: [main]
  pull_request:

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run CanIShip Audit
        uses: ./.github/actions/caniship
        with:
          url: https://staging.myapp.com
          description: >
            A project management SaaS. Users sign up, create workspaces,
            add tasks, and collaborate with their team.
          license_key: ${{ secrets.CANISHIP_LICENSE_KEY }}
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
          depth: quick
          min_score: 75
          flows: "sign up, create workspace, add task"
```

### What the action does

1. Pulls `hanimebar/caniship:latest`
2. Starts the container with your credentials
3. Waits up to 120s for the health check to pass
4. Submits the audit job
5. Polls until complete (up to 6 min for quick, 18 min for standard, 35 min for deep)
6. Prints the score and verdict to the build log
7. Uploads the JSON + HTML report as a build artifact named `caniship-report`
8. Exits with code 1 if the score is below `min_score`
9. Stops and removes the container

### Viewing the report

After the workflow runs, go to **Actions → your run → Artifacts → caniship-report** to download the full HTML report.

### Full options

```yaml
- uses: ./.github/actions/caniship
  with:
    url: https://staging.myapp.com               # required
    description: "What your app does"             # required
    license_key: ${{ secrets.CANISHIP_LICENSE_KEY }}  # required
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}  # required
    depth: standard          # quick | standard | deep  (default: quick)
    min_score: 75            # fail build if score < this  (default: 0 = disabled)
    flows: "sign up, checkout, reset password"   # comma-separated
    output_dir: caniship-reports                 # where to write files
    report_format: both                          # json | html | both
```

---

## Docker Compose

For persistent setups (e.g. a shared team server):

**`docker-compose.yml`**

```yaml
version: '3.8'

services:
  caniship:
    image: hanimebar/caniship:latest
    ports:
      - "3000:3000"
    environment:
      LICENSE_KEY: ${CANISHIP_LICENSE_KEY}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      OUTPUT_DIR: /reports
      REPORT_FORMAT: both
    volumes:
      - caniship-data:/data
      - ./audit-reports:/reports
    restart: unless-stopped

volumes:
  caniship-data:
```

```bash
# Create a .env file (never commit this)
echo "CANISHIP_LICENSE_KEY=your-key-here" >> .env
echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env

docker compose up -d
```

---

## License & Offline Use

- Your license is validated against `caniship.actvli.com` on startup
- After a successful validation, the container works **offline for up to 24 hours**
- If your internet connection is interrupted mid-use, audits will continue — the 24-hour grace period starts from your last successful validation
- If the grace period expires and the server is unreachable, the container will refuse to run new audits until connectivity is restored
- You can check when your license was last validated: `cat /data/.license_state`

---

## Source Code & Security

The Docker image ships compiled and obfuscated code — source files are not included.

- No source maps are bundled in the image
- Your `ANTHROPIC_API_KEY` is used locally and never sent to Äctvli's servers
- Audit data (jobs, reports) stays in your `/data` volume
- The only network calls from the container are:
  - License validation → `caniship.actvli.com/api/license/validate` (once per hour max)
  - The actual audit → the URL you submit
  - Webhook delivery → your `callback_url`, if configured

---

## Troubleshooting

### Container exits immediately
Check `docker logs <container-id>`. The most common causes:
- `LICENSE_KEY` is missing or invalid
- `ANTHROPIC_API_KEY` is missing
- No internet access on first run (license can't be validated)

### Audit stays in "queued" forever
The audit worker runs inside the same container. If it's not processing:
```bash
docker logs <container-id> | grep "Docker Worker"
```
If you see `[Docker Worker] Started`, the worker is running and will pick up the job within 3 seconds.

### Can't audit my local app
Add `-e ALLOW_PRIVATE_IPS=true` and `--network host` to your docker run command.

### Score seems low for a known-good app
Use `depth: standard` or `depth: deep` for a more thorough audit. Quick audits are fast but use limited browser interaction.

### Disk space
Each audit with reports enabled writes ~1–5 MB of files. Clean up periodically:
```bash
docker exec <container> find /data -name "*.json" -mtime +30 -delete
```

---

## Updating

```bash
docker pull hanimebar/caniship:latest
docker stop <your-container>
docker rm   <your-container>
docker run  ... hanimebar/caniship:latest  # same command as before
```

Your data volume persists across updates.

---

## Support

Questions or issues: [reachout@actvli.com](mailto:reachout@actvli.com)

License management: [caniship.actvli.com/settings](https://caniship.actvli.com/settings)
