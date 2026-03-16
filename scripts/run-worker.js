/**
 * Standalone worker process
 * Run: node --require tsx/cjs scripts/run-worker.js
 * Or:  npm run worker
 *
 * This runs the audit job processor independently of the Next.js app.
 * Required for production: long-running audits should not block API routes.
 */

async function main() {
  console.log('[CanIShip Worker] Starting...')
  console.log('[CanIShip Worker] Mode:', process.env.REDIS_URL ? 'BullMQ (Redis)' : 'Supabase polling')

  try {
    const { initBullMQWorker, startPollingWorker } = await import('../lib/job-queue.ts')

    if (process.env.REDIS_URL) {
      await initBullMQWorker()
      console.log('[CanIShip Worker] BullMQ worker started. Waiting for jobs...')
    } else {
      console.log('[CanIShip Worker] Polling Supabase for queued jobs every 5s...')
      await startPollingWorker()
    }
  } catch (err) {
    console.error('[CanIShip Worker] Failed to start:', err)
    process.exit(1)
  }
}

process.on('SIGTERM', () => {
  console.log('[CanIShip Worker] SIGTERM received. Shutting down...')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('[CanIShip Worker] SIGINT received. Shutting down...')
  process.exit(0)
})

main()
