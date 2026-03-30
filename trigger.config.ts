import { defineConfig } from '@trigger.dev/sdk/v3'
import { playwright } from '@trigger.dev/build/extensions/playwright'

/**
 * Trigger.dev v3 configuration for CanIShip.
 *
 * This replaces the BullMQ/polling worker for cloud deployments.
 * Self-hosted Docker mode continues to use the built-in polling worker.
 *
 * To get started:
 *   1. npx trigger.dev@latest login
 *   2. npx trigger.dev@latest init  (copies your project ID into TRIGGER_PROJECT_ID)
 *   3. Set TRIGGER_SECRET_KEY in your Vercel/Railway environment
 *   4. npx trigger.dev@latest deploy
 *
 * The playwright() build extension bundles Chromium into the task image so
 * Playwright works inside Trigger.dev's containerised task runner.
 */
export default defineConfig({
  project: 'proj_adcysewpsadafgxeiqnh',

  // Deep audits run Playwright across 12 pages + Lighthouse + Claude — allow up to 35 min
  maxDuration: 2100, // seconds (35 min)

  build: {
    extensions: [
      playwright(),
    ],
  },

  retries: {
    enabledInDev: false,
    default: {
      maxAttempts: 2,
      minTimeoutInMs: 5_000,
      maxTimeoutInMs: 30_000,
      factor: 2,
    },
  },

})
