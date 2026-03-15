/**
 * Standalone worker process
 * Run: node scripts/run-worker.js
 * Or: npm run worker
 *
 * This runs the audit job processor independently of the Next.js app.
 * Required for production: long-running audits should not block API routes.
 */

// Load environment variables
require('dotenv').config({ path: '.env.local' })
require('dotenv').config({ path: '.env' })

const path = require('path')

// Register TypeScript paths
const { register } = require('module')
const { pathToFileURL } = require('url')

async function main() {
  console.log('[CanIShip Worker] Starting...')
  console.log('[CanIShip Worker] REDIS_URL:', process.env.REDIS_URL ? 'set (BullMQ mode)' : 'not set (Supabase polling mode)')

  try {
    // Dynamically import TypeScript modules via tsx or compiled output
    const { initBullMQWorker, startPollingWorker } = await import('../lib/job-queue.js')

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

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[CanIShip Worker] SIGTERM received. Shutting down...')
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('[CanIShip Worker] SIGINT received. Shutting down...')
  process.exit(0)
})

main()
