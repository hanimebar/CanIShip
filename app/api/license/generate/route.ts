/**
 * POST /api/license/generate — Generate a Docker license key for Studio users
 * Called on-demand when a Studio user doesn't yet have a key
 */

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createSupabaseServiceClient } from '@/lib/supabase'

export const runtime = 'nodejs'

function generateLicenseKey(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let key = 'cis_'
  for (let i = 0; i < 32; i++) {
    key += chars[Math.floor(Math.random() * chars.length)]
  }
  return key
}

export async function POST() {
  try {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name) => cookieStore.get(name)?.value } }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const serviceClient = createSupabaseServiceClient()

    // Only Studio users get a license key
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .single()

    if (profile?.plan !== 'studio') {
      return NextResponse.json({ error: 'Docker license keys are only available on the Studio plan.' }, { status: 403 })
    }

    // Upsert — create if missing, leave existing key untouched
    const { data, error } = await serviceClient
      .from('docker_licenses')
      .upsert(
        { user_id: user.id, license_key: generateLicenseKey(), active: true, updated_at: new Date().toISOString() },
        { onConflict: 'user_id', ignoreDuplicates: true }
      )
      .select('license_key')
      .single()

    if (error) {
      // If ignored due to conflict, fetch the existing key
      const { data: existing } = await serviceClient
        .from('docker_licenses')
        .select('license_key')
        .eq('user_id', user.id)
        .single()
      return NextResponse.json({ license_key: existing?.license_key })
    }

    return NextResponse.json({ license_key: data?.license_key })
  } catch (err) {
    console.error('[License] Generate error:', err)
    return NextResponse.json({ error: 'Failed to generate license key' }, { status: 500 })
  }
}
