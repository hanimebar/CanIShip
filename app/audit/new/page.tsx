import { redirect } from 'next/navigation'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { AuditForm } from '@/components/AuditForm'

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

export default async function NewAuditPage() {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/audit/new')
  }

  const serviceClient = createSupabaseServiceClient()
  const { data: profile } = await serviceClient
    .from('profiles')
    .select('plan, audits_used_this_month, audits_reset_at')
    .eq('id', user.id)
    .single()

  const plan = profile?.plan || 'free'
  const limits = { free: 3, builder: 20, studio: Infinity }
  const limit = limits[plan as keyof typeof limits] ?? 3
  const used = profile?.audits_used_this_month ?? 0
  const atLimit = used >= limit && limit !== Infinity

  return (
    <div className="min-h-screen bg-dark-900 text-white">

      {/* Nav */}
      <nav className="border-b border-dark-600 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-mono-brand font-bold text-neon-green text-xl">
            CanIShip
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm text-gray-400 hover:text-white transition-colors">
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">New Audit</h1>
          <p className="text-gray-400 text-sm">
            Describe your app honestly. The more detail you give, the better the audit.
          </p>
        </div>

        {atLimit ? (
          <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-6 text-center">
            <div className="text-orange-400 font-bold mb-2">Monthly limit reached</div>
            <p className="text-gray-400 text-sm mb-4">
              You have used {used}/{limit} audits this month on the {plan} plan.
            </p>
            <Link
              href="/pricing"
              className="inline-block px-6 py-2.5 bg-neon-green text-dark-900 font-bold text-sm rounded-lg hover:bg-neon-green-dim transition-colors"
            >
              Upgrade to continue
            </Link>
          </div>
        ) : (
          <div className="bg-dark-800 border border-dark-500 rounded-2xl p-8">
            {limit !== Infinity && (
              <div className="flex items-center justify-between text-xs text-gray-500 mb-6 pb-4 border-b border-dark-600">
                <span>Audits used this month</span>
                <span className="font-mono font-bold">{used} / {limit}</span>
              </div>
            )}
            <AuditForm userPlan={plan} />
          </div>
        )}

        {/* Help section */}
        <div className="mt-8 rounded-xl border border-dark-500 bg-dark-800 p-6">
          <h3 className="font-semibold text-white mb-3 text-sm">Tips for better results</h3>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex items-start gap-2">
              <span className="text-neon-green font-mono text-xs mt-0.5">→</span>
              <span>Describe what users can do in your app, not just what it is.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-neon-green font-mono text-xs mt-0.5">→</span>
              <span>List specific flows if you have them — checkout, sign up, file upload.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-neon-green font-mono text-xs mt-0.5">→</span>
              <span>Use a public URL. For auth-gated apps, use a staging URL or test account.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-neon-green font-mono text-xs mt-0.5">→</span>
              <span>Deep Audit takes ~30 min. Quick Scan is best for rapid iteration.</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}
