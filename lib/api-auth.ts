/**
 * API key authentication.
 * Supports both session (Supabase cookie) and programmatic (Bearer token) auth.
 *
 * ── SQL to run in Supabase before using this ────────────────────────────────
 *
 *   CREATE TABLE IF NOT EXISTS api_keys (
 *     id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 *     name         TEXT NOT NULL,
 *     key_hash     TEXT NOT NULL UNIQUE,   -- SHA-256 hex of the raw key
 *     key_prefix   TEXT NOT NULL,          -- e.g. "cis_a1b2c3d4" (display only)
 *     last_used_at TIMESTAMPTZ,
 *     created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
 *   );
 *   CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON api_keys(user_id);
 *   CREATE INDEX IF NOT EXISTS api_keys_key_hash_idx ON api_keys(key_hash);
 *
 * ────────────────────────────────────────────────────────────────────────────
 */

import { createHash, randomBytes } from 'crypto'
import { createSupabaseServiceClient } from './supabase'

export type AuthResult =
  | { authenticated: true; userId: string; via: 'session' | 'api_key' }
  | { authenticated: false; error: string }

/**
 * Resolve a raw API key (from Authorization: Bearer header) to a userId.
 * Updates last_used_at asynchronously — does not block the request.
 */
export async function resolveApiKey(rawKey: string): Promise<AuthResult> {
  if (!rawKey.startsWith('cis_')) {
    return { authenticated: false, error: 'Invalid API key format' }
  }

  const hash = createHash('sha256').update(rawKey).digest('hex')
  const supabase = createSupabaseServiceClient()

  const { data, error } = await supabase
    .from('api_keys')
    .select('user_id, id')
    .eq('key_hash', hash)
    .single()

  if (error || !data) {
    return { authenticated: false, error: 'Invalid API key' }
  }

  // Fire-and-forget — do not block the request on this
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {})

  return { authenticated: true, userId: data.user_id, via: 'api_key' }
}

/**
 * Generate a new API key.
 * Returns the raw key (must be shown to user once), its SHA-256 hash (stored),
 * and a display prefix (stored + shown in key list).
 */
export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const entropy = randomBytes(30).toString('hex')
  const raw = `cis_${entropy}`
  const hash = createHash('sha256').update(raw).digest('hex')
  const prefix = raw.slice(0, 12) // "cis_" + 8 entropy chars
  return { raw, hash, prefix }
}
