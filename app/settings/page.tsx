import { redirect } from 'next/navigation'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { SettingsClient } from '@/components/SettingsClient'

function createServerSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  )
}

export default async function SettingsPage() {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login?next=/settings')

  const serviceClient = createSupabaseServiceClient()
  const [profileResult, licenseResult] = await Promise.all([
    serviceClient
      .from('profiles')
      .select('plan, stripe_customer_id')
      .eq('id', user.id)
      .single(),
    serviceClient
      .from('docker_licenses')
      .select('license_key')
      .eq('user_id', user.id)
      .eq('active', true)
      .single(),
  ])

  const profile = profileResult.data
  const plan = profile?.plan || 'free'
  const hasStripeCustomer = !!profile?.stripe_customer_id
  const licenseKey = licenseResult.data?.license_key ?? null

  // Detect OAuth users — they have no password and shouldn't see the password form
  const identities = user.identities ?? []
  const isOAuthUser = identities.some((i) => i.provider !== 'email')

  const displayName = user.user_metadata?.full_name || user.user_metadata?.name || ''

  return (
    <div className="min-h-screen bg-dark-900 text-white">
      <nav className="border-b border-dark-600 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/">
            <img src="/logo.svg" alt="CanIShip" height={32} style={{ height: 32, width: 'auto' }} />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="min-h-[44px] flex items-center text-sm text-gray-400 hover:text-white transition-colors">
              Dashboard
            </Link>
            <form action="/api/auth/signout" method="POST">
              <button type="submit" className="min-h-[44px] flex items-center text-sm text-gray-400 hover:text-white transition-colors">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-1">Account Settings</h1>
          <p className="text-gray-500 text-sm">{user.email}</p>
        </div>

        <SettingsClient
          currentName={displayName}
          email={user.email!}
          plan={plan}
          isOAuthUser={isOAuthUser}
          hasStripeCustomer={hasStripeCustomer}
          licenseKey={licenseKey}
        />

        <div className="mt-12 pt-6 border-t border-dark-600 text-xs text-gray-600 font-mono">
          CanIShip v1.2.0
        </div>
      </div>
    </div>
  )
}
