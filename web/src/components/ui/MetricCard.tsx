import { type ReactNode } from 'react'

interface MetricCardProps {
  label: string
  value: ReactNode
  sublabel?: ReactNode
  /** Optional icon or trend (e.g. Lucide icon) */
  icon?: ReactNode
  /** Left accent bar colour. Default: primary */
  accent?: 'primary' | 'muted' | 'amber' | 'green' | 'indigo' | 'none'
  className?: string
}

export default function MetricCard({ label, value, sublabel, icon, accent = 'primary', className = '' }: MetricCardProps) {
  const accentBorder =
    accent === 'primary'
      ? 'border-l-4 border-l-primary-500'
      : accent === 'muted'
        ? 'border-l-4 border-l-gray-300'
        : accent === 'amber'
          ? 'border-l-4 border-l-amber-500'
          : accent === 'green'
            ? 'border-l-4 border-l-green-500'
            : accent === 'indigo'
              ? 'border-l-4 border-l-indigo-500'
              : ''

  const iconWrap =
    accent === 'primary'
      ? 'bg-primary-50 text-primary-600'
      : accent === 'muted'
        ? 'bg-gray-100 text-gray-500'
        : accent === 'amber'
          ? 'bg-amber-50 text-amber-600'
          : accent === 'green'
            ? 'bg-green-50 text-green-600'
            : accent === 'indigo'
              ? 'bg-indigo-50 text-indigo-600'
              : 'bg-gray-50 text-gray-400'

  return (
    <div
      className={`bg-white rounded-xl border border-gray-200/80 shadow-sm hover:shadow-md transition-shadow duration-200 p-5 sm:p-6 ${accentBorder} ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-gray-400 break-words leading-tight">
            {label}
          </p>
          <div className="mt-2 text-2xl sm:text-3xl font-bold text-gray-900 tabular-nums tracking-tight break-words leading-tight">
            {value}
          </div>
          {sublabel && (
            <div className="mt-2 text-xs font-medium text-gray-500 break-words leading-snug">
              {sublabel}
            </div>
          )}
        </div>
        {icon && (
          <div
            className={`flex-shrink-0 rounded-xl p-2.5 [&>svg]:w-5 [&>svg]:h-5 sm:[&>svg]:w-6 sm:[&>svg]:h-6 ${iconWrap}`}
            aria-hidden
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
