import Skeleton from '../ui/Skeleton'

/**
 * In-layout page placeholder. Used as the nested Suspense fallback so the
 * sidebar and top bar stay mounted while a lazy route chunk loads.
 */
export default function RouteFallback() {
  return (
    <div className="space-y-8" role="status" aria-live="polite" aria-label="Loading page">
      <div className="space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}
