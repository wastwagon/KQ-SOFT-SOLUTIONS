import { Link } from 'react-router-dom'
import BrandLogo from '../components/BrandLogo'
import type { ReactNode } from 'react'

type LegalDocumentProps = {
  title: string
  updated: string
  children: ReactNode
}

/**
 * Shared shell for public Privacy / Terms pages.
 */
export default function LegalDocument({ title, updated, children }: LegalDocumentProps) {
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header className="border-b border-gray-100 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link
            to="/"
            className="inline-flex items-center rounded-xl border border-border bg-white px-3 py-2 shadow-card transition-transform hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label="KQ-SOFT home"
          >
            <BrandLogo className="h-8 w-auto" />
          </Link>
          <nav className="flex items-center gap-4 text-sm text-gray-600">
            <Link to="/privacy" className="hover:text-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded">
              Terms
            </Link>
            <Link
              to="/login"
              className="font-medium text-primary-600 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">Legal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-gray-500">Last updated {updated}</p>
        <div className="prose-legal mt-10 space-y-6 text-sm leading-relaxed text-gray-700 sm:text-base">
          {children}
        </div>
      </main>

      <footer className="border-t border-gray-100 bg-white py-6 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} KQ-SOFT Solutions.{' '}
        <a
          href="mailto:info@kqsoftwaresolutions.com"
          className="font-medium text-primary-600 hover:underline"
        >
          info@kqsoftwaresolutions.com
        </a>
      </footer>
    </div>
  )
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  )
}
