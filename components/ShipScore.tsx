'use client'

import { useEffect, useState } from 'react'
import { getScoreLabel, getScoreDescription } from '@/lib/report-generator'

type Props = {
  score: number
  animate?: boolean
}

function getScoreColor(score: number): string {
  if (score >= 90) return '#00FF88'
  if (score >= 70) return '#7CFF5A'
  if (score >= 50) return '#FFD60A'
  if (score >= 30) return '#FF9500'
  return '#FF3B30'
}

function getScoreRing(score: number): string {
  if (score >= 90) return 'border-neon-green'
  if (score >= 70) return 'border-green-400'
  if (score >= 50) return 'border-yellow-400'
  if (score >= 30) return 'border-orange-500'
  return 'border-red-500'
}

export function ShipScore({ score, animate = true }: Props) {
  const [displayScore, setDisplayScore] = useState(animate ? 0 : score)
  const color = getScoreColor(score)
  const label = getScoreLabel(score)
  const description = getScoreDescription(score)
  // ringClass intentionally unused — kept for potential future use
  void getScoreRing(score)

  useEffect(() => {
    if (!animate) {
      setDisplayScore(score)
      return
    }

    let current = 0
    const duration = 1200
    const startTime = performance.now()

    const tick = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      current = Math.round(eased * score)
      setDisplayScore(current)

      if (progress < 1) {
        requestAnimationFrame(tick)
      }
    }

    const frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [score, animate])

  // SVG circle progress
  const radius = 88
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference - (displayScore / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Score Circle */}
      <div className="relative flex items-center justify-center">
        <svg width="220" height="220" className="-rotate-90">
          {/* Background ring */}
          <circle
            cx="110"
            cy="110"
            r={radius}
            fill="none"
            stroke="#222222"
            strokeWidth="12"
          />
          {/* Progress ring */}
          <circle
            cx="110"
            cy="110"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{
              transition: animate ? 'stroke-dashoffset 0.05s ease' : 'none',
              filter: `drop-shadow(0 0 8px ${color}80)`,
            }}
          />
        </svg>

        {/* Score number */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-mono-brand font-bold leading-none"
            style={{ fontSize: '4rem', color, textShadow: `0 0 20px ${color}60` }}
          >
            {displayScore}
          </span>
          <span className="text-sm text-gray-400 font-mono mt-1">/ 100</span>
        </div>
      </div>

      {/* Label & Description */}
      <div className="text-center">
        <div
          className="font-mono-brand font-bold text-xl tracking-wide mb-2"
          style={{ color }}
        >
          {label}
        </div>
        <p className="text-gray-400 text-sm max-w-xs text-center leading-relaxed">
          {description}
        </p>
      </div>
    </div>
  )
}
