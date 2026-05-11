import BrandLogo from './BrandLogo'

/**
 * Branded full-screen loading state used as the Suspense fallback for lazy
 * routes.  Replaces the previous plain-text "Loading page…" string so the
 * first paint after sign-in (or a route chunk request) feels intentional
 * rather than broken.
 */
export default function PageLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading page"
      className="min-h-screen w-full bg-surface flex flex-col items-center justify-center gap-6 px-4"
    >
      <div className="flex items-center justify-center rounded-xl bg-white px-5 py-4 shadow-sm ring-1 ring-gray-100">
        <BrandLogo className="h-9 w-auto" />
      </div>
      <div className="flex items-center gap-3 text-sm text-gray-500">
        <svg
          className="h-4 w-4 animate-spin text-primary-600 motion-reduce:hidden"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span>Preparing your workspace…</span>
      </div>
    </div>
  )
}
