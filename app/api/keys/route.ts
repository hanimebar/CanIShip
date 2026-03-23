/**
 * API key management
 *
 * GET  /api/keys         — List keys for the authenticated user (no raw key — prefix + metadata only)
 * POST /api/keys         — Create a new key. Returns raw key once — never shown again.
 * DELETE /api/keys?id=   — Revoke a key by ID
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { generateApiKey } from '@/lib/api-auth'

export const runtime = 'nodejs'

function createSessionSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  )
}

async function getAuthenticatedUserId(): Promise<string | null> {
  try {
    const supabase = createSessionSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id ?? null
  } catch {
    return null
  }
}

export async function GET() {
  const userId = await getAuthenticatedUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createSupabaseServiceClient()
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, name, key_prefix, last_used_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: 'Failed to fetch keys' }, { status: 500 })
  return NextResponse.json({ keys: data })
}

export async function POST(req: NextRequest) {
  const userId = await getAuthenticatedUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : ''
  if (!name) return NextResponse.json({ error: 'Key name is required' }, { status: 400 })

  // Enforce a max of 10 keys per user
  const supabase = createSupabaseServiceClient()
  const { count } = await supabase
    .from('api_keys')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  if ((count ?? 0) >= 10) {
    return NextResponse.json({ error: 'Maximum of 10 API keys per account' }, { status: 400 })
  }

  const { raw, hash, prefix } = generateApiKey()

  const { data, error } = await supabase
    .from('api_keys')
    .insert({ user_id: userId, name, key_hash: hash, key_prefix: prefix })
    .select('id, name, key_prefix, created_at')
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to create key' }, { status: 500 })
  }

  // raw key returned once — never stored in plaintext
  return NextResponse.json({ key: { ...data, raw_key: raw } }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const userId = await getAuthenticatedUserId()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Key ID required' }, { status: 400 })

  const supabase = createSupabaseServiceClient()
  const { error } = await supabase
    .from('api_keys')
    .delete()
    .eq('id', id)
    .eq('user_id', userId) // ownership check

  if (error) return NextResponse.json({ error: 'Failed to revoke key' }, { status: 500 })
  return NextResponse.json({ success: true })
}
