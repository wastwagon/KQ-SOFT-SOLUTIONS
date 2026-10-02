import { type ReactNode } from 'react'

interface MetricCardProps {
  label: string
  value: ReactNode
  sublabel?: ReactNode
  /** Optional icon or trend (e.g. Lucide icon) */
  icon?: ReactNode
  /** Left accent bar. Default is none — dashboard and admin cards stay flat. */
  accent?: 'primary' | 'muted' | 'amber' | 'green' | 'brand' | 'none'
  /** Tighter type for a row of stats. Labels, figures, and subtitles stay on one line. */
  compact?: boolean
  /** Shown on hover when the subtitle is shortened to fit the card. */
  sublabelTitle?: string
  className?: string
}

export default function MetricCard({
  label,
  value,
  sublabel,
  icon,
  accent = 'none',
  compact = false,
  sublabelTitle,
  className = '',
}: MetricCardProps) {
  const accentBorder =
    accent === 'none'
      ? ''
      : accent === 'primary' || accent === 'brand'
        ? 'border-l-4 border-l-primary-500'
        : accent === 'muted'
          ? 'border-l-4 border-l-gray-300'
          : accent === 'amber'
            ? 'border-l-4 border-l-amber-500'
            : 'border-l-4 border-l-green-500'

  const iconWrap =
    accent === 'primary' || accent === 'brand'
      ? 'bg-primary-50 text-primary-600'
      : accent === 'muted'
        ? 'bg-gray-100 text-gray-500'
        : accent === 'amber'
          ? 'bg-amber-50 text-amber-600'
          : accent === 'green'
            ? 'bg-green-50 text-green-600'
            : 'bg-gray-50 text-gray-400'

  return (
    <div
      className={`bg-white rounded-xl border border-border shadow-card hover:shadow-card-hover transition-shadow duration-200 ${
        compact ? 'px-4 py-3.5' : 'p-5 sm:p-6'
      } ${accentBorder} ${className}`}
    >
      <div className={`flex items-start justify-between ${compact ? 'gap-2' : 'gap-3'}`}>
        <div className="min-w-0 flex-1">
          <p
            className={
              compact
                ? 'truncate text-[11px] font-semibold uppercase tracking-wide text-gray-600 whitespace-nowrap leading-none'
                : 'text-xs font-bold uppercase tracking-[0.08em] text-gray-400 leading-tight'
            }
            title={compact ? label : undefined}
          >
            {label}
          </p>
          <div
            className={
              compact
                ? 'mt-1.5 text-lg font-semibold text-gray-900 tabular-nums tracking-tight whitespace-nowrap leading-none'
                : 'mt-2 text-2xl sm:text-3xl font-bold text-gray-900 tabular-nums tracking-tight leading-tight'
            }
          >
            {value}
          </div>
          {sublabel && (
            <div
              className={
                compact
                  ? 'mt-1.5 truncate text-xs font-medium text-gray-500 whitespace-nowrap leading-none'
                  : 'mt-2 text-xs font-medium text-gray-500 leading-snug'
              }
              title={sublabelTitle ?? (typeof sublabel === 'string' ? sublabel : undefined)}
            >
              {sublabel}
            </div>
          )}
        </div>
        {icon && (
          <div
            className={`flex-shrink-0 ${
              compact
                ? 'rounded-lg p-1.5 [&>svg]:w-4 [&>svg]:h-4'
                : 'rounded-xl p-2.5 [&>svg]:w-5 [&>svg]:h-5'
            } ${iconWrap}`}
            aria-hidden
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
