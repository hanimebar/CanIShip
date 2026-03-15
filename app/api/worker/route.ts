/**
 * GET /api/worker — Internal endpoint to signal the polling worker to start
 *
 * This API route does NOT import the job-queue or any heavy runner modules.
 * In production: run `npm run worker` as a separate process.
 * This endpoint is for development convenience only.
 */

import { NextRequest, NextResponse } from 'next/server'
import path from 'path'

export const runtime = 'nodejs'

let workerStarted = false

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const workerSecret = process.env.WORKER_SECRET || 'caniship-worker-internal'

  if (authHeader !== `Bearer ${workerSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (workerStarted) {
    return NextResponse.json({ status: 'already_running' })
  }

  workerStarted = true

  // Load job-queue at runtime via a computed path to prevent webpack bundling
  const queuePath = path.join(process.cwd(), '.next', 'server', 'lib', 'job-queue.js')

  setTimeout(async () => {
    try {
      // Use eval-wrapped require to prevent webpack static analysis
      // This is intentional — we need runtime-only loading of heavy modules
      // eslint-disable-next-line no-new-func
      const runtimeRequire = new Function('p', 'return require(p)') as (p: string) => { startPollingWorker: () => Promise<void> }
      const jobQueue = runtimeRequire(queuePath)
      await jobQueue.startPollingWorker()
    } catch (err) {
      console.error('[Worker API] Failed to start worker:', err)
      workerStarted = false
    }
  }, 100)

  return NextResponse.json({
    status: 'started',
    message: 'For production: run npm run worker as a separate process.',
  })
}
