'use client'

import type { Recommendation } from '@/lib/supabase'

type Props = {
  recommendations: Recommendation[]
}

const priorityConfig = {
  high: { color: '#FF9500', label: 'HIGH' },
  medium: { color: '#0A84FF', label: 'MED' },
  low: { color: '#8E8E93', label: 'LOW' },
}

const effortConfig = {
  low: { label: 'Quick win', icon: '⚡' },
  medium: { label: 'Some effort', icon: '⚙' },
  high: { label: 'Major effort', icon: '🏗' },
}

export function FutureRecommendations({ recommendations }: Props) {
  if (recommendations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        No future recommendations at this time.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {recommendations.map((rec, i) => {
        const priority = rec.priority || 'medium'
        const effort = rec.effort || 'medium'
        const pConfig = priorityConfig[priority]
        const eConfig = effortConfig[effort]

        return (
          <div
            key={i}
            className="rounded-lg border border-dark-400 bg-dark-700 p-4"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <h4 className="text-sm font-semibold text-white leading-snug">{rec.title}</h4>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span
                  className="text-xs font-mono font-bold px-1.5 py-0.5 rounded"
                  style={{ color: pConfig.color, backgroundColor: pConfig.color + '15' }}
                >
                  {pConfig.label}
                </span>
                <span className="text-xs text-gray-500 font-mono">
                  {eConfig.icon} {eConfig.label}
                </span>
              </div>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">{rec.description}</p>
          </div>
        )
      })}
    </div>
  )
}
