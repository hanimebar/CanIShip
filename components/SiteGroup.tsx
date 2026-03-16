'use client'

import { useState } from 'react'
import Link from 'next/link'

function getScoreColor(score: number): string {
  if (score >= 90) return '#00FF88'
  if (score >= 70) return '#7CFF5A'
  if (score >= 50) return '#FFD60A'
  if (score >= 30) return '#FF9500'
  return '#FF3B30'
}

function getVerdictLabel(verdict: string): string {
  return { yes: 'SHIP IT', conditional: 'CONDITIONAL', no: 'DO NOT SHIP' }[verdict] || verdict.toUpperCase()
}

function getVerdictColor(verdict: string): string {
  return { yes: '#00FF88', conditional: '#FFD60A', no: '#FF3B30' }[verdict] || '#8E8E93'
}

function getStatusColor(status: string): string {
  return { queued: '#8E8E93', running: '#0A84FF', complete: '#00FF88', failed: '#FF3B30' }[status] || '#8E8E93'
}

type Audit = {
  id: string
  url: string
  description: string
  flows: string[]
  depth: string
  status: string
  created_at: string
  error_message?: string
  audit_reports: { id: string; ship_score: number; ship_verdict: string } | null
}

type Props = {
  url: string
  audits: Audit[]
  defaultOpen?: boolean
}

export function SiteGroup({ url, audits, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen)

  const latest = audits[0]
  const latestReport = latest?.audit_reports
  const completedAudits = audits.filter(a => a.status === 'complete' && a.audit_reports)

  // Build re-audit URL from most recent audit's params
  const reauditParams = new URLSearchParams({
    url: latest.url,
    description: latest.description || '',
    flows: (latest.flows || []).join('\n'),
    depth: latest.depth || 'quick',
  })

  return (
    <div className="rounded-xl border border-dark-500 bg-dark-800 overflow-hidden">
      {/* Site header row */}
      <div className="flex items-center gap-4 p-5">
        <button
          onClick={() => setOpen(!open)}
          className="flex-1 flex items-center gap-3 min-w-0 text-left"
        >
          <svg
            className={`w-4 h-4 text-gray-500 flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <div className="min-w-0">
            <div className="font-mono text-sm text-neon-green truncate">{url}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {audits.length} audit{audits.length !== 1 ? 's' : ''} · last{' '}
              {new Date(latest.created_at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric'
              })}
            </div>
          </div>
        </button>

        {/* Score trend */}
        {completedAudits.length > 0 && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {completedAudits.slice(0, 5).reverse().map((a, i) => (
              <div
                key={a.id}
                className="w-1.5 rounded-full"
                style={{
                  height: `${Math.max(8, (a.audit_reports!.ship_score / 100) * 28)}px`,
                  backgroundColor: getScoreColor(a.audit_reports!.ship_score),
                  opacity: i === completedAudits.slice(0, 5).length - 1 ? 1 : 0.4,
                }}
                title={`${a.audit_reports!.ship_score} — ${new Date(a.created_at).toLocaleDateString()}`}
              />
            ))}
          </div>
        )}

        {/* Latest score */}
        {latestReport && latest.status === 'complete' ? (
          <div className="text-right flex-shrink-0">
            <div className="font-mono-brand font-bold text-xl" style={{ color: getScoreColor(latestReport.ship_score) }}>
              {latestReport.ship_score}
            </div>
            <div className="text-xs font-mono font-bold" style={{ color: getVerdictColor(latestReport.ship_verdict) }}>
              {getVerdictLabel(latestReport.ship_verdict)}
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-500 font-mono capitalize flex-shrink-0">{latest.status}</div>
        )}

        {/* Re-audit button */}
        <Link
          href={`/audit/new?${reauditParams.toString()}`}
          className="flex-shrink-0 px-3 py-1.5 border border-dark-400 text-xs text-gray-300 rounded-lg hover:border-neon-green hover:text-neon-green transition-colors font-mono whitespace-nowrap"
        >
          Re-audit
        </Link>
      </div>

      {/* Expanded audit history */}
      {open && (
        <div className="border-t border-dark-600">
          {audits.map((audit) => {
            const report = audit.audit_reports
            return (
              <div key={audit.id} className="flex items-center gap-4 px-5 py-3 border-b border-dark-700 last:border-b-0 hover:bg-dark-750">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getStatusColor(audit.status) }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="capitalize font-mono">{audit.depth}</span>
                    <span className="text-gray-700">·</span>
                    <span>
                      {new Date(audit.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>

                {report && audit.status === 'complete' ? (
                  <div className="text-right flex-shrink-0">
                    <span className="font-mono-brand font-bold text-base" style={{ color: getScoreColor(report.ship_score) }}>
                      {report.ship_score}
                    </span>
                  </div>
                ) : (
                  <span className="text-xs text-gray-500 font-mono capitalize">{audit.status}</span>
                )}

                {audit.status === 'complete' && report ? (
                  <Link
                    href={`/report/${audit.id}`}
                    className="flex-shrink-0 px-3 py-1 border border-dark-400 text-xs text-gray-400 rounded-lg hover:border-neon-green hover:text-neon-green transition-colors font-mono"
                  >
                    View
                  </Link>
                ) : audit.status === 'queued' || audit.status === 'running' ? (
                  <Link
                    href={`/audit/${audit.id}/status`}
                    className="flex-shrink-0 px-3 py-1 border border-dark-400 text-xs text-gray-400 rounded-lg hover:border-blue-400 hover:text-blue-400 transition-colors font-mono"
                  >
                    Status
                  </Link>
                ) : (
                  <div className="w-16" />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
