import { type HTMLAttributes } from 'react'

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Optional: animate pulse (default true) */
  pulse?: boolean
}

export default function Skeleton({ className = '', pulse = true, ...props }: SkeletonProps) {
  return (
    <div
      role="presentation"
      aria-hidden="true"
      className={`rounded-md bg-border-muted ${pulse ? 'animate-pulse' : ''} ${className}`}
      {...props}
    />
  )
}

/** Skeleton that matches a MetricCard layout */
export function MetricCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`rounded-xl border border-border bg-white p-6 shadow-card ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-20" />
        </div>
        <Skeleton className="h-6 w-6 rounded flex-shrink-0" />
      </div>
    </div>
  )
}

/** Skeleton for a table row */
export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-6 py-4">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  )
}
