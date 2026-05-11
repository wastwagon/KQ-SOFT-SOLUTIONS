import type { ReactNode } from 'react'

export interface PageHeaderProps {
  /** Small uppercase label above the title (default: Workspace) */
  eyebrow?: string
  title: string
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
}

/**
 * Consistent page hero for logged-in SaaS routes — matches Dashboard overview band.
 */
export default function PageHeader({
  eyebrow = 'Workspace',
  title,
  subtitle,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <div
      className={`rounded-xl border border-gray-200/90 bg-gradient-to-br from-white via-slate-50/80 to-white shadow-sm px-6 py-7 sm:px-8 sm:py-8 ${className}`}
    >
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">{eyebrow}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-900 sm:text-[2rem]">{title}</h1>
          {subtitle != null && (
            <div className="mt-2 text-sm leading-relaxed max-w-3xl text-gray-600 [&_p+p]:mt-2">{subtitle}</div>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  )
}
