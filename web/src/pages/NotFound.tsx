import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, Compass, Home } from 'lucide-react'
import BrandLogo from '../components/BrandLogo'
import { useAuth } from '../store/auth'

/**
 * Friendly 404.  Replaces the previous catch-all `<Navigate to="/" />` so that
 * mistyped URLs and broken share links are visible instead of silently
 * redirecting users away from where they wanted to go.
 *
 * Authenticated users get a "Back to dashboard" CTA; everyone else gets
 * "Back to home".
 */
export default function NotFound() {
  const location = useLocation()
  const isAuthenticated = useAuth((s) => !!s.token)
  const homeHref = isAuthenticated ? '/dashboard' : '/'
  const homeLabel = isAuthenticated ? 'Back to dashboard' : 'Back to home'

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="px-4 py-5 sm:px-8">
        <Link
          to={homeHref}
          className="inline-flex items-center rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-gray-100 transition-transform hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          aria-label="KQ-SOFT home"
        >
          <BrandLogo className="h-8 w-auto" />
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">
            Error 404
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            We can&apos;t find that page
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-gray-600 sm:text-base">
            The link may be broken, the page may have moved, or the address might be
            mistyped.
          </p>
          {location.pathname && (
            <p className="mx-auto mt-3 max-w-md break-all rounded-xl bg-white px-3 py-2 font-mono text-xs text-gray-500 ring-1 ring-gray-100">
              {location.pathname}
            </p>
          )}

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to={homeHref}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-primary-600/20 transition-colors hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 sm:w-auto"
            >
              <Home className="h-4 w-4" aria-hidden="true" />
              {homeLabel}
            </Link>
            {isAuthenticated && (
              <Link
                to="/projects"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:w-auto"
              >
                <Compass className="h-4 w-4" aria-hidden="true" />
                Browse projects
              </Link>
            )}
            <button
              type="button"
              onClick={() => window.history.back()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-3 py-3 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Go back
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
