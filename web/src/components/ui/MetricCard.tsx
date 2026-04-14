import { type ReactNode } from 'react'

interface MetricCardProps {
  label: string
  value: ReactNode
  sublabel?: ReactNode
  /** Optional icon or trend (e.g. Lucide icon) */
  icon?: ReactNode
  /** Optional accent: 'primary' (green bar) or 'muted' (neutral). Default: primary */
  accent?: 'primary' | 'muted' | 'none'
  className?: string
}

export default function MetricCard({ label, value, sublabel, icon, accent = 'primary', className = '' }: MetricCardProps) {
  const accentBorder =
    accent === 'primary'
      ? 'border-l-4 border-l-primary-500'
      : accent === 'muted'
        ? 'border-l-4 border-l-gray-300'
        : ''

  return (
    <div
      className={`bg-white rounded-xl border border-gray-200/80 shadow-sm hover:shadow-md transition-shadow duration-200 p-4 sm:p-5 ${accentBorder} ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 break-words leading-tight">
            {label}
          </p>
          <p className="mt-2 text-lg sm:text-xl font-bold text-gray-900 tabular-nums tracking-tight break-words leading-tight">
            {value}
          </p>
          {sublabel && (
            <p className="mt-1 text-xs text-gray-500 break-words leading-snug">
              {sublabel}
            </p>
          )}
        </div>
        {icon && (
          <div className="flex-shrink-0 text-gray-400 [&>svg]:w-5 [&>svg]:h-5 sm:[&>svg]:w-6 sm:[&>svg]:h-6">
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
