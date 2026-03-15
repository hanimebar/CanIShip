'use client'

import { ShipScore } from './ShipScore'
import { ShipVerdict } from './ShipVerdict'
import { BugCard } from './BugCard'
import { RiskSection } from './RiskSection'
import { RewardsSection } from './RewardsSection'
import { FutureRecommendations } from './FutureRecommendations'
import type { AuditReport } from '@/lib/supabase'

type Props = {
  report: AuditReport & {
    audit_jobs?: {
      url: string
      description: string
      depth: string
      created_at: string
    }
  }
}

const sectionLabel = (text: string, count: number, color: string) => (
  <div className="flex items-center gap-3 mb-4">
    <h2 className="text-lg font-bold text-white">{text}</h2>
    <span
      className="px-2 py-0.5 rounded text-xs font-mono font-bold"
      style={{ color, backgroundColor: color + '20' }}
    >
      {count}
    </span>
  </div>
)

export function ReportView({ report }: Props) {
  const r = report.report_json
  const job = report.audit_jobs

  const totalIssues =
    r.critical_bugs.length +
    r.ux_issues.length +
    r.accessibility_violations.length +
    r.performance_issues.length +
    r.security_flags.length

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-xs text-gray-500 font-mono mb-3">
          <span>CanIShip Audit Report</span>
          <span>·</span>
          <span>{new Date(report.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          {job && (
            <>
              <span>·</span>
              <span className="capitalize">{job.depth} scan</span>
            </>
          )}
        </div>

        {job && (
          <div className="font-mono text-sm text-neon-green mb-2 break-all">{job.url}</div>
        )}
      </div>

      {/* Score + Verdict */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div className="flex justify-center">
          <ShipScore score={report.ship_score} animate />
        </div>
        <div className="space-y-4">
          <ShipVerdict verdict={report.ship_verdict} score={report.ship_score} />

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Issues', value: totalIssues, color: totalIssues > 0 ? '#FF3B30' : '#00FF88' },
              { label: 'Passed', value: r.passed_checks.length, color: '#00FF88' },
              { label: 'Warnings', value: r.warnings.length, color: '#FFD60A' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-dark-700 rounded-lg p-3 text-center border border-dark-400">
                <div className="font-mono-brand font-bold text-2xl" style={{ color }}>{value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Plain English Summary */}
      <div className="rounded-xl border border-dark-400 bg-dark-700 p-6">
        <h2 className="text-sm font-mono font-bold text-gray-400 uppercase tracking-widest mb-3">
          Plain English Summary
        </h2>
        <p className="text-white leading-relaxed text-base">{r.plain_english_summary}</p>
      </div>

      {/* Top 5 Fixes */}
      {r.top_5_fixes.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            Top 5 Fixes
            <span className="text-xs font-mono text-neon-green bg-neon-green/10 px-2 py-0.5 rounded">
              Do these first
            </span>
          </h2>
          <div className="space-y-3">
            {r.top_5_fixes.map((fix, i) => (
              <div key={i} className="flex gap-4 rounded-lg border border-dark-400 bg-dark-700 p-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neon-green/15 border border-neon-green/30 flex items-center justify-center">
                  <span className="font-mono-brand font-bold text-neon-green text-sm">{i + 1}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-white">{fix.title}</h4>
                    {fix.estimated_effort && (
                      <span className="text-xs font-mono text-gray-500 flex-shrink-0">
                        {fix.estimated_effort}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-400 text-sm leading-relaxed">{fix.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Critical Bugs */}
      {r.critical_bugs.length > 0 && (
        <div>
          {sectionLabel('Critical Bugs', r.critical_bugs.length, '#FF3B30')}
          {r.critical_bugs.map((bug, i) => (
            <BugCard key={i} item={bug} variant="critical" index={i} />
          ))}
        </div>
      )}

      {/* UX Issues */}
      {r.ux_issues.length > 0 && (
        <div>
          {sectionLabel('UX Issues', r.ux_issues.length, '#FF9500')}
          {r.ux_issues.map((issue, i) => (
            <BugCard key={i} item={issue} variant="ux" index={i} />
          ))}
        </div>
      )}

      {/* Accessibility */}
      {r.accessibility_violations.length > 0 && (
        <div>
          {sectionLabel('Accessibility Violations', r.accessibility_violations.length, '#AF52DE')}
          {r.accessibility_violations.map((v, i) => (
            <BugCard key={i} item={v} variant="accessibility" index={i} />
          ))}
        </div>
      )}

      {/* Performance */}
      {r.performance_issues.length > 0 && (
        <div>
          {sectionLabel('Performance Issues', r.performance_issues.length, '#0A84FF')}
          {r.performance_issues.map((issue, i) => (
            <BugCard key={i} item={issue} variant="performance" index={i} />
          ))}
        </div>
      )}

      {/* Security */}
      {r.security_flags.length > 0 && (
        <div>
          {sectionLabel('Security Flags', r.security_flags.length, '#CC0000')}
          {r.security_flags.map((flag, i) => (
            <BugCard key={i} item={flag} variant="security" index={i} />
          ))}
        </div>
      )}

      {/* Warnings */}
      {r.warnings.length > 0 && (
        <div>
          {sectionLabel('Warnings', r.warnings.length, '#FFD60A')}
          {r.warnings.map((warning, i) => (
            <BugCard key={i} item={warning} variant="warning" index={i} />
          ))}
        </div>
      )}

      {/* Passed Checks */}
      {r.passed_checks.length > 0 && (
        <div>
          {sectionLabel('What Passed', r.passed_checks.length, '#00FF88')}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {r.passed_checks.map((check, i) => (
              <div key={i} className="rounded-lg border border-neon-green/20 bg-neon-green/5 p-3 flex items-start gap-2">
                <svg className="w-4 h-4 text-neon-green flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <div className="text-sm font-semibold text-white">{check.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{check.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Risks */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4">Production Risks</h2>
        <RiskSection risks={r.risks} />
      </div>

      {/* Rewards */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4">What is Working Well</h2>
        <RewardsSection rewards={r.rewards} />
      </div>

      {/* Future Recommendations */}
      <div>
        <h2 className="text-lg font-bold text-white mb-2">Future Recommendations</h2>
        <p className="text-gray-500 text-sm mb-4">Beyond current bugs — improvements for the next iteration.</p>
        <FutureRecommendations recommendations={r.future_recommendations} />
      </div>

      {/* Footer */}
      <div className="border-t border-dark-400 pt-8 text-center text-xs text-gray-600">
        <span className="font-mono">CanIShip</span> audit powered by Playwright, axe-core, Lighthouse, and Claude AI.
        <br />
        Re-run this audit after fixing issues to see your new ShipScore.
      </div>
    </div>
  )
}
