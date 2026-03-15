import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createSupabaseServiceClient } from '@/lib/supabase'
import { ReportView } from '@/components/ReportView'

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

export default async function ReportPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { id } = params
  const serviceClient = createSupabaseServiceClient()

  // id can be either a job_id or report_id — try job_id first
  const { data: report, error } = await serviceClient
    .from('audit_reports')
    .select('*, audit_jobs(url, description, depth, created_at)')
    .eq('job_id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !report) {
    // Try by report id
    const { data: reportById } = await serviceClient
      .from('audit_reports')
      .select('*, audit_jobs(url, description, depth, created_at)')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!reportById) {
      notFound()
    }

    return <ReportPageContent report={reportById!} />
  }

  return <ReportPageContent report={report} />
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ReportPageContent({ report }: { report: any }) {

  return (
    <div className="min-h-screen bg-dark-900 text-white">
      {/* Nav */}
      <nav className="border-b border-dark-600 px-6 py-4 sticky top-0 z-10 bg-dark-900/95 backdrop-blur">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/" className="font-mono-brand font-bold text-neon-green text-xl">
            CanIShip
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/audit/new"
              className="px-4 py-2 bg-dark-700 border border-dark-400 text-sm text-gray-300 rounded-lg hover:border-neon-green hover:text-neon-green transition-colors font-mono"
            >
              + New audit
            </Link>
            <Link
              href="/dashboard"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </nav>

      <ReportView report={report} />
    </div>
  )
}
