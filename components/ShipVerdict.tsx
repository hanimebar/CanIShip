'use client'

type Props = {
  verdict: 'yes' | 'no' | 'conditional'
  score: number
}

const verdictConfig = {
  yes: {
    label: 'SHIP IT',
    emoji: null,
    color: '#00FF88',
    bg: 'bg-neon-green/10',
    border: 'border-neon-green/30',
    description: 'Your app is ready for real users. The quality bar is cleared.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  conditional: {
    label: 'CONDITIONAL',
    emoji: null,
    color: '#FFD60A',
    bg: 'bg-yellow-400/10',
    border: 'border-yellow-400/30',
    description: 'You can ship after addressing the listed conditions.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    ),
  },
  no: {
    label: 'DO NOT SHIP',
    emoji: null,
    color: '#FF3B30',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    description: 'Critical issues found. Fix these before shipping to real users.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  },
}

export function ShipVerdict({ verdict, score }: Props) {
  const config = verdictConfig[verdict]

  return (
    <div
      className={`rounded-xl border-2 p-6 flex items-center gap-5 ${config.bg} ${config.border}`}
      style={{ borderColor: config.color + '50' }}
    >
      <div
        className="flex-shrink-0 p-3 rounded-xl"
        style={{
          color: config.color,
          backgroundColor: config.color + '15',
        }}
      >
        {config.icon}
      </div>

      <div>
        <div className="flex items-center gap-3 mb-1">
          <span
            className="font-mono-brand font-bold text-2xl tracking-widest"
            style={{ color: config.color }}
          >
            {config.label}
          </span>
          <span
            className="px-2 py-0.5 rounded text-xs font-mono font-bold"
            style={{ backgroundColor: config.color + '20', color: config.color }}
          >
            {score}/100
          </span>
        </div>
        <p className="text-gray-300 text-sm">{config.description}</p>
      </div>
    </div>
  )
}
