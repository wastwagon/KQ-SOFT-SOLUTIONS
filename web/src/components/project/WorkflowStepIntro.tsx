import type { ReactNode } from 'react'

export interface WorkflowStepIntroProps {
  eyebrow: string
  title: string
  subtitle?: ReactNode
  className?: string
}

/**
 * Section heading inside {@link ProjectStageCard} — matches app PageHeader typography
 * without a second bordered panel (stage card already provides chrome).
 */
export default function WorkflowStepIntro({
  eyebrow,
  title,
  subtitle,
  className = '',
}: WorkflowStepIntroProps) {
  return (
    <div className={`mb-6 pb-6 border-b border-gray-100 ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">{title}</h2>
      {subtitle != null && (
        <div className="mt-2 text-sm text-gray-600 leading-relaxed max-w-3xl [&_strong]:font-semibold [&_strong]:text-gray-800">
          {subtitle}
        </div>
      )}
    </div>
  )
}
