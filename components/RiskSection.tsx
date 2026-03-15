'use client'

import type { RiskItem } from '@/lib/supabase'

type Props = {
  risks: RiskItem[]
}

const impactConfig = {
  high: { color: '#FF3B30', label: 'HIGH IMPACT', bg: 'rgba(255,59,48,0.08)' },
  medium: { color: '#FF9500', label: 'MED IMPACT', bg: 'rgba(255,149,0,0.08)' },
  low: { color: '#FFD60A', label: 'LOW IMPACT', bg: 'rgba(255,214,10,0.08)' },
}

export function RiskSection({ risks }: Props) {
  if (risks.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        No significant production risks identified.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {risks.map((risk, i) => {
        const impact = risk.impact || 'medium'
        const config = impactConfig[impact]

        return (
          <div
            key={i}
            className="rounded-lg border border-red-900/30 p-4"
            style={{ backgroundColor: config.bg }}
          >
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <h4 className="text-sm font-semibold text-white">{risk.title}</h4>
                  <span
                    className="text-xs font-mono font-bold px-1.5 py-0.5 rounded"
                    style={{ color: config.color, backgroundColor: config.color + '15' }}
                  >
                    {config.label}
                  </span>
                </div>
                <p className="text-gray-400 text-sm leading-relaxed">{risk.description}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
