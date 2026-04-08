/**
 * POST /api/audit/[id]/cancel — Cancel a running or queued audit
 *
 * Marks the job as failed with a user-initiated cancellation message.
 * The underlying Trigger.dev/worker task may still be running briefly
 * but the UI will immediately show the cancelled state.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

function createServerSupabase() {
  const cookieStore = cookies()
  return createServerClient(
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
}

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    if (!id) {
      return NextResponse.json({ error: 'Job ID required' }, { status: 400 })
    }

    const serviceClient = createSupabaseServiceClient()

    // Verify ownership and that the job is still cancellable
    const { data: job, error: jobError } = await serviceClient
      .from('audit_jobs')
      .select('id, status, user_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    if (job.status === 'complete' || job.status === 'failed') {
      return NextResponse.json({ error: 'Job already finished' }, { status: 409 })
    }

    await serviceClient
      .from('audit_jobs')
      .update({
        status: 'failed',
        error_message: 'Cancelled by user',
        completed_at: new Date().toISOString(),
      })
      .eq('id', id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[API] Cancel audit error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
