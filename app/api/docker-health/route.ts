/**
 * GET /api/docker-health — Liveness probe for Docker and GitHub Actions
 *
 * Returns 200 once the container is ready to accept audit requests.
 * The GitHub Action polls this before running an audit.
 */

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

export async function GET() {
  const isDockerMode = process.env.DOCKER_MODE === 'true'

  return NextResponse.json({
    status: 'ok',
    mode: isDockerMode ? 'docker' : 'cloud',
    version: process.env.CANISHIP_VERSION || '1.0.0',
    timestamp: new Date().toISOString(),
  })
}
