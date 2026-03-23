/**
 * Docker license validator
 *
 * Called on container startup and before each audit in Docker mode.
 * - Pings caniship.actvli.com/api/license/validate with the LICENSE_KEY
 * - On success: writes last_validated timestamp to disk
 * - On failure: checks if within 24-hour grace period
 * - Past grace period: throws — container refuses to run audits
 */

import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'

const VALIDATE_URL = 'https://caniship.actvli.com/api/license/validate'
const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000 // 24 hours
const STATE_FILE = process.env.LICENSE_STATE_FILE || '/data/.license_state'

type ValidationState = {
  last_validated: number   // Unix timestamp ms
  key_prefix: string
}

function readState(): ValidationState | null {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf-8')
    return JSON.parse(raw) as ValidationState
  } catch {
    return null
  }
}

function writeState(prefix: string): void {
  try {
    const dir = path.dirname(STATE_FILE)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    const state: ValidationState = { last_validated: Date.now(), key_prefix: prefix }
    fs.writeFileSync(STATE_FILE, JSON.stringify(state), 'utf-8')
  } catch {
    // non-fatal — grace period just won't be recorded
  }
}

async function pingValidationEndpoint(licenseKey: string): Promise<{ valid: boolean; error?: string }> {
  return new Promise((resolve) => {
    const body = JSON.stringify({ key: licenseKey })
    const url = new URL(VALIDATE_URL)

    const options: https.RequestOptions = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'CanIShip-Docker/1.0',
      },
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          const json = JSON.parse(data) as { valid?: boolean; error?: string }
          if (res.statusCode === 200 && json.valid) {
            resolve({ valid: true })
          } else {
            resolve({ valid: false, error: json.error || `HTTP ${res.statusCode}` })
          }
        } catch {
          resolve({ valid: false, error: 'Invalid response from license server' })
        }
      })
    })

    req.on('error', (err) => {
      resolve({ valid: false, error: err.message })
    })

    req.setTimeout(8000, () => {
      req.destroy()
      resolve({ valid: false, error: 'License server timeout' })
    })

    req.write(body)
    req.end()
  })
}

/**
 * Validates the Docker license key.
 * Throws if the license is invalid and the grace period has expired.
 * Returns silently if valid or within grace period.
 */
export async function validateDockerLicense(): Promise<void> {
  const licenseKey = process.env.LICENSE_KEY

  if (!licenseKey) {
    throw new Error(
      'LICENSE_KEY environment variable is not set.\n' +
      'Get your license key from https://caniship.actvli.com/settings under "Docker License".\n' +
      'Then restart with: docker run -e LICENSE_KEY=your-key-here ...'
    )
  }

  const result = await pingValidationEndpoint(licenseKey)

  if (result.valid) {
    writeState(licenseKey.slice(0, 8))
    return
  }

  // Ping failed — check grace period
  const state = readState()
  if (state) {
    const elapsed = Date.now() - state.last_validated
    if (elapsed < GRACE_PERIOD_MS) {
      const hoursRemaining = Math.ceil((GRACE_PERIOD_MS - elapsed) / (60 * 60 * 1000))
      console.warn(
        `[CanIShip] License check failed: ${result.error}. ` +
        `Using offline grace period (${hoursRemaining}h remaining).`
      )
      return
    }
    // Grace period expired
    throw new Error(
      `[CanIShip] License validation failed and the 24-hour grace period has expired.\n` +
      `Reason: ${result.error}\n` +
      `Ensure your machine has internet access and your Studio subscription is active.\n` +
      `Manage your subscription at https://caniship.actvli.com/settings`
    )
  }

  // No state file — first run with no connectivity
  throw new Error(
    `[CanIShip] Cannot validate license key on first run.\n` +
    `Reason: ${result.error}\n` +
    `An internet connection is required on the first startup to activate your license.\n` +
    `After the first successful validation, CanIShip works offline for up to 24 hours.`
  )
}

/** Quick check — only hits the network if last validation was > 1 hour ago. */
export async function checkLicenseForAudit(): Promise<void> {
  const licenseKey = process.env.LICENSE_KEY
  if (!licenseKey) throw new Error('LICENSE_KEY not set')

  const state = readState()
  if (state) {
    const elapsed = Date.now() - state.last_validated
    // Re-validate at most once per hour to avoid hammering the endpoint
    if (elapsed < 60 * 60 * 1000) return
  }

  await validateDockerLicense()
}
