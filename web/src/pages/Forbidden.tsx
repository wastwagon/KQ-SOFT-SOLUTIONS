import { Link } from 'react-router-dom'
import { ArrowLeft, Home, ShieldOff } from 'lucide-react'
import BrandLogo from '../components/BrandLogo'
import { useAuth } from '../store/auth'

/**
 * Branded 403.  Used by route guards (e.g. PlatformAdminRoute) instead of
 * silently sending logged-in users back to "/" — that pattern hides bugs and
 * feels confusing to users who legitimately got there from a notification or
 * a deep link.
 */
export default function Forbidden() {
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
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl bg-amber-50 ring-1 ring-amber-100">
            <ShieldOff className="h-7 w-7 text-amber-600" aria-hidden="true" />
          </div>
          <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-amber-700">
            Error 403
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            You don&apos;t have access to this page
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-gray-600 sm:text-base">
            Your account isn&apos;t permitted to view this area. If you think this is a
            mistake, ask your firm&apos;s admin to update your role from
            <span className="whitespace-nowrap"> Settings → Team Members</span>.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to={homeHref}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-primary-600/20 transition-colors hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 sm:w-auto"
            >
              <Home className="h-4 w-4" aria-hidden="true" />
              {homeLabel}
            </Link>
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
