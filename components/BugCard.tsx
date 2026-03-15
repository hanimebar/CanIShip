'use client'

import type { Issue, AccessibilityIssue, PerformanceIssue } from '@/lib/supabase'

type CardVariant = 'critical' | 'ux' | 'accessibility' | 'performance' | 'security' | 'warning' | 'passed'

type Props = {
  item: Issue | AccessibilityIssue | PerformanceIssue
  variant: CardVariant
  index?: number
}

const variantConfig: Record<CardVariant, {
  color: string
  bg: string
  border: string
  label: string
  icon: string
}> = {
  critical: {
    color: '#FF3B30',
    bg: 'rgba(255, 59, 48, 0.05)',
    border: 'rgba(255, 59, 48, 0.25)',
    label: 'CRITICAL',
    icon: '●',
  },
  ux: {
    color: '#FF9500',
    bg: 'rgba(255, 149, 0, 0.05)',
    border: 'rgba(255, 149, 0, 0.25)',
    label: 'UX',
    icon: '◆',
  },
  accessibility: {
    color: '#AF52DE',
    bg: 'rgba(175, 82, 222, 0.05)',
    border: 'rgba(175, 82, 222, 0.25)',
    label: 'A11Y',
    icon: '♿',
  },
  performance: {
    color: '#0A84FF',
    bg: 'rgba(10, 132, 255, 0.05)',
    border: 'rgba(10, 132, 255, 0.25)',
    label: 'PERF',
    icon: '⚡',
  },
  security: {
    color: '#CC0000',
    bg: 'rgba(204, 0, 0, 0.08)',
    border: 'rgba(204, 0, 0, 0.3)',
    label: 'SECURITY',
    icon: '🔒',
  },
  warning: {
    color: '#FFD60A',
    bg: 'rgba(255, 214, 10, 0.05)',
    border: 'rgba(255, 214, 10, 0.2)',
    label: 'WARN',
    icon: '▲',
  },
  passed: {
    color: '#00FF88',
    bg: 'rgba(0, 255, 136, 0.05)',
    border: 'rgba(0, 255, 136, 0.2)',
    label: 'PASS',
    icon: '✓',
  },
}

export function BugCard({ item, variant, index }: Props) {
  const config = variantConfig[variant]
  const accessItem = item as AccessibilityIssue
  const perfItem = item as PerformanceIssue

  return (
    <div
      className="rounded-lg border p-4 mb-3 transition-all hover:scale-[1.01]"
      style={{
        backgroundColor: config.bg,
        borderColor: config.border,
        animationDelay: index ? `${index * 50}ms` : '0ms',
      }}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-2">
        <span
          className="font-mono text-xs font-bold px-2 py-0.5 rounded mt-0.5 flex-shrink-0"
          style={{
            color: config.color,
            backgroundColor: config.color + '15',
          }}
        >
          {config.icon} {config.label}
        </span>
        <h4 className="text-sm font-semibold text-white leading-snug">{item.title}</h4>
      </div>

      {/* Description */}
      <p className="text-gray-400 text-sm leading-relaxed ml-0 mb-3">{item.description}</p>

      {/* Location */}
      {item.location && (
        <div className="font-mono text-xs text-gray-500 mb-2 flex items-center gap-1.5">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          </svg>
          <span className="truncate">{item.location}</span>
        </div>
      )}

      {/* Accessibility-specific fields */}
      {variant === 'accessibility' && accessItem.wcag_reference && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-mono text-purple-400">
            WCAG {accessItem.wcag_reference} ({accessItem.wcag_level})
          </span>
          {accessItem.elements_affected !== undefined && accessItem.elements_affected > 0 && (
            <span className="text-xs text-gray-500">
              · {accessItem.elements_affected} element{accessItem.elements_affected !== 1 ? 's' : ''} affected
            </span>
          )}
        </div>
      )}

      {/* Performance-specific fields */}
      {variant === 'performance' && perfItem.metric && (
        <div className="flex items-center gap-3 mb-2 text-xs font-mono">
          {perfItem.value && (
            <span style={{ color: config.color }}>
              Current: {perfItem.value}
            </span>
          )}
          {perfItem.target && (
            <span className="text-gray-500">Target: {perfItem.target}</span>
          )}
        </div>
      )}

      {/* Remediation */}
      {item.remediation && (
        <div
          className="rounded p-3 text-xs leading-relaxed"
          style={{ backgroundColor: config.color + '08', borderLeft: `2px solid ${config.color}40` }}
        >
          <span className="font-mono font-semibold" style={{ color: config.color }}>
            Fix:{' '}
          </span>
          <span className="text-gray-300">{item.remediation}</span>
        </div>
      )}
    </div>
  )
}
