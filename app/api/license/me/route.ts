/**
 * GET /api/license/me — Returns the authenticated user's Docker license key
 * Only available to Studio plan users
 */

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

export async function GET() {
  const cookieStore = cookies()
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )

  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseServiceClient()

  // Verify Studio plan
  const { data: profile } = await supabase
    .from('profiles')
    .select('plan')
    .eq('id', user.id)
    .single()

  if (profile?.plan !== 'studio') {
    return NextResponse.json({ error: 'Studio plan required' }, { status: 403 })
  }

  const { data: license } = await supabase
    .from('docker_licenses')
    .select('license_key, active, created_at')
    .eq('user_id', user.id)
    .single()

  if (!license) {
    return NextResponse.json({ error: 'No license key found' }, { status: 404 })
  }

  return NextResponse.json(license)
}
