#!/bin/sh
set -e

echo ""
echo "  CanIShip — Self-Hosted Edition"
echo "  ================================"
echo ""

# ── Validate required env vars ─────────────────────────────────────────────

if [ -z "$LICENSE_KEY" ]; then
  echo "ERROR: LICENSE_KEY is not set."
  echo ""
  echo "  1. Log in to https://caniship.actvli.com"
  echo "  2. Go to Settings → Docker License"
  echo "  3. Copy your license key"
  echo "  4. Restart with:  docker run -e LICENSE_KEY=your-key-here ..."
  echo ""
  exit 1
fi

if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "ERROR: ANTHROPIC_API_KEY is not set."
  echo ""
  echo "  Get a key at https://console.anthropic.com"
  echo "  Then restart with:  docker run -e ANTHROPIC_API_KEY=sk-... ..."
  echo ""
  exit 1
fi

# ── Validate license against caniship.actvli.com ───────────────────────────

echo "Validating license key..."

VALIDATE_RESPONSE=$(node -e "
const https = require('https');
const body = JSON.stringify({ key: process.env.LICENSE_KEY });
const req = https.request({
  hostname: 'caniship.actvli.com',
  path: '/api/license/validate',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
}, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    try {
      const j = JSON.parse(d);
      if (res.statusCode === 200 && j.valid) { process.stdout.write('VALID'); process.exit(0); }
      process.stdout.write('INVALID:' + (j.error || 'unknown'));
      process.exit(1);
    } catch { process.stdout.write('INVALID:parse_error'); process.exit(1); }
  });
});
req.on('error', e => { process.stdout.write('OFFLINE:' + e.message); process.exit(2); });
req.setTimeout(8000, () => { req.destroy(); process.stdout.write('OFFLINE:timeout'); process.exit(2); });
req.write(body); req.end();
" 2>/dev/null || echo "OFFLINE:exec_error")

if echo "$VALIDATE_RESPONSE" | grep -q "^VALID"; then
  echo "License key valid."
  mkdir -p /data
  echo "{\"last_validated\":$(date +%s)000,\"key_prefix\":\"$(echo $LICENSE_KEY | cut -c1-8)\"}" > /data/.license_state
elif echo "$VALIDATE_RESPONSE" | grep -q "^OFFLINE"; then
  OFFLINE_REASON=$(echo "$VALIDATE_RESPONSE" | sed 's/^OFFLINE://')
  # Check grace period
  if [ -f /data/.license_state ]; then
    LAST_VALIDATED=$(node -e "try{const s=JSON.parse(require('fs').readFileSync('/data/.license_state','utf8'));process.stdout.write(String(s.last_validated||0))}catch{process.stdout.write('0')}")
    NOW_MS=$(node -e "process.stdout.write(String(Date.now()))")
    ELAPSED=$(node -e "process.stdout.write(String($NOW_MS - $LAST_VALIDATED))")
    GRACE_MS=86400000
    if [ "$ELAPSED" -lt "$GRACE_MS" ]; then
      HOURS_LEFT=$(node -e "process.stdout.write(String(Math.ceil(($GRACE_MS - $ELAPSED)/3600000)))")
      echo "WARNING: Cannot reach license server ($OFFLINE_REASON). Using 24h grace period ($HOURS_LEFT h remaining)."
    else
      echo "ERROR: License validation failed ($OFFLINE_REASON) and the 24-hour grace period has expired."
      echo "Ensure internet access and an active Studio subscription at https://caniship.actvli.com"
      exit 1
    fi
  else
    echo "ERROR: Cannot validate license on first run ($OFFLINE_REASON)."
    echo "An internet connection is required for initial activation."
    exit 1
  fi
else
  INVALID_REASON=$(echo "$VALIDATE_RESPONSE" | sed 's/^INVALID://')
  echo "ERROR: License key is invalid or inactive ($INVALID_REASON)."
  echo "Check your subscription at https://caniship.actvli.com/settings"
  exit 1
fi

# ── Ensure data directory exists ────────────────────────────────────────────

mkdir -p /data

if [ -n "$OUTPUT_DIR" ]; then
  mkdir -p "$OUTPUT_DIR"
  echo "Report output directory: $OUTPUT_DIR"
fi

# ── Print config summary ────────────────────────────────────────────────────

HEADLESS="${HEADLESS:-false}"
STORAGE_MODE="SQLite (/data/caniship.db)"
if [ -n "$DATABASE_URL" ]; then
  STORAGE_MODE="Postgres (DATABASE_URL)"
fi

echo ""
echo "  Mode:      ${HEADLESS:-false}"
echo "  Storage:   $STORAGE_MODE"
echo "  Min score: ${MIN_SCORE:-not set}"
echo "  Output:    ${OUTPUT_DIR:-not set}"
echo ""

# ── Start the audit worker in the background ────────────────────────────────

node -e "
process.env.DOCKER_MODE = 'true';
require('@/lib/docker-worker').startDockerWorker().catch(e => {
  console.error('[Docker Worker] Fatal:', e);
  process.exit(1);
});
" &
WORKER_PID=$!
echo "Audit worker started (PID $WORKER_PID)"

# ── Start Next.js server ────────────────────────────────────────────────────

export DOCKER_MODE=true
export NODE_ENV=production

echo "Starting CanIShip server on port ${PORT:-3000}..."
echo ""
exec node server.js
