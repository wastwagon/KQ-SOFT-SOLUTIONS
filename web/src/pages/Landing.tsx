import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Check,
  ChevronDown,
  Database,
  Facebook,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  Linkedin,
  LineChart,
  Lock,
  Mail,
  MapPin,
  Menu,
  Minus,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
  Twitter,
  Upload,
  Users,
  Workflow,
  X,
  Zap,
} from 'lucide-react'
import BrandLogo from '../components/BrandLogo'
import SubscriptionFxReference from '../components/marketing/SubscriptionFxReference'
import { publicApi } from '../lib/api'
import { useAuth } from '../store/auth'
import {
  FEATURE_GROUPS,
  formatGhs,
  mergeWithApiPlans,
  type MarketingPlan,
} from '../lib/plans'

/* ---------------------------------------------------------------------------
 * Premium SaaS landing page — KQ-SOFT Bank Reconciliation
 *
 * Sections:
 *   0. Announcement bar (intro offer, dismissible)
 *   1. Sticky glass-morphism navigation
 *   2. Hero (headline + dual CTA + animated dashboard mockup)
 *   3. Trust strip (example bank / statement layouts)
 *   4. Stat band
 *   5. Features grid (6 cards)
 *   6. How it works (3 steps)
 *   7. Dashboard showcase
 *   8. Pricing (static catalogue, 4 tiers + comparison table)
 *   9. Testimonials
 *  10. FAQ accordion
 *  11. Final CTA banner
 *  12. Footer (dark, multi-column, with newsletter + social)
 *
 * Visual treatment:
 *   - Brand palette: primary blue (#0473ea) + accent green (#38d200)
 *   - Mesh-gradient hero background with floating colour blobs
 *   - Subtle grid overlay for depth
 *   - Smooth fade-in on scroll via IntersectionObserver
 *   - Built entirely with Tailwind utilities + a small inline <style>
 *     block for keyframes; no extra dependencies.
 *
 * Pricing data flow:
 *   - Static catalogue lives in src/lib/plans.ts and ALWAYS renders.
 *   - Optional API call to /api/v1/public/plans overrides price/limits in-place.
 *   - This guarantees the pricing section never appears empty on production.
 * ------------------------------------------------------------------------- */

const FEATURES = [
  {
    icon: Zap,
    title: 'Smart matching engine',
    description:
      'One-to-one, one-to-many, and many-to-many suggestions ranked by amount, date window, references, and cheque numbers. Confirm in bulk or one click at a time.',
  },
  {
    icon: Database,
    title: 'Statement layouts that ship ready',
    description:
      'Pre-built parsers for major regional banks (plus generic Excel, CSV, and PDF). Scanned PDFs and odd columns are handled with OCR and guided mapping.',
  },
  {
    icon: FileText,
    title: 'Audit-ready reports',
    description:
      'Branded BRS in Excel and PDF with preparer/reviewer sign-off, discrepancy lines, and an immutable trail of who changed what and when.',
  },
  {
    icon: Users,
    title: 'Multi-client workspace',
    description:
      'Run every engagement from one hub: separate projects, shared templates, and roll-forward so nothing drops between periods.',
  },
  {
    icon: ShieldCheck,
    title: 'Roles & approvals',
    description:
      'Preparer → Reviewer → Approver with locked states. Threshold rules surface large variances before anything is marked final.',
  },
  {
    icon: Workflow,
    title: 'API & bank rules',
    description:
      'Public REST hooks for firm automation. A configurable rules layer flags, tags, or steers the matcher before humans touch the grid.',
  },
] as const

const STEPS = [
  {
    icon: Upload,
    title: 'Upload',
    description:
      'Bring the cash book and bank file — Excel, CSV, PDF, or scan. Column detection and layout hints get you to a clean grid in minutes.',
  },
  {
    icon: Sparkles,
    title: 'Match',
    description:
      'Suggestions are scored and grouped so your team reviews the highest-impact lines first. Split lines, undo, or approve in bulk.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Report',
    description:
      'Publish a branded BRS, capture sign-off, lock the period, and roll unresolved items forward without rebuilding from scratch.',
  },
] as const

const BANKS_SUPPORTED = [
  'Ecobank',
  'GCB',
  'Access',
  'Stanbic',
  'Fidelity',
  'Zenith',
  'CalBank',
  'ADB',
] as const

const TESTIMONIALS = [
  {
    quote:
      'Work that stretched across three days now finishes in about an hour. The tuned statement layouts meant we did not have to babysit column mapping.',
    author: 'Senior Accountant',
    role: 'Regional audit firm',
  },
  {
    quote:
      'The audit trail and sign-off workflow paid for themselves in the first month. Clients see exactly who approved each match.',
    author: 'Practice Partner',
    role: 'Mid-tier accounting firm',
  },
  {
    quote:
      'We onboarded the team in one afternoon. The UI stays out of the way, matching is dependable, and branded exports look like ours — not generic SaaS.',
    author: 'Finance Manager',
    role: 'Logistics & supply chain',
  },
] as const

const FAQS = [
  {
    q: 'Which banks or statement formats are supported?',
    a: 'We ship parsers tuned for major regional banks (for example Ecobank, GCB, Access, Stanbic, Fidelity, Zenith, CalBank, ADB) plus generic Excel, CSV, and PDF layouts. Scanned statements are supported with OCR. Non-standard files can be mapped; Standard tier and above includes parser tuning support.',
  },
  {
    q: 'Do I need to install anything?',
    a: 'No. KQ-SOFT runs in the browser. Create an organisation, upload files, and reconcile. There is no desktop agent to maintain.',
  },
  {
    q: 'Can my team collaborate on the same project?',
    a: 'Yes. Invite colleagues as Preparer, Reviewer, or Approver. Every change is written to the audit trail. Seat limits follow the subscription tier.',
  },
  {
    q: 'How does pricing and currency work?',
    a: 'Subscriptions are billed in Ghana cedis (GHS) through Paystack on monthly or annual cycles. The public site shows approximate USD/EUR/GBP equivalents for reference only — checkout always charges GHS. Inside the product, each project can use its own reporting currency (GHS, USD, or EUR) for BRS and balances.',
  },
  {
    q: 'Is my data secure?',
    a: 'Files live on encrypted storage inside managed infrastructure. Access is scoped per organisation and role. Sessions use signed JWTs over HTTPS. We do not sell or share customer data with advertisers.',
  },
  {
    q: 'Can I export BRS reports with my own logo and colours?',
    a: 'Yes. Standard and above include full branding — logo, palette, report title, and footer — so deliverables match your firm template.',
  },
] as const

export default function Landing() {
  const [navOpen, setNavOpen] = useState(false)
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [showAnnouncement, setShowAnnouncement] = useState(true)
  const [showCompare, setShowCompare] = useState(false)

  const { data: plansData } = useQuery({
    queryKey: ['public', 'plans'],
    queryFn: publicApi.getPlans,
    staleTime: 5 * 60 * 1000,
    retry: 0,
  })

  // Static catalogue is the source of truth — API only overrides price/limits.
  const plans = useMemo(() => mergeWithApiPlans(plansData?.plans), [plansData])

  // Smooth fade-in on scroll for any element marked with [data-reveal].
  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return
    const els = document.querySelectorAll<HTMLElement>('[data-reveal]')
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed')
            io.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.12 }
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])

  return (
    <div className="min-h-screen bg-white text-gray-900 antialiased">
      {/* Inline keyframes / one-off styles. Kept local so the page is
          self-contained — no global stylesheet edits required. */}
      <style>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(20px, -25px) scale(1.07); }
          66% { transform: translate(-18px, 18px) scale(0.95); }
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(0.85); }
        }
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .animate-blob { animation: blob 18s ease-in-out infinite; }
        .animate-blob-slow { animation: blob 26s ease-in-out infinite; }
        .animate-pulse-dot { animation: pulseDot 2.4s ease-in-out infinite; }
        .gradient-text {
          background: linear-gradient(120deg, #0473ea 0%, #1a7de8 30%, #38d200 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .nav-shimmer {
          background: linear-gradient(120deg, #0473ea 0%, #2563eb 40%, #0473ea 80%);
          background-size: 220% 100%;
          animation: shimmer 6s linear infinite;
        }
        .marquee-track { animation: marquee 38s linear infinite; }
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        [data-reveal] {
          opacity: 0;
          transform: translateY(18px);
          transition: opacity 0.7s ease-out, transform 0.7s ease-out;
        }
        [data-reveal].is-revealed {
          opacity: 1;
          transform: translateY(0);
        }
        .grid-overlay {
          background-image:
            linear-gradient(rgba(15, 23, 42, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(15, 23, 42, 0.04) 1px, transparent 1px);
          background-size: 56px 56px;
        }
        .grid-overlay-dark {
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
          background-size: 56px 56px;
        }
      `}</style>

      <AnnouncementBar visible={showAnnouncement} onDismiss={() => setShowAnnouncement(false)} />
      <Nav navOpen={navOpen} setNavOpen={setNavOpen} />
      <Hero />
      <BankStrip />
      <StatBand />
      <Features />
      <HowItWorks />
      <DashboardShowcase />
      <Pricing
        plans={plans}
        billingPeriod={billingPeriod}
        setBillingPeriod={setBillingPeriod}
        showCompare={showCompare}
        setShowCompare={setShowCompare}
      />
      <Testimonials />
      <Faq openFaq={openFaq} setOpenFaq={setOpenFaq} />
      <FinalCta />
      <Footer />
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * Section 0: Announcement bar
 * ------------------------------------------------------------------------- */

function AnnouncementBar({
  visible,
  onDismiss,
}: {
  visible: boolean
  onDismiss: () => void
}) {
  const isAuthed = useAuth((s) => !!s.token)
  if (!visible) return null
  return (
    <div className="relative z-40 nav-shimmer text-white">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 sm:px-6 lg:px-8 py-2 text-center text-xs sm:text-sm">
        <Sparkles className="hidden sm:inline h-4 w-4 shrink-0 text-white/90" aria-hidden />
        <span className="font-medium">
          Welcome offer · <span className="font-bold">50% off your first 2 months</span> on any paid plan
        </span>
        <Link
          to={isAuthed ? '/settings/billing' : '/register'}
          className="hidden sm:inline-flex items-center gap-1 ml-2 px-2.5 py-0.5 rounded-full bg-white/15 hover:bg-white/25 font-semibold transition-colors"
        >
          {isAuthed ? 'Billing' : 'Claim it'}
          <ArrowRight className="w-3 h-3" />
        </Link>
        <button
          type="button"
          onClick={onDismiss}
          className="ml-3 inline-flex w-6 h-6 rounded-full hover:bg-white/15 items-center justify-center transition-colors flex-shrink-0"
          aria-label="Dismiss announcement"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * Section 1: Navigation
 * ------------------------------------------------------------------------- */

function Nav({ navOpen, setNavOpen }: { navOpen: boolean; setNavOpen: (b: boolean) => void }) {
  const isAuthed = useAuth((s) => !!s.token)
  const links: { label: string; href: string }[] = [
    { label: 'Features', href: '#features' },
    { label: 'How it works', href: '#how-it-works' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
  ]
  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200/60 bg-white/85 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 h-16 sm:h-18">
        <Link
          to="/"
          className="flex items-center gap-2 shrink-0 group"
          aria-label="KQ-SOFT home"
        >
          <BrandLogo className="h-10 w-auto transition-transform group-hover:scale-105" />
        </Link>

        <nav className="hidden md:flex items-center gap-1" aria-label="Primary">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="relative px-3 py-2 text-sm font-semibold text-gray-700 hover:text-primary-700 rounded-lg transition-colors group"
            >
              {l.label}
              <span className="absolute left-3 right-3 -bottom-0.5 h-0.5 rounded-full bg-gradient-to-r from-primary-500 to-green-500 scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {isAuthed ? (
            <Link
              to="/dashboard"
              className="group relative inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white rounded-xl shadow-md shadow-primary-600/25 transition-all hover:shadow-lg hover:shadow-primary-600/30 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 nav-shimmer"
            >
              Dashboard
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="px-4 py-2 text-sm font-semibold text-gray-700 hover:text-primary-700 rounded-lg hover:bg-primary-50/60 transition-colors"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="group relative inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white rounded-xl shadow-md shadow-primary-600/25 transition-all hover:shadow-lg hover:shadow-primary-600/30 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 nav-shimmer"
              >
                Start free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setNavOpen(!navOpen)}
          className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg text-gray-700 hover:bg-gray-100"
          aria-label={navOpen ? 'Close menu' : 'Open menu'}
        >
          {navOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {navOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white">
          <div className="px-4 py-4 space-y-1">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setNavOpen(false)}
                className="block px-3 py-2 text-base font-medium text-gray-700 hover:text-gray-900 rounded-lg hover:bg-gray-50"
              >
                {l.label}
              </a>
            ))}
            <div className={`pt-3 border-t border-gray-100 grid gap-2 ${isAuthed ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {isAuthed ? (
                <Link
                  to="/dashboard"
                  className="text-center px-4 py-2 text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 rounded-xl"
                  onClick={() => setNavOpen(false)}
                >
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-center px-4 py-2 text-sm font-semibold text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
                    onClick={() => setNavOpen(false)}
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    className="text-center px-4 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl"
                    onClick={() => setNavOpen(false)}
                  >
                    Start free
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

/* ---------------------------------------------------------------------------
 * Section 2: Hero
 * ------------------------------------------------------------------------- */

function Hero() {
  const isAuthed = useAuth((s) => !!s.token)
  return (
    <section className="relative isolate overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-50/60 via-white to-white" />
        <div className="absolute inset-0 grid-overlay opacity-60" />
        <div className="absolute -top-32 left-1/4 h-[420px] w-[420px] rounded-full bg-primary-300/30 blur-3xl animate-blob" />
        <div className="absolute top-10 right-1/4 h-[360px] w-[360px] rounded-full bg-green-300/25 blur-3xl animate-blob-slow" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-[340px] w-[600px] rounded-full bg-primary-200/30 blur-3xl animate-blob" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 pb-20 sm:pt-24 sm:pb-28 lg:pt-28 lg:pb-32">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-gray-200/90 bg-gradient-to-br from-white via-slate-50/90 to-white px-4 py-2 shadow-sm ring-1 ring-black/[0.04]">
            <span className="relative inline-flex shrink-0">
              <span className="absolute inset-0 rounded-full bg-green-500 animate-pulse-dot" />
              <span className="relative h-2 w-2 rounded-full bg-green-500" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-primary-600">
              Modern bank rec for distributed teams
            </span>
          </div>

          <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 leading-[1.05] sm:mt-6">
            Bank reconciliation,
            <br className="hidden sm:block" />
            <span className="gradient-text"> automated end to end.</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-gray-600 leading-relaxed max-w-2xl mx-auto">
            Pair the cash book with the bank file in one workspace. Intelligent matching
            handles cheques, wires, and split lines — then ships a signed-off BRS you can
            stand behind, without the spreadsheet marathon.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to={isAuthed ? '/dashboard' : '/register'}
              className="group inline-flex items-center gap-2 px-6 py-3 text-base font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-lg shadow-primary-600/20 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
              {isAuthed ? 'Go to dashboard' : 'Start free trial'}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center gap-2 px-6 py-3 text-base font-semibold text-gray-700 bg-white hover:bg-gray-50 rounded-xl border border-gray-200 shadow-sm transition-colors"
            >
              See how it works
            </a>
          </div>

          <p className="mt-5 text-sm text-gray-500">
            {isAuthed
              ? 'Signed in — open your workspace to continue reconciliations.'
              : 'No credit card required · Set up in under 5 minutes'}
          </p>
        </div>

        <div data-reveal className="relative mt-14 sm:mt-20 mx-auto max-w-5xl">
          <div className="absolute -inset-4 sm:-inset-6 rounded-[2rem] bg-gradient-to-br from-primary-200/40 via-white/0 to-green-200/40 blur-2xl" aria-hidden />
          <DashboardMockup />
        </div>
      </div>
    </section>
  )
}

/* Stylised dashboard preview — a product mockup built from real components. */

function DashboardMockup() {
  return (
    <div className="relative rounded-xl border border-gray-200/80 bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/80">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="px-3 py-1 rounded-md bg-white border border-gray-200 text-[11px] font-medium text-gray-500">
            app.kqsoft.com / dashboard
          </div>
        </div>
        <div className="w-12" />
      </div>

      <div className="grid grid-cols-12 min-h-[420px]">
        <div className="hidden sm:flex flex-col col-span-3 lg:col-span-2 border-r border-gray-100 bg-gray-50/50 p-4 gap-1">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg bg-primary-600 grid place-items-center text-white text-xs font-bold">
              KQ
            </div>
            <span className="text-xs font-bold text-gray-700">KQ-SOFT</span>
          </div>
          {[
            { icon: LayoutDashboard, label: 'Dashboard', active: true },
            { icon: FileText, label: 'Projects' },
            { icon: Users, label: 'Clients' },
            { icon: LineChart, label: 'Reports' },
            { icon: Lock, label: 'Audit' },
          ].map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.label}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium ${
                  item.active
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-600'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </div>
            )
          })}
        </div>

        <div className="col-span-12 sm:col-span-9 lg:col-span-10 p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900">Dashboard</h3>
              <p className="text-xs text-gray-500">Live reconciliation overview</p>
            </div>
            <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary-50 text-primary-700 text-[11px] font-semibold border border-primary-100">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
              Live data
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
            {[
              { label: 'Projects', value: '24', accent: 'bg-primary-500' },
              { label: 'Pending', value: '3', accent: 'bg-amber-500' },
              { label: 'Matched', value: '96%', accent: 'bg-green-500' },
              { label: 'This month', value: '1.2k', accent: 'bg-indigo-500' },
            ].map((m) => (
              <div
                key={m.label}
                className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
              >
                <div className="flex items-center gap-1.5">
                  <span className={`w-1 h-3 rounded-full ${m.accent}`} />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    {m.label}
                  </span>
                </div>
                <p className="mt-1.5 text-lg sm:text-xl font-bold text-gray-900 tabular-nums">
                  {m.value}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
              <span className="text-xs font-bold text-gray-700">
                Suggested matches
              </span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                3 ready
              </span>
            </div>
            <div className="divide-y divide-gray-100 text-[11px] sm:text-xs">
              {[
                {
                  cb: 'Cheque 002145 · ZK Logistics',
                  bank: 'CHQ 2145 ECOB CR',
                  amount: 'GHS 12,400.00',
                },
                {
                  cb: 'Mobile money · Pay Bola',
                  bank: 'MOMO 0240XXX5891',
                  amount: 'GHS 850.00',
                },
                {
                  cb: 'Wire · Regional vendor payment',
                  bank: 'EFT 81203 / TOS',
                  amount: 'GHS 4,250.00',
                },
              ].map((row, i) => (
                <div
                  key={i}
                  className="grid grid-cols-12 items-center gap-2 px-3 py-2.5"
                >
                  <span className="col-span-5 truncate text-gray-700">{row.cb}</span>
                  <span className="col-span-1 text-center text-primary-500 font-bold">
                    ↔
                  </span>
                  <span className="col-span-4 truncate text-gray-700">
                    {row.bank}
                  </span>
                  <span className="col-span-2 text-right tabular-nums font-semibold text-gray-900">
                    {row.amount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="hidden sm:flex absolute -right-4 top-28 lg:top-24 items-center gap-2 px-3 py-2 rounded-xl bg-white shadow-lg ring-1 ring-black/5 border border-gray-100">
        <span className="w-7 h-7 rounded-full bg-green-100 grid place-items-center">
          <Check className="w-4 h-4 text-green-600" />
        </span>
        <div className="text-left">
          <p className="text-[11px] font-bold text-gray-900 leading-none">
            Auto-matched
          </p>
          <p className="text-[10px] text-gray-500 leading-none mt-0.5">
            42 transactions · 98%
          </p>
        </div>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * Section 3: Bank trust strip (marquee)
 * ------------------------------------------------------------------------- */

function BankStrip() {
  const items = [...BANKS_SUPPORTED, ...BANKS_SUPPORTED]
  return (
    <section className="border-y border-gray-100 bg-gray-50/30 py-12 sm:py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl rounded-xl border border-gray-200/90 bg-gradient-to-br from-white via-slate-50/80 to-white px-6 py-7 text-center shadow-sm sm:px-8 sm:py-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">
            Bank formats
          </p>
          <p className="mt-1 text-lg sm:text-xl font-bold tracking-tight text-gray-900">
            Pre-built statement layouts (examples)
          </p>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">
            Plus generic Excel, CSV, and PDF — tune or extend layouts as your client base grows.
          </p>
        </div>
        <div className="mt-10 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-white to-transparent z-10" />
          <div className="flex gap-10 marquee-track w-max">
            {items.map((name, i) => (
              <div
                key={`${name}-${i}`}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-gray-50/80 text-gray-600 font-semibold tracking-wide whitespace-nowrap"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                {name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------------------
 * Section 4: Stat band
 * ------------------------------------------------------------------------- */

function StatBand() {
  const stats = [
    { value: '10×', label: 'faster than manual spreadsheet reconciliation' },
    { value: '98%', label: 'typical auto-match rate on tuned statement layouts' },
    { value: '< 5 min', label: 'from sign-up to first reconciled grid' },
  ]
  return (
    <section className="py-24 sm:py-28 border-y border-gray-100 bg-gray-50/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          data-reveal
          className="rounded-xl border border-gray-200/90 bg-gradient-to-br from-white via-slate-50/70 to-white px-6 py-10 shadow-sm sm:px-10 sm:py-12"
        >
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-10">
          {stats.map((s, i) => (
            <div
              key={i}
              className="text-center sm:text-left border-l-4 border-primary-500 pl-5"
            >
              <p className="text-4xl sm:text-5xl font-bold tracking-tight text-gray-900 tabular-nums">
                {s.value}
              </p>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">{s.label}</p>
            </div>
          ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------------------
 * Section 5: Features
 * ------------------------------------------------------------------------- */

function Features() {
  return (
    <section id="features" className="py-24 sm:py-32 bg-gray-50/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          data-reveal
          className="mx-auto max-w-2xl rounded-xl border border-gray-200/90 bg-gradient-to-br from-white via-slate-50/80 to-white px-6 py-8 text-center shadow-sm sm:px-10 sm:py-10"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">
            Features
          </p>
          <h2 className="mt-1 text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
            Everything you need to close a defensible bank rec.
          </h2>
          <p className="mt-2 text-base sm:text-lg text-gray-600 leading-relaxed">
            Ingestion, matching, approvals, and client-ready reporting — orchestrated in
            one place so reviewers spend time on exceptions, not formatting.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {FEATURES.map((f) => {
            const Icon = f.icon
            return (
              <div
                key={f.title}
                data-reveal
                className="group relative rounded-xl border border-gray-200 bg-white p-7 shadow-sm hover:shadow-xl hover:-translate-y-0.5 hover:border-primary-200 transition-all duration-300"
              >
                <div className="absolute inset-x-0 top-0 h-1 rounded-t-xl bg-gradient-to-r from-primary-500 to-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-11 h-11 rounded-xl bg-primary-50 grid place-items-center text-primary-600 ring-1 ring-primary-100">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-gray-900">{f.title}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                  {f.description}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------------------
 * Section 6: How it works
 * ------------------------------------------------------------------------- */

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          data-reveal
          className="mx-auto max-w-2xl rounded-xl border border-gray-200/90 bg-gradient-to-br from-white via-slate-50/80 to-white px-6 py-8 text-center shadow-sm sm:px-10 sm:py-10"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">
            How it works
          </p>
          <h2 className="mt-1 text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
            Three steps from raw files to a signed-off BRS.
          </h2>
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            return (
              <div
                key={s.title}
                data-reveal
                className="relative rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex w-9 h-9 rounded-full bg-primary-600 text-white text-sm font-bold items-center justify-center ring-4 ring-primary-100">
                    {i + 1}
                  </span>
                  <Icon className="w-5 h-5 text-primary-600" />
                </div>
                <h3 className="mt-4 text-lg font-bold text-gray-900">{s.title}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">
                  {s.description}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------------------
 * Section 7: Dashboard showcase
 * ------------------------------------------------------------------------- */

function DashboardShowcase() {
  const isAuthed = useAuth((s) => !!s.token)
  return (
    <section className="py-24 sm:py-32 bg-gradient-to-b from-white via-gray-50/60 to-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div data-reveal>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">
              Built for accountants
            </p>
            <h2 className="mt-1 text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
              Familiar controls — without the busywork.
            </h2>
            <p className="mt-2 text-base sm:text-lg text-gray-600 leading-relaxed">
              The product mirrors how firms already think about bank recs: uncredited
              lodgments, unpresented cheques, brought-forward lines, and discrepancy
              narratives — automated where it helps, transparent where it matters.
            </p>
            <ul className="mt-7 space-y-3">
              {[
                'Uncredited lodgments and unpresented cheques calculated automatically.',
                'Discrepancy report flags amount and date variances in matched pairs.',
                'Roll-forward carries unresolved items into the next reconciliation period.',
                'Branded Excel and PDF BRS exports with your logo and colours.',
              ].map((line) => (
                <li key={line} className="flex items-start gap-3">
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-green-100 grid place-items-center flex-shrink-0">
                    <Check className="w-3 h-3 text-green-700" />
                  </span>
                  <span className="text-sm text-gray-700">{line}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex gap-3">
              <Link
                to={isAuthed ? '/dashboard' : '/register'}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm"
              >
                {isAuthed ? 'Open dashboard' : 'Try it free'}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#pricing"
                className="inline-flex items-center px-5 py-2.5 text-sm font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg"
              >
                See pricing
              </a>
            </div>
          </div>

          <div data-reveal className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-primary-100 via-white to-green-100 blur-2xl opacity-60" aria-hidden />
            <div className="relative rounded-xl border border-gray-200 bg-white p-2 shadow-2xl ring-1 ring-black/5">
              <div className="rounded-xl border border-gray-100 bg-gradient-to-br from-gray-50 to-white p-5">
                <h4 className="text-sm font-bold text-gray-900">
                  Bank Reconciliation Statement
                </h4>
                <p className="text-[11px] text-gray-500">
                  Period ending 31 Mar — Acme Logistics Ltd
                </p>
                <div className="mt-4 space-y-2 text-sm">
                  {[
                    { label: 'Balance per bank statement', val: 'GHS 482,150.00' },
                    { label: 'Add: Uncredited lodgments', val: 'GHS 18,400.00' },
                    { label: 'Less: Unpresented cheques', val: '(GHS 12,250.00)' },
                    { label: 'Bank-only reconciling items', val: 'GHS 1,100.00' },
                  ].map((r) => (
                    <div
                      key={r.label}
                      className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0"
                    >
                      <span className="text-gray-700">{r.label}</span>
                      <span className="tabular-nums font-medium text-gray-900">
                        {r.val}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-lg bg-primary-50 border border-primary-100 px-3 py-2.5 flex justify-between items-center">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary-700">
                    Balance per cash book
                  </span>
                  <span className="tabular-nums font-bold text-primary-900">
                    GHS 489,400.00
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-[11px] text-gray-500">
                  <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
                  Signed off by reviewer · Audit trail captured
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------------------
 * Section 8: Pricing — 4 tiers + comparison table
 *
 * Renders directly from the static catalogue (always available), with API
 * data merged in to override price/limits when reachable.
 * ------------------------------------------------------------------------- */

function Pricing({
  plans,
  billingPeriod,
  setBillingPeriod,
  showCompare,
  setShowCompare,
}: {
  plans: MarketingPlan[]
  billingPeriod: 'monthly' | 'yearly'
  setBillingPeriod: (p: 'monthly' | 'yearly') => void
  showCompare: boolean
  setShowCompare: (b: boolean) => void
}) {
  return (
    <section id="pricing" className="relative py-24 sm:py-32 bg-gray-50/40 overflow-hidden">
      <div aria-hidden className="absolute -top-32 right-0 h-[420px] w-[420px] rounded-full bg-primary-200/25 blur-3xl" />
      <div aria-hidden className="absolute -bottom-32 left-0 h-[420px] w-[420px] rounded-full bg-green-200/20 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          data-reveal
          className="mx-auto max-w-2xl rounded-xl border border-gray-200/90 bg-gradient-to-br from-white via-slate-50/80 to-white px-6 py-8 text-center shadow-sm sm:px-10 sm:py-10"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">
            Pricing
          </p>
          <h2 className="mt-1 text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
            Simple pricing — billed in GHS via Paystack.
          </h2>
          <p className="mt-2 text-base sm:text-lg text-gray-600">
            Start free. Pay monthly or save ~17% annually. Checkout is always in{' '}
            <abbr title="Ghana cedis">GHS</abbr> via Paystack; use the reference converter below for USD, EUR, or GBP.
            Each project&apos;s BRS currency (GHS, USD, or EUR) is chosen in the app.
          </p>

          {/* Billing period toggle */}
          <div className="mt-8 inline-flex items-center p-1 rounded-xl border border-gray-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setBillingPeriod('monthly')}
              className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
                billingPeriod === 'monthly'
                  ? 'bg-primary-600 text-white shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingPeriod('yearly')}
              className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                billingPeriod === 'yearly'
                  ? 'bg-primary-600 text-white shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Yearly
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  billingPeriod === 'yearly'
                    ? 'bg-white text-primary-700'
                    : 'bg-green-100 text-green-700'
                }`}
              >
                save ~17%
              </span>
            </button>
          </div>
        </div>

        <div className="mt-10 max-w-4xl mx-auto w-full">
          <SubscriptionFxReference plans={plans} billingPeriod={billingPeriod} />
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {plans.map((p) => (
            <PlanCard key={p.slug} plan={p} period={billingPeriod} />
          ))}
        </div>

        {/* Trust line */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-gray-600">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-green-600" />
            Paystack checkout · charged in GHS
          </span>
          <span className="inline-flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600" />
            Cancel any time
          </span>
          <span className="inline-flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            50% off your first 2 months
          </span>
        </div>

        {/* Comparison table toggle */}
        <div className="mt-10 text-center">
          <button
            type="button"
            onClick={() => setShowCompare(!showCompare)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-primary-700 bg-white border border-primary-200 hover:bg-primary-50 rounded-lg transition-colors"
            aria-expanded={showCompare}
          >
            {showCompare ? 'Hide full comparison' : 'Compare all features'}
            <ChevronDown
              className={`w-4 h-4 transition-transform ${showCompare ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        {showCompare && <ComparisonTable plans={plans} />}

        <p className="mt-10 text-center text-sm text-gray-500">
          Need something custom?{' '}
          <a
            href="mailto:info@kqsoftwaresolutions.com?subject=KQ-SOFT%20enterprise%20enquiry"
            className="font-semibold text-primary-600 hover:underline"
          >
            Talk to us
          </a>{' '}
          about firm and enterprise plans.
        </p>
      </div>
    </section>
  )
}

function PlanCard({
  plan,
  period,
}: {
  plan: MarketingPlan
  period: 'monthly' | 'yearly'
}) {
  const isAuthed = useAuth((s) => !!s.token)
  const isHighlight = !!plan.highlight
  const isCustom = plan.monthlyGhs <= 0 && plan.yearlyGhs <= 0
  const amount = period === 'yearly' ? plan.yearlyGhs : plan.monthlyGhs
  const monthlyEq = period === 'yearly' ? plan.yearlyGhs / 12 : null
  const ctaHref =
    isAuthed && plan.ctaHref === '/register' ? '/settings/billing' : plan.ctaHref
  const ctaLabel =
    isAuthed && plan.ctaHref === '/register' ? 'Billing & plans' : plan.ctaLabel
  const isInternalCta = ctaHref.startsWith('/')

  return (
    <div
      data-reveal
      className={`relative rounded-xl p-6 flex flex-col transition-all duration-300 ${
        isHighlight
          ? 'border-2 border-primary-500 bg-white shadow-2xl shadow-primary-600/15 ring-1 ring-primary-100 scale-[1.02] lg:scale-[1.04]'
          : 'border border-gray-200 bg-white shadow-sm hover:shadow-lg hover:border-primary-200'
      }`}
    >
      {plan.badge && (
        <span
          className={`absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider shadow ${
            isHighlight
              ? 'bg-primary-600 text-white'
              : 'bg-gray-900 text-white'
          }`}
        >
          {isHighlight && <Sparkles className="w-3 h-3" />}
          {plan.badge}
        </span>
      )}

      <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
      <p className="mt-1 text-sm text-gray-500 min-h-[2.5rem]">{plan.tagline}</p>

      <div className="mt-5">
        {isCustom ? (
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold text-gray-900">Custom</span>
          </div>
        ) : (
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-gray-900 tabular-nums">
                {formatGhs(amount)}
              </span>
              <span className="text-sm text-gray-500">
                / {period === 'yearly' ? 'year' : 'month'}
              </span>
            </div>
            {monthlyEq !== null && (
              <p className="mt-1 text-[11px] text-gray-500">
                ≈ {formatGhs(Math.round(monthlyEq))} / month, billed annually
              </p>
            )}
          </div>
        )}
      </div>

      {plan.inheritsFromLabel && (
        <p className="mt-5 text-xs font-bold uppercase tracking-wider text-primary-700">
          {plan.inheritsFromLabel}
        </p>
      )}

      <ul className={`${plan.inheritsFromLabel ? 'mt-3' : 'mt-6'} space-y-3 flex-1`}>
        {plan.bullets.map((b) => (
          <li key={b} className="flex items-start gap-2.5 text-sm text-gray-700">
            <Check
              className={`mt-0.5 w-4 h-4 flex-shrink-0 ${
                isHighlight ? 'text-primary-600' : 'text-green-600'
              }`}
            />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      {isInternalCta ? (
        <Link
          to={ctaHref}
          className={`mt-7 inline-flex justify-center items-center gap-1.5 px-4 py-2.5 text-sm font-bold rounded-lg transition-all ${
            isHighlight
              ? 'text-white bg-primary-600 hover:bg-primary-700 shadow-md shadow-primary-600/20 hover:shadow-lg'
              : 'text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200'
          }`}
        >
          {ctaLabel}
          <ArrowRight className="w-4 h-4" />
        </Link>
      ) : (
        <a
          href={ctaHref}
          className={`mt-7 inline-flex justify-center items-center gap-1.5 px-4 py-2.5 text-sm font-bold rounded-lg transition-all ${
            isHighlight
              ? 'text-white bg-primary-600 hover:bg-primary-700 shadow-md shadow-primary-600/20'
              : 'text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200'
          }`}
        >
          {ctaLabel}
          <ArrowRight className="w-4 h-4" />
        </a>
      )}
    </div>
  )
}

/** Side-by-side feature comparison across all 4 plans, grouped by capability. */
function ComparisonTable({ plans }: { plans: MarketingPlan[] }) {
  return (
    <div data-reveal className="mt-12 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-gray-50 to-white">
              <th className="text-left px-5 py-4 text-xs font-bold uppercase tracking-wider text-gray-500 w-1/3">
                Feature
              </th>
              {plans.map((p) => (
                <th
                  key={p.slug}
                  className={`px-5 py-4 text-center text-sm font-bold ${
                    p.highlight ? 'text-primary-700' : 'text-gray-900'
                  }`}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <span>{p.name}</span>
                    {p.badge && (
                      <span
                        className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          p.highlight
                            ? 'bg-primary-100 text-primary-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {p.badge}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FEATURE_GROUPS.map((group) => (
              <FragmentGroup key={group.title} group={group} plans={plans} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FragmentGroup({
  group,
  plans,
}: {
  group: (typeof FEATURE_GROUPS)[number]
  plans: MarketingPlan[]
}) {
  return (
    <>
      <tr className="bg-gray-50/70 border-t border-gray-200">
        <td
          colSpan={1 + plans.length}
          className="px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-gray-500"
        >
          {group.title}
        </td>
      </tr>
      {group.features.map((feature) => (
        <tr key={feature.id} className="border-t border-gray-100">
          <td className="px-5 py-3 text-gray-700">{feature.label}</td>
          {plans.map((p) => {
            const v = p.features[feature.id]
            return (
              <td
                key={p.slug}
                className={`px-5 py-3 text-center ${
                  p.highlight ? 'bg-primary-50/40' : ''
                }`}
              >
                <FeatureCell value={v} highlight={!!p.highlight} />
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}

function FeatureCell({ value, highlight }: { value: boolean | string | undefined; highlight: boolean }) {
  if (value === true) {
    return (
      <Check
        className={`mx-auto w-5 h-5 ${highlight ? 'text-primary-600' : 'text-green-600'}`}
      />
    )
  }
  if (value === false || value === undefined) {
    return <Minus className="mx-auto w-4 h-4 text-gray-300" />
  }
  return (
    <span className="inline-block text-xs font-semibold text-gray-700 tabular-nums">
      {value}
    </span>
  )
}

/* ---------------------------------------------------------------------------
 * Section 9: Testimonials
 * ------------------------------------------------------------------------- */

function Testimonials() {
  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          data-reveal
          className="mx-auto max-w-2xl rounded-xl border border-gray-200/90 bg-gradient-to-br from-white via-slate-50/80 to-white px-6 py-8 text-center shadow-sm sm:px-10 sm:py-10"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">
            Teams worldwide rely on it
          </p>
          <h2 className="mt-1 text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
            What finance leaders say.
          </h2>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {TESTIMONIALS.map((t, i) => (
            <figure
              key={i}
              data-reveal
              className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm flex flex-col"
            >
              <div className="flex gap-0.5 text-amber-400" aria-hidden>
                {Array.from({ length: 5 }).map((_, idx) => (
                  <svg key={idx} className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.16c.969 0 1.371 1.24.588 1.81l-3.366 2.448a1 1 0 00-.364 1.118l1.287 3.957c.299.921-.755 1.688-1.539 1.118L10 14.347l-3.366 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.652 8.156c-.783-.57-.38-1.81.588-1.81h4.161a1 1 0 00.95-.69l1.286-3.957z" />
                  </svg>
                ))}
              </div>
              <blockquote className="mt-4 text-base text-gray-700 leading-relaxed flex-1">
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-5 pt-4 border-t border-gray-100">
                <p className="text-sm font-bold text-gray-900">{t.author}</p>
                <p className="text-xs text-gray-500">{t.role}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------------------
 * Section 10: FAQ
 * ------------------------------------------------------------------------- */

function Faq({
  openFaq,
  setOpenFaq,
}: {
  openFaq: number | null
  setOpenFaq: (i: number | null) => void
}) {
  return (
    <section id="faq" className="py-24 sm:py-32 bg-gray-50/40">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div
          data-reveal
          className="rounded-xl border border-gray-200/90 bg-gradient-to-br from-white via-slate-50/80 to-white px-6 py-8 text-center shadow-sm sm:px-10 sm:py-10"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">
            FAQ
          </p>
          <h2 className="mt-1 text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
            Common questions, answered.
          </h2>
        </div>

        <div className="mt-12 space-y-4">
          {FAQS.map((f, i) => {
            const isOpen = openFaq === i
            return (
              <div
                key={f.q}
                data-reveal
                className={`rounded-xl border transition-colors ${
                  isOpen
                    ? 'border-primary-200 bg-white shadow-sm'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                  onClick={() => setOpenFaq(isOpen ? null : i)}
                  aria-expanded={isOpen}
                >
                  <span className="text-base font-semibold text-gray-900">
                    {f.q}
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isOpen && (
                  <div className="px-5 pb-5 text-sm text-gray-600 leading-relaxed">
                    {f.a}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------------------
 * Section 11: Final CTA
 * ------------------------------------------------------------------------- */

function FinalCta() {
  const isAuthed = useAuth((s) => !!s.token)
  return (
    <section className="py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary-700 via-primary-600 to-primary-800 p-10 sm:p-14 text-white shadow-2xl">
          <div aria-hidden className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-green-400/30 blur-3xl" />
          <div aria-hidden className="absolute -bottom-24 -left-10 w-80 h-80 rounded-full bg-primary-300/30 blur-3xl" />
          <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary-200/95">
                Ready when you are
              </p>
              <h2 className="mt-1 text-3xl sm:text-4xl font-bold tracking-tight">
                Close the next period before the inbox piles up.
              </h2>
              <p className="mt-3 text-base sm:text-lg text-white/85 leading-relaxed max-w-xl">
                Create a free workspace, drop in a real cash book and bank extract, and
                watch suggestions populate. Upgrade when volume or branding needs grow.
              </p>
            </div>
            <div className="lg:justify-self-end flex flex-col sm:flex-row gap-3">
              {isAuthed ? (
                <Link
                  to="/dashboard"
                  className="inline-flex justify-center items-center gap-2 px-6 py-3 text-base font-bold text-primary-700 bg-white hover:bg-gray-100 rounded-xl shadow-lg transition-colors"
                >
                  Go to dashboard
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <>
                  <Link
                    to="/register"
                    className="inline-flex justify-center items-center gap-2 px-6 py-3 text-base font-bold text-primary-700 bg-white hover:bg-gray-100 rounded-xl shadow-lg transition-colors"
                  >
                    Start free trial
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    to="/login"
                    className="inline-flex justify-center items-center px-6 py-3 text-base font-semibold text-white bg-white/10 hover:bg-white/20 backdrop-blur rounded-xl border border-white/20 transition-colors"
                  >
                    Sign in
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------------------
 * Section 12: Footer (dark, premium, multi-column)
 * ------------------------------------------------------------------------- */

function Footer() {
  const isAuthed = useAuth((s) => !!s.token)
  const accountLinks = isAuthed
    ? [
        { label: 'Dashboard', href: '/dashboard', internal: true },
        { label: 'Settings', href: '/settings/branding', internal: true },
        { label: 'Forgot password', href: '/forgot-password', internal: true },
      ]
    : [
        { label: 'Sign in', href: '/login', internal: true },
        { label: 'Create account', href: '/register', internal: true },
        { label: 'Forgot password', href: '/forgot-password', internal: true },
      ]
  return (
    <footer
      id="contact"
      className="relative overflow-hidden bg-gray-900 text-gray-300"
    >
      <div aria-hidden className="absolute inset-0 grid-overlay-dark opacity-50" />
      <div aria-hidden className="absolute -top-24 left-1/4 w-96 h-96 rounded-full bg-primary-700/20 blur-3xl" />
      <div aria-hidden className="absolute -bottom-32 right-1/4 w-[420px] h-[420px] rounded-full bg-green-700/15 blur-3xl" />

      {/* Newsletter strip */}
      <div className="relative border-b border-white/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div>
            <h3 className="text-xl font-bold text-white">
              Stay ahead of each close.
            </h3>
            <p className="mt-2 text-sm text-gray-400 max-w-md">
              Product updates, new statement layouts, and reconciliation playbooks —
              concise, optional, one-click unsubscribe.
            </p>
          </div>
          <form
            className="flex flex-col sm:flex-row gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const form = e.currentTarget
              const email = (form.elements.namedItem('email') as HTMLInputElement | null)?.value
              if (email) {
                window.location.href = `mailto:info@kqsoftwaresolutions.com?subject=Subscribe%20to%20updates&body=Please%20add%20${encodeURIComponent(email)}%20to%20the%20product-updates%20mailing%20list.`
              }
            }}
            aria-label="Subscribe to updates"
          >
            <label htmlFor="newsletter-email" className="sr-only">Email address</label>
            <input
              id="newsletter-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@firm.com"
              className="flex-1 px-4 py-2.5 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <button
              type="submit"
              className="inline-flex justify-center items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-primary-600 hover:bg-primary-500 rounded-lg shadow-md shadow-primary-600/30 transition-colors whitespace-nowrap"
            >
              Subscribe
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Main grid — five columns on large screens: Brand · Contact · Product · Account · Resources */}
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-14 pb-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8">
          {/* Column 1: Brand + social */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2">
              <BrandLogo className="h-9 w-auto" />
            </div>
            <p className="mt-5 text-sm text-gray-400 leading-relaxed max-w-md lg:max-w-none">
              Cloud bank reconciliation for accounting firms and in-house finance teams.
              Match with confidence, publish polished BRS packs, and preserve the audit trail.
            </p>
            <div className="mt-7 flex items-center gap-2">
              {[
                {
                  href: 'https://www.linkedin.com/',
                  label: 'LinkedIn',
                  Icon: Linkedin,
                },
                {
                  href: 'https://twitter.com/',
                  label: 'X / Twitter',
                  Icon: Twitter,
                },
                {
                  href: 'https://www.facebook.com/',
                  label: 'Facebook',
                  Icon: Facebook,
                },
              ].map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={s.label}
                  className="inline-flex w-9 h-9 rounded-lg bg-white/5 border border-white/10 hover:bg-primary-600 hover:border-primary-500 items-center justify-center transition-colors"
                >
                  <s.Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Column 2: Contact only */}
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">
              Contact
            </p>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 grid place-items-center flex-shrink-0">
                  <Mail className="w-4 h-4 text-primary-400" />
                </span>
                <a
                  href="mailto:info@kqsoftwaresolutions.com"
                  className="text-gray-300 hover:text-white break-all transition-colors"
                >
                  info@kqsoftwaresolutions.com
                </a>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 grid place-items-center flex-shrink-0">
                  <Phone className="w-4 h-4 text-primary-400" />
                </span>
                <span className="flex flex-col gap-0.5 leading-snug">
                  <a href="tel:+233302512596" className="text-gray-300 hover:text-white transition-colors">
                    0302 512 596
                  </a>
                  <a href="tel:+233208915637" className="text-gray-300 hover:text-white transition-colors">
                    0208 915 637
                  </a>
                  <a href="tel:+233245396813" className="text-gray-300 hover:text-white transition-colors">
                    0245 396 813
                  </a>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 grid place-items-center flex-shrink-0">
                  <MapPin className="w-4 h-4 text-primary-400" />
                </span>
                <span className="leading-snug text-gray-300">
                  Hse No NS 13, 3rd Gate
                  <br />
                  Madina, Accra
                  <br />
                  P. O. Box CT 6306, Cantonments, Accra
                </span>
              </li>
            </ul>
          </div>

          <FooterColumn
            title="Product"
            links={[
              { label: 'Features', href: '#features' },
              { label: 'How it works', href: '#how-it-works' },
              { label: 'Pricing', href: '#pricing' },
              { label: 'FAQ', href: '#faq' },
            ]}
          />
          <FooterColumn title="Account" links={accountLinks} />
          <div className="sm:col-span-2 lg:col-span-1">
            <FooterColumn
              title="Resources"
              links={[
                { label: 'User manual', href: '/user-manual.md' },
                { label: 'Support', href: 'mailto:info@kqsoftwaresolutions.com' },
                { label: 'Status', href: '#contact' },
                { label: 'About', href: 'mailto:info@kqsoftwaresolutions.com?subject=About%20KQ-SOFT' },
                { label: 'Contact sales', href: 'mailto:info@kqsoftwaresolutions.com?subject=Sales%20enquiry' },
              ]}
            />
          </div>
        </div>

        {/* Trust row */}
        <div className="mt-12 pt-8 border-t border-white/10 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-green-400" />
            <span>Encrypted at rest · HTTPS in transit</span>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-green-400" />
            <span>Role-based access control · Full audit trail</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Global product · engineering roots in Accra, Ghana</span>
          </div>
        </div>
      </div>

      {/* Bottom legal row */}
      <div className="relative border-t border-white/10 bg-black/20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} KQ-SOFT Solutions. All rights reserved.
          </p>
          <div className="flex items-center gap-5 text-xs text-gray-500">
            <a
              href="mailto:info@kqsoftwaresolutions.com?subject=Privacy%20policy"
              className="hover:text-gray-300 transition-colors"
            >
              Privacy
            </a>
            <a
              href="mailto:info@kqsoftwaresolutions.com?subject=Terms%20of%20service"
              className="hover:text-gray-300 transition-colors"
            >
              Terms
            </a>
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-dot" />
              Service operational
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({
  title,
  links,
}: {
  title: string
  links: { label: string; href: string; internal?: boolean }[]
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-500">{title}</p>
      <ul className="mt-4 space-y-3 text-sm">
        {links.map((l) =>
          l.internal ? (
            <li key={l.label}>
              <Link to={l.href} className="text-gray-400 hover:text-white transition-colors">
                {l.label}
              </Link>
            </li>
          ) : (
            <li key={l.label}>
              <a href={l.href} className="text-gray-400 hover:text-white transition-colors">
                {l.label}
              </a>
            </li>
          )
        )}
      </ul>
    </div>
  )
}
