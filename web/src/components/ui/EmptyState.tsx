import { type ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export default function EmptyState({ icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`} role="status" aria-label={title}>
      {icon && (
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-surface border border-border text-gray-500 mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold tracking-tight text-gray-900">{title}</h3>
      {description && <p className="mt-2 text-sm text-gray-600 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
