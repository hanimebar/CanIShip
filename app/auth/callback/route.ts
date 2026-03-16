/**
 * GET /auth/callback — Supabase Auth callback handler
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { sendWelcomeEmail } from '@/lib/welcome-email'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') || '/dashboard'

  if (code) {
    const cookieStore = cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: Record<string, unknown>) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: Record<string, unknown>) {
            cookieStore.set({ name, value: '', ...options })
          },
        },
      }
    )

    await supabase.auth.exchangeCodeForSession(code)

    // Send welcome email for new users (created within the last 5 minutes)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.email && user.created_at) {
        const ageMs = Date.now() - new Date(user.created_at).getTime()
        if (ageMs < 5 * 60 * 1000) {
          const name = user.user_metadata?.full_name || user.user_metadata?.name || undefined
          await sendWelcomeEmail(user.email, name)
        }
      }
    } catch {
      // Non-fatal — don't block redirect if email fails
    }
  }

  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'caniship.actvli.com'
  const proto = req.headers.get('x-forwarded-proto') || 'https'
  return NextResponse.redirect(new URL(next, `${proto}://${host}`))
}
