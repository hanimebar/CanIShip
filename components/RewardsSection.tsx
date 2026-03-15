'use client'

import type { RewardItem } from '@/lib/supabase'

type Props = {
  rewards: RewardItem[]
}

export function RewardsSection({ rewards }: Props) {
  if (rewards.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        No standout positives identified in this audit.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {rewards.map((reward, i) => (
        <div
          key={i}
          className="rounded-lg border border-neon-green/20 bg-neon-green/5 p-4"
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5 w-5 h-5 rounded-full bg-neon-green/20 flex items-center justify-center">
              <svg className="w-3 h-3 text-neon-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white mb-1">{reward.title}</h4>
              <p className="text-gray-400 text-sm leading-relaxed">{reward.description}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
