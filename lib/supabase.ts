import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

// Browser client (subject to RLS)
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Service role client (bypasses RLS — server-side only)
export function createSupabaseServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

export type TargetPlatform = 'mobile' | 'desktop' | 'all'

export type AuditJob = {
  id: string
  user_id: string
  url: string
  description: string
  flows: string[]
  depth: 'quick' | 'standard' | 'deep'
  target_platform: TargetPlatform   // Primary device target — affects mobile score weighting
  status: 'queued' | 'running' | 'complete' | 'failed'
  is_public: boolean                // Whether this audit appears in the public leaderboard
  callback_url?: string    // Optional webhook URL — fired on completion or failure
  error_message?: string
  worker_id?: string
  started_at?: string
  completed_at?: string
  created_at: string
}

export type AuditReport = {
  id: string
  job_id: string
  user_id: string
  report_json: ClaudeReport
  ship_score: number
  ship_verdict: 'yes' | 'no' | 'conditional'
  created_at: string
}

export type Screenshot = {
  id: string
  job_id: string
  filename: string
  storage_path: string
  step_label?: string
  created_at: string
}

export type ClaudeReport = {
  overall_score: number
  ship_verdict: 'yes' | 'no' | 'conditional'
  critical_bugs: Issue[]
  ux_issues: Issue[]
  accessibility_violations: AccessibilityIssue[]
  performance_issues: PerformanceIssue[]
  security_flags: Issue[]
  warnings: Issue[]
  passed_checks: PassedCheck[]
  risks: RiskItem[]
  rewards: RewardItem[]
  future_recommendations: Recommendation[]
  plain_english_summary: string
  top_5_fixes: Fix[]
}

// Fields added by Builder and Studio tiers
export type ExpertAnnotation = {
  expert_role?: string          // e.g. "Senior Application Security Engineer"
  expert_perspective?: string   // The issue explained from that expert's viewpoint
  why_it_matters?: string       // Business / user impact, not just technical description
  detailed_remediation?: string // Step-by-step fix, not just a hint
}

// Fields added by Studio tier only
export type StudioAnnotation = ExpertAnnotation & {
  ai_fixable?: boolean
  ai_confidence?: 'high' | 'medium' | 'low'
  ai_prompt?: string            // Exact prompt the user can paste into Claude/ChatGPT
  human_review_required?: boolean
  human_expert_type?: string    // e.g. "Penetration Tester", "Accessibility Auditor"
  human_review_reason?: string  // Why a human is needed here
}

export type Issue = StudioAnnotation & {
  title: string
  description: string
  location?: string
  screenshot?: string
  severity?: 'critical' | 'high' | 'medium' | 'low'
  remediation?: string
}

export type AccessibilityIssue = Issue & {
  wcag_reference?: string
  wcag_level?: 'A' | 'AA' | 'AAA'
  impact?: 'critical' | 'serious' | 'moderate' | 'minor'
  elements_affected?: number
}

export type PerformanceIssue = Issue & {
  metric?: string
  value?: string
  target?: string
}

export type PassedCheck = {
  title: string
  description: string
}

export type RiskItem = {
  title: string
  description: string
  impact?: 'high' | 'medium' | 'low'
}

export type RewardItem = {
  title: string
  description: string
}

export type Recommendation = {
  title: string
  description: string
  priority?: 'high' | 'medium' | 'low'
  effort?: 'low' | 'medium' | 'high'
}

export type Fix = {
  priority: number
  title: string
  description: string
  estimated_effort?: string
}

export type ReportTier = 'free' | 'builder' | 'studio'
