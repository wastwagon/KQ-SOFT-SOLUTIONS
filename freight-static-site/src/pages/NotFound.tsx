import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { usePageMeta } from '../hooks/usePageMeta'

export function NotFound() {
  usePageMeta(
    'Page not found',
    'The page you requested could not be found. Return to RexGroup Freight, Transportation & Logistics.',
    { noindex: true },
  )

  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center md:py-32">
      <p className="text-sm font-bold uppercase tracking-wider text-amber-600">404</p>
      <h1 className="mt-3 text-4xl font-extrabold text-navy-900 md:text-5xl">This page doesn’t exist</h1>
      <p className="mt-4 text-slate-600">
        The link may be broken or the page may have been moved. Use the navigation or go back home.
      </p>
      <Link
        to="/"
        className="mt-10 inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-3 text-sm font-bold text-white shadow-md hover:brightness-110"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to home
      </Link>
    </section>
  )
}
