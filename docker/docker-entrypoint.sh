#!/bin/bash
# CanIShip Docker Entrypoint
# Validates license key for Studio self-hosted mode

set -e

echo ""
echo "  CanIShip — Self-hosted Docker"
echo "  ================================"
echo ""

# Check for required ANTHROPIC_API_KEY
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "  ERROR: ANTHROPIC_API_KEY is required."
  echo ""
  echo "  Run: docker run -p 3000:3000 -e ANTHROPIC_API_KEY=sk-... caniship/caniship"
  echo ""
  exit 1
fi

# Validate Docker license key
if [ -z "$DOCKER_LICENSE_KEY" ]; then
  echo "  ERROR: DOCKER_LICENSE_KEY is required for self-hosted mode."
  echo ""
  echo "  Self-hosted Docker requires a Studio plan license key."
  echo "  Purchase at: https://caniship.actvli.com/pricing"
  echo ""
  echo "  Run: docker run -p 3000:3000 -e ANTHROPIC_API_KEY=sk-... -e DOCKER_LICENSE_KEY=cis_... caniship/caniship"
  echo ""
  exit 1
fi

# Validate license key format (cis_<32 chars>)
if [[ ! "$DOCKER_LICENSE_KEY" =~ ^cis_[a-zA-Z0-9]{32}$ ]]; then
  echo "  ERROR: Invalid license key format."
  echo ""
  echo "  License keys start with 'cis_' followed by 32 characters."
  echo "  Purchase or recover your key at: https://caniship.actvli.com/pricing"
  echo ""
  exit 1
fi

# Optional: Verify license with CanIShip API (requires internet — skip if offline mode)
if [ "${OFFLINE_MODE:-false}" != "true" ]; then
  echo "  Validating license key..."

  VALIDATE_RESPONSE=$(curl -s -w "\n%{http_code}" \
    -X POST "https://caniship.actvli.com/api/license/validate" \
    -H "Content-Type: application/json" \
    -d "{\"key\": \"$DOCKER_LICENSE_KEY\"}" \
    --max-time 10 2>/dev/null || echo "error")

  HTTP_CODE=$(echo "$VALIDATE_RESPONSE" | tail -1)

  if [ "$HTTP_CODE" = "200" ]; then
    echo "  License key valid."
  elif [ "$HTTP_CODE" = "error" ] || [ -z "$HTTP_CODE" ]; then
    echo "  WARNING: Could not reach license server. Starting in offline mode."
    echo "           Set OFFLINE_MODE=true to suppress this warning."
  else
    echo "  ERROR: License key validation failed (HTTP $HTTP_CODE)."
    echo "  Verify your key at: https://caniship.actvli.com/pricing"
    exit 1
  fi
fi

# Set Docker mode flags
export DOCKER_MODE=true

# Set data directory for local report storage
export LOCAL_DATA_DIR="${DATA_DIR:-/app/data}"
mkdir -p "$LOCAL_DATA_DIR/reports" "$LOCAL_DATA_DIR/screenshots"

echo ""
echo "  Configuration:"
echo "    Mode: Self-hosted Docker"
echo "    Data directory: $LOCAL_DATA_DIR"
echo "    Port: ${PORT:-3000}"
echo "    License: ${DOCKER_LICENSE_KEY:0:8}..."
echo ""
echo "  CanIShip is starting at http://localhost:${PORT:-3000}"
echo ""

# Execute the Next.js server
exec "$@"
