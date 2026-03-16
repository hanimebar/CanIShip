/**
 * POST /api/license/validate — Validates a Docker license key
 * Called by docker-entrypoint.sh on container startup
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let key: string | undefined

  try {
    const body = await req.json()
    key = body.key
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (!key || typeof key !== 'string') {
    return NextResponse.json({ error: 'Missing key' }, { status: 400 })
  }

  const supabase = createSupabaseServiceClient()

  const { data, error } = await supabase
    .from('docker_licenses')
    .select('active')
    .eq('license_key', key)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Invalid license key' }, { status: 401 })
  }

  if (!data.active) {
    return NextResponse.json({ error: 'License key is inactive' }, { status: 402 })
  }

  return NextResponse.json({ valid: true })
}
