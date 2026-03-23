# ────────────────────────────────────────────────────────────────────────────
# CanIShip — Self-Hosted Docker Image
#
# Multi-stage build:
#   1. deps        — install production node_modules
#   2. builder     — build Next.js standalone output (no source maps)
#   3. runner      — lean production image with Playwright Chromium
#
# Usage:
#   docker build -t caniship/caniship .
#   docker run -p 3000:3000 \
#     -e LICENSE_KEY=your-key \
#     -e ANTHROPIC_API_KEY=sk-... \
#     -v caniship-data:/data \
#     caniship/caniship
# ────────────────────────────────────────────────────────────────────────────

ARG NODE_VERSION=20

# ── Stage 1: Install dependencies ───────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts


# ── Stage 2: Build ──────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS builder

WORKDIR /app

# Copy all deps (including devDeps for build)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .

# Build Next.js standalone output — no source maps shipped in the image
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# Verify standalone output was created
RUN test -f .next/standalone/server.js || (echo "Standalone build failed" && exit 1)


# ── Stage 3: Production runner ───────────────────────────────────────────────
FROM node:${NODE_VERSION}-bookworm-slim AS runner

# Install Playwright system dependencies + Chromium
# (Chromium binary is installed via npm postinstall in the deps copy below)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 \
    libpangocairo-1.0-0 libx11-6 libx11-xcb1 libxcb1 libxext6 \
    libxss1 libxtst6 ca-certificates fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy standalone build output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy lib/ (runner modules are loaded at runtime, not bundled by webpack)
COPY --from=builder /app/lib ./lib

# Copy runtime node_modules (including native binaries like better-sqlite3)
COPY --from=deps /app/node_modules ./node_modules

# Install Playwright's Chromium binary
RUN npx playwright install chromium --with-deps 2>/dev/null || \
    node -e "const {chromium} = require('playwright'); chromium.executablePath()" 2>/dev/null || true

# Entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Data volume for SQLite DB + license state + report output
VOLUME ["/data"]

# Non-root user for security
RUN groupadd -r caniship && useradd -r -g caniship -d /app caniship
RUN mkdir -p /data && chown -R caniship:caniship /app /data
USER caniship

ENV NODE_ENV=production
ENV DOCKER_MODE=true
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/docker-health', r => { process.exit(r.statusCode === 200 ? 0 : 1) }).on('error', () => process.exit(1))"

ENTRYPOINT ["/docker-entrypoint.sh"]
