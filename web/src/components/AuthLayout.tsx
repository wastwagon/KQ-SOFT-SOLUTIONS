import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, FileText, ShieldCheck, Zap } from 'lucide-react'
import BrandLogo from './BrandLogo'

const BENEFITS = [
  { icon: Zap, text: 'Smart matching tuned for common bank statement layouts' },
  { icon: FileText, text: 'Audit-ready BRS exports in Excel and PDF' },
  { icon: ShieldCheck, text: 'Role-based access and a full activity trail' },
] as const

type AuthLayoutProps = {
  children: ReactNode
  /** Small uppercase label above the title (e.g. “Welcome back”) */
  eyebrow?: string
  title: string
  /** One line under the title in the form column */
  subtitle?: string
}

/**
 * Marketing-quality shell for sign-in, register, and password recovery.
 * Split view on large screens; stacked, full-bleed form on small screens.
 */
export default function AuthLayout({ children, eyebrow, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white">
      {/* Brand panel — hidden on small screens; condensed strip on md */}
      <aside
        className="relative hidden lg:flex lg:w-[min(44%,520px)] xl:w-[min(40%,560px)] shrink-0 flex-col justify-between overflow-hidden bg-gradient-to-br from-primary-700 via-primary-600 to-[#062e57] px-10 py-12 xl:px-14 xl:py-16 text-white"
        aria-label="KQ-SOFT product overview"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.35]">
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-green-400/30 blur-3xl" />
          <div className="absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-primary-300/25 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage: `
                linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)`,
              backgroundSize: '48px 48px',
            }}
          />
        </div>

        <div className="relative z-10">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl bg-white/95 px-3 py-2.5 shadow-lg shadow-black/10 transition-transform hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          >
            <BrandLogo className="h-9 w-auto" />
          </Link>

          <p className="mt-10 text-xs font-bold uppercase tracking-[0.2em] text-primary-200/90">
            KQ-SOFT
          </p>
          <h1 className="mt-3 text-3xl xl:text-4xl font-bold tracking-tight leading-tight text-white">
            Reconcile faster.
            <br />
            <span className="text-primary-100">Report with confidence.</span>
          </h1>
          <ul className="mt-10 space-y-4 max-w-sm">
            {BENEFITS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-sm text-primary-50/95">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
                  <Icon className="h-4 w-4 text-white" strokeWidth={2} />
                </span>
                <span className="leading-snug pt-1">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-primary-200/80">
          Subscriptions in GHS · per-project GHS, USD, or EUR for BRS reporting.
        </p>
      </aside>

      {/* Mobile / tablet: compact brand strip */}
      <div className="lg:hidden border-b border-gray-100 bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-5 text-center">
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-xl bg-white px-3 py-2 shadow-md"
        >
          <BrandLogo className="h-9 w-auto" />
        </Link>
        <p className="mt-3 text-xs font-medium uppercase tracking-wider text-primary-100/90">
          Bank reconciliation · cloud workspace
        </p>
      </div>

      {/* Form column */}
      <main className="flex flex-1 flex-col justify-center px-4 py-10 sm:px-8 sm:py-14 lg:px-12 xl:px-20 bg-surface">
        <div className="mx-auto w-full max-w-md">
          <Link
            to="/"
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>

          <div className="lg:mb-2">
            {eyebrow && (
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary-600">
                {eyebrow}
              </p>
            )}
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>

          <div className="mt-8">{children}</div>

          <ul className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-gray-500 lg:justify-start">
            <li className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-green-600" />
              <span>HTTPS & encrypted sessions</span>
            </li>
            <li className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-green-600" />
              <span>Your data stays in your org</span>
            </li>
          </ul>
        </div>
      </main>
    </div>
  )
}

/** Shared field styles for auth forms */
export const authFieldClass =
  'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-gray-900 shadow-sm placeholder:text-gray-400 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20'

export const authLabelClass = 'mb-1.5 block text-sm font-medium text-gray-700'

export const authPrimaryButtonClass =
  'w-full rounded-xl bg-primary-600 py-3 px-4 text-sm font-semibold text-white shadow-lg shadow-primary-600/25 transition-all hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50'

export const authCardClass =
  'rounded-2xl border border-gray-200/80 bg-white p-7 shadow-[0_8px_30px_rgb(0,0,0,0.06)] sm:p-8'

export const authAlertErrorClass =
  'rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700'

export const authAlertWarnClass =
  'rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900'
