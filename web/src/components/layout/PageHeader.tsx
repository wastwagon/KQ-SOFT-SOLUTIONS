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
 * Page title band for logged-in SaaS routes.
 * Matches Figma golden-path headers: flat surface, clear hierarchy, no inset hero card.
 */
export default function PageHeader({
  eyebrow = 'Workspace',
  title,
  subtitle,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <div className={`flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${className}`}>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-primary-600">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 sm:text-[1.75rem]">{title}</h1>
        {subtitle != null && (
          <div className="mt-1.5 text-sm leading-relaxed max-w-3xl text-gray-500 [&_p+p]:mt-1.5">{subtitle}</div>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  )
}
