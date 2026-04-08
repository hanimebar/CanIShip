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
    color: '#FF3B30',
    bg: 'rgba(255, 59, 48, 0.08)',
    border: 'rgba(255, 59, 48, 0.3)',
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

      {/* Expert voice (Builder + Studio) */}
      {item.expert_role && (
        <div className="mt-3 rounded border border-amber/20 bg-amber/5 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-condensed font-bold uppercase tracking-widest text-amber">
              {item.expert_role}
            </span>
          </div>
          {item.expert_perspective && (
            <p className="text-xs text-dock-200 leading-relaxed">{item.expert_perspective}</p>
          )}
          {item.why_it_matters && (
            <div>
              <span className="text-xs font-mono font-semibold text-amber-dim">Why it matters: </span>
              <span className="text-xs text-dock-300">{item.why_it_matters}</span>
            </div>
          )}
          {item.detailed_remediation && (
            <div
              className="rounded p-2.5 text-xs leading-relaxed"
              style={{ backgroundColor: config.color + '08', borderLeft: `2px solid ${config.color}40` }}
            >
              <span className="font-mono font-semibold" style={{ color: config.color }}>
                Step-by-step fix:{' '}
              </span>
              <span className="text-dock-200 whitespace-pre-line">{item.detailed_remediation}</span>
            </div>
          )}
        </div>
      )}

      {/* Basic remediation (Free tier) */}
      {!item.expert_role && item.remediation && (
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

      {/* AI fix prompt (Studio only) */}
      {item.ai_prompt && (
        <div className="mt-3 rounded border border-dock-600 bg-dock-800 p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-condensed font-bold uppercase tracking-widest text-dock-300">
              AI Fix Prompt
            </span>
            <div className="flex items-center gap-2">
              {item.ai_confidence && (
                <span
                  className="text-xs font-mono px-1.5 py-0.5 rounded"
                  style={{
                    color: item.ai_confidence === 'high' ? '#5A9A5A' : item.ai_confidence === 'medium' ? '#B87300' : '#EC4826',
                    backgroundColor: item.ai_confidence === 'high' ? '#5A9A5A20' : item.ai_confidence === 'medium' ? '#B8730020' : '#EC482620',
                  }}
                >
                  {item.ai_confidence} confidence
                </span>
              )}
              {item.ai_fixable === false && (
                <span className="text-xs font-mono text-stamp-amber">partial only</span>
              )}
            </div>
          </div>
          <pre className="text-xs text-dock-200 whitespace-pre-wrap font-mono leading-relaxed select-all">
            {item.ai_prompt}
          </pre>
        </div>
      )}

      {/* Human review flag (Studio only) */}
      {item.human_review_required && (
        <div className="mt-2 flex items-start gap-2 rounded border border-stamp-red/30 bg-stamp-red/5 p-2.5">
          <svg className="w-3.5 h-3.5 text-stamp-red flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <span className="text-xs font-semibold text-stamp-red">
              Human review required{item.human_expert_type ? `: ${item.human_expert_type}` : ''}
            </span>
            {item.human_review_reason && (
              <p className="text-xs text-dock-300 mt-0.5">{item.human_review_reason}</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
