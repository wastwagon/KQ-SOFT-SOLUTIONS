import Skeleton from '../ui/Skeleton'

type WorkflowStepSkeletonProps = {
  /** Extra content rows below the header block */
  bodyRows?: number
}

/**
 * Loading placeholder for Map / Reconcile / Review / Report steps.
 */
export default function WorkflowStepSkeleton({ bodyRows = 2 }: WorkflowStepSkeletonProps) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading step">
      <div className="space-y-3 pb-6 border-b border-gray-100">
        <Skeleton className="h-3 w-28 rounded-md" />
        <Skeleton className="h-8 w-72 max-w-full rounded-xl" />
        <Skeleton className="h-4 w-full max-w-2xl rounded-md" />
        <Skeleton className="h-4 w-full max-w-xl rounded-md" />
      </div>
      {Array.from({ length: bodyRows }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-xl" />
      ))}
    </div>
  )
}
