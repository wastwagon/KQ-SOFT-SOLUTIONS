import type { ReactNode } from 'react'
import ErrorFallback from '../ErrorFallback'

/**
 * Wrapper used by ProjectDetail for each lazy-loaded BRS step (Map, Reconcile,
 * Review, Report).  Flat card matching the rest of the app chrome, with an
 * ErrorFallback so a render error in one stage doesn't take the whole page down.
 */
interface ProjectStageCardProps {
  children: ReactNode
  /** Used as a screen-reader landmark name (e.g. "Reconcile"). */
  ariaLabel?: string
  /** Optional extra class on the outer wrapper. */
  className?: string
}

export default function ProjectStageCard({
  children,
  ariaLabel,
  className = '',
}: ProjectStageCardProps) {
  return (
    <section
      aria-label={ariaLabel}
      className={`overflow-hidden rounded-xl border border-border bg-white p-6 shadow-card sm:p-8 ${className}`}
    >
      <ErrorFallback>{children}</ErrorFallback>
    </section>
  )
}
