import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Check,
  ChevronDown,
  Database,
  FileSpreadsheet,
  FileText,
  Lock,
  Mail,
  MapPin,
  Menu,
  Minus,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  Workflow,
  X,
  Zap,
} from 'lucide-react'
import BrandLogo from '../components/BrandLogo'
import Button from '../components/ui/Button'
import SubscriptionFxReference from '../components/marketing/SubscriptionFxReference'
import { publicApi } from '../lib/api'
import { useFocusTrap } from '../lib/focusTrap'
import { useAuth } from '../store/auth'
import {
  FEATURE_GROUPS,
  formatGhs,
  mergeWithApiPlans,
  planAmountForPeriod,
  planMonthlyEquivalent,
  type BillingPeriod,
  type MarketingPlan,
} from '../lib/plans'
import { maxYearlyDiscountPercent } from '../lib/planPricing'

/* ---------------------------------------------------------------------------
 * Premium SaaS landing page — KQ-SOFT Bank Reconciliation
 *
 * Sections:
 *   1. Sticky glass-morphism navigation
 *   2. Hero (full-bleed atmosphere + product screenshot)
 *   3. Trust strip (example bank / statement layouts)
 *   4. Stat band
 *   5. Features grid (6 cards)
 *   6. How it works (3 photographed steps)
 *   7. Dashboard showcase (product imagery)
 *   8. Pricing (static catalogue, 4 tiers + comparison table)
 *   9. Testimonials
 *  10. FAQ accordion
 *  11. Final CTA banner (atmosphere photography)
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
    image: '/marketing/marketing-step-upload.jpg',
    imageAlt: 'Cash book and bank statements ready to upload into KQ-SOFT',
  },
  {
    icon: Sparkles,
    title: 'Match',
    description:
      'Suggestions are scored and grouped so your team reviews the highest-impact lines first. Split lines, undo, or approve in bulk.',
    image: '/marketing/marketing-step-match.jpg',
    imageAlt: 'Transaction streams linking into confirmed bank reconciliation matches',
  },
  {
    icon: FileSpreadsheet,
    title: 'Report',
    description:
      'Publish a branded BRS, capture sign-off, lock the period, and roll unresolved items forward without rebuilding from scratch.',
    image: '/marketing/marketing-step-report.jpg',
    imageAlt: 'Branded bank reconciliation statement ready for export and sign-off',
  },
] as const

const MARKETING = {
  heroBg: '/marketing/marketing-hero-workspace.jpg',
  productMatch: '/marketing/marketing-product-match.jpg',
  productReport: '/marketing/marketing-product-report.jpg',
  trustBand: '/marketing/marketing-trust-band.jpg',
  ctaAtmosphere: '/marketing/marketing-cta-atmosphere.jpg',
} as const

const BANKS_SUPPORTED = [
  'Ecobank',
  'GCB',
  'Access',
  'Stanbic',
  'Fidelity',
  'Zenith',
  'CalBank',
  'ADB',
  'Prudential',
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
    a: 'We ship parsers tuned for major regional banks (for example Ecobank, GCB, Access, Stanbic, Fidelity, Zenith, CalBank, ADB) plus generic Excel, CSV, and PDF layouts. Scanned statements are supported with OCR. Non-standard files can be mapped; Team and above includes parser tuning support.',
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
    a: 'Subscriptions are billed in Ghana cedis (GHS) through Paystack on monthly, quarterly (~5% off), or annual (~17% off) cycles. New workspaces start on the Free plan. Paid plans have no trial. The public site shows approximate USD/EUR/GBP equivalents for reference only — checkout always charges GHS. Inside the product, each project can use its own reporting currency (GHS, USD, or EUR) for BRS and balances.',
  },
  {
    q: 'What are the plan limits?',
    a: 'Solo covers 3 bank accounts and 3,000 transactions per month (with bookkeeping advisory). Team is 10 accounts / 15,000 transactions and 5 people. Firm is 30 accounts / 40,000 transactions and 10 people. Custom is unlimited under contract, from GHS 1,800 a month. Bank account seats are counted across your whole organisation.',
  },
  {
    q: 'Is my data secure?',
    a: 'Files live on encrypted storage inside managed infrastructure. Access is scoped per organisation and role. Sessions use signed JWTs over HTTPS. We do not sell or share customer data with advertisers.',
  },
  {
    q: 'Can I export BRS reports with my own logo and colours?',
    a: 'Yes. Team and above include full branding — logo, palette, report title, and footer — so deliverables match your firm template.',
  },
] as const

export default function Landing() {
  const [navOpen, setNavOpen] = useState(false)
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly')
  const [openFaq, setOpenFaq] = useState<number | null>(null)
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
    <div id="top" className="min-h-screen bg-white text-gray-900 antialiased">
      {/* Inline keyframes / one-off styles. Kept local so the page is
          self-contained — no global stylesheet edits required. */}
      <style>{`
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(0.85); }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .animate-pulse-dot { animation: pulseDot 2.4s ease-in-out infinite; }
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
        @keyframes heroDrift {
          0% { transform: scale(1.02) translate3d(0, 0, 0); }
          100% { transform: scale(1.08) translate3d(-1.5%, -1%, 0); }
        }
        .hero-drift { animation: heroDrift 32s ease-in-out infinite alternate; will-change: transform; }
        @media (prefers-reduced-motion: reduce) {
          .marquee-track,
          .hero-drift { animation: none !important; }
          [data-reveal] { opacity: 1; transform: none; transition: none; }
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
        .grid-overlay-dark {
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
          background-size: 56px 56px;
        }
      `}</style>

      <UtilityBar />
      <Nav navOpen={navOpen} setNavOpen={setNavOpen} />
      <Hero />
      <BankStrip />
      <StatBand />
      <Features />
      <ProductSpotlight />
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
 * Contact strip — phones and social, above the main menu
 * ------------------------------------------------------------------------- */

function UtilityBar() {
  return (
    <div className="relative z-40 border-b border-slate-800 bg-slate-900 text-slate-200 shadow-none">
      <div className="mx-auto flex h-10 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2 text-[11px] sm:text-xs">
          <Phone className="h-3.5 w-3.5 shrink-0 text-primary-300" aria-hidden />
          <a href="tel:+233200158182" className="truncate font-medium hover:text-white">
            0200 158 182
          </a>
          <span className="hidden text-slate-500 sm:inline" aria-hidden>
            ·
          </span>
          <a href="tel:+233208915637" className="hidden font-medium hover:text-white sm:inline">
            0208 915 637
          </a>
          <span className="hidden text-slate-500 md:inline" aria-hidden>
            ·
          </span>
          <a href="tel:+233245396813" className="hidden font-medium hover:text-white md:inline">
            0245 396 813
          </a>
        </div>
        <nav className="flex shrink-0 items-center gap-1.5" aria-label="Social">
          <a
            href="https://www.linkedin.com/company/kqsoftwaresolutions"
            target="_blank"
            rel="noreferrer"
            aria-label="LinkedIn"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
              <path d="M4.98 3.5C4.98 4.88 3.88 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.5 8.5h4V24h-4V8.5zM8.5 8.5h3.8v2.1h.1c.5-1 1.8-2.1 3.8-2.1 4.1 0 4.8 2.7 4.8 6.2V24h-4v-7.7c0-1.8 0-4.1-2.5-4.1s-2.9 2-2.9 4V24h-4V8.5z" />
            </svg>
          </a>
          <a
            href="mailto:info@kqsoftwaresolutions.com"
            aria-label="Email"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <Mail className="h-3.5 w-3.5" aria-hidden />
          </a>
          <a
            href="https://wa.me/233208915637"
            target="_blank"
            rel="noreferrer"
            aria-label="WhatsApp"
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden>
              <path d="M20.5 3.5A11 11 0 0 0 2.1 17.2L1 23l5.9-1.1A11 11 0 0 0 12 23a11 11 0 0 0 8.5-19.5zM12 21a9 9 0 0 1-4.6-1.3l-.3-.2-3.5.7.7-3.4-.2-.3A9 9 0 1 1 12 21zm5-6.7c-.3-.1-1.6-.8-1.8-.9s-.4-.1-.6.1-.7.9-.8 1-.3.2-.6.1a7.4 7.4 0 0 1-2.2-1.4 8.2 8.2 0 0 1-1.5-1.9c-.2-.3 0-.4.1-.6l.4-.5.2-.3a.5.5 0 0 0 0-.5l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.8 11.8 0 0 0 4.5 4 15 15 0 0 0 1.5.6 3.6 3.6 0 0 0 1.7.1 2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.6-.3z" />
            </svg>
          </a>
        </nav>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * Section 1: Navigation
 * ------------------------------------------------------------------------- */

function Nav({ navOpen, setNavOpen }: { navOpen: boolean; setNavOpen: (b: boolean) => void }) {
  const navigate = useNavigate()
  const isAuthed = useAuth((s) => !!s.token)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const links: { label: string; href: string }[] = [
    { label: 'Home', href: '#top' },
    { label: 'Features', href: '#features' },
    { label: 'How it works', href: '#how-it-works' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
  ]

  useFocusTrap(navOpen, panelRef, { restoreFocusRef: menuButtonRef })

  useEffect(() => {
    if (!navOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navOpen, setNavOpen])

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
            <Button
              size="sm"
              className="group gap-1.5 font-bold shadow-md shadow-primary-600/25 hover:shadow-lg hover:shadow-primary-600/30 hover:-translate-y-0.5 nav-shimmer"
              onClick={() => navigate('/dashboard')}
            >
              Dashboard
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
                Sign in
              </Button>
              <Button
                size="sm"
                className="group gap-1.5 font-bold shadow-md shadow-primary-600/25 hover:shadow-lg hover:shadow-primary-600/30 hover:-translate-y-0.5 nav-shimmer"
                onClick={() => navigate('/register')}
              >
                Start free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
            </>
          )}
        </div>

        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setNavOpen(!navOpen)}
          className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg text-gray-700 hover:bg-gray-100"
          aria-label={navOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={navOpen}
          aria-controls="landing-mobile-nav"
        >
          {navOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      {navOpen && (
        <div
          ref={panelRef}
          id="landing-mobile-nav"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile navigation"
          tabIndex={-1}
          className="md:hidden border-t border-gray-100 bg-white outline-none"
        >
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
                <Button
                  className="w-full font-bold"
                  onClick={() => {
                    setNavOpen(false)
                    navigate('/dashboard')
                  }}
                >
                  Dashboard
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setNavOpen(false)
                      navigate('/login')
                    }}
                  >
                    Sign in
                  </Button>
                  <Button
                    className="font-semibold"
                    onClick={() => {
                      setNavOpen(false)
                      navigate('/register')
                    }}
                  >
                    Start free
                  </Button>
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
  const navigate = useNavigate()
  const isAuthed = useAuth((s) => !!s.token)
  return (
    <section className="relative isolate overflow-hidden">
      <div aria-hidden className="absolute inset-0 -z-10">
        <img
          src={MARKETING.heroBg}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center hero-drift"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/75 via-slate-900/55 to-slate-900/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/50 via-transparent to-slate-900/30" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6 items-center">
          <div className="lg:col-span-5 text-center lg:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-200">
              KQ-SOFT · Bank reconciliation
            </p>

            <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight text-white leading-[1.05]">
              Bank reconciliation,
              <br className="hidden sm:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-200 via-white to-green-300">
                automated end to end.
              </span>
            </h1>

            <p className="mt-3 text-base sm:text-lg text-slate-200/90 leading-snug max-w-xl mx-auto lg:mx-0">
              Pair the cash book with the bank file in one workspace. Intelligent matching
              handles cheques, wires, and split lines — then ships a signed-off BRS you can
              stand behind.
            </p>

            <div className="mt-5 flex flex-col sm:flex-row items-center lg:items-stretch justify-center lg:justify-start gap-3">
              <Button
                size="lg"
                className="group gap-2 shadow-lg shadow-primary-900/40 !bg-white !text-primary-800 hover:!bg-slate-100 hover:!text-primary-800"
                onClick={() => navigate(isAuthed ? '/dashboard' : '/register')}
              >
                {isAuthed ? 'Go to dashboard' : 'Start free'}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="gap-2 border-white/35 bg-white/10 text-white hover:bg-white/15 hover:text-white backdrop-blur"
                onClick={() =>
                  document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })
                }
              >
                See pricing
              </Button>
            </div>

            <p className="mt-3 text-sm text-slate-300/90">
              {isAuthed
                ? 'Signed in — open your workspace to continue reconciliations.'
                : 'Free plan included · Paid plans from GHS 199/mo · No card required'}
            </p>
          </div>

          <div data-reveal className="lg:col-span-7 relative">
            <div
              className="absolute -inset-3 sm:-inset-5 rounded-[1.75rem] bg-gradient-to-br from-primary-400/30 via-transparent to-green-400/25 blur-2xl"
              aria-hidden
            />
            <div className="relative overflow-hidden rounded-xl border border-white/25 bg-white/95 ring-1 ring-white/20">
              <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-100 bg-slate-50/95">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="px-3 py-1 rounded-md bg-white border border-gray-200 text-[11px] font-medium text-gray-500">
                    app.kqsoftwaresolutions.com / reconcile
                  </div>
                </div>
                <div className="w-12" />
              </div>
              <img
                src={MARKETING.productMatch}
                alt="KQ-SOFT matching workspace with cash book and bank statement side by side"
                className="w-full h-auto object-cover object-top max-h-[200px]"
                loading="eager"
                decoding="async"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------------------
 * Section 3: Bank trust strip (marquee)
 * ------------------------------------------------------------------------- */

function BankStrip() {
  const items = [...BANKS_SUPPORTED, ...BANKS_SUPPORTED]
  return (
    <section className="relative overflow-hidden border-y border-gray-100 py-12 lg:py-16">
      <img
        src={MARKETING.trustBand}
        alt=""
        className="absolute inset-0 h-full w-full object-cover opacity-40"
        loading="lazy"
        decoding="async"
        aria-hidden
      />
      <div className="absolute inset-0 bg-white/80" aria-hidden />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
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
        <div className="mt-4 relative overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white to-transparent z-10" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-white to-transparent z-10" />
          <div className="flex gap-10 marquee-track w-max">
            {items.map((name, i) => (
              <div
                key={`${name}-${i}`}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200/90 bg-white/90 backdrop-blur-sm text-gray-700 font-semibold tracking-wide whitespace-nowrap"
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
    <section className="py-12 lg:py-16 border-y border-slate-100 bg-slate-50/70">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          data-reveal
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 sm:px-5"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-6">
          {stats.map((s, i) => (
            <div
              key={i}
              className={`text-center sm:text-left ${i > 0 ? 'sm:border-l sm:border-slate-200 sm:pl-6' : ''}`}
            >
              <p className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 tabular-nums">
                {s.value}
              </p>
              <p className="mt-1 text-xs sm:text-sm text-gray-600 leading-snug">{s.label}</p>
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
    <section id="features" className="py-16 lg:py-20 bg-gray-50/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          data-reveal
          className="mx-auto max-w-2xl px-4 py-0 text-center"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">
            Features
          </p>
          <h2 className="mt-1 text-2xl sm:text-[1.65rem] font-bold tracking-tight text-gray-900">
            Everything you need to close a defensible bank rec.
          </h2>
          <p className="mt-1 text-sm text-gray-600 leading-snug">
            Ingestion, matching, approvals, and client-ready reporting — orchestrated in
            one place so reviewers spend time on exceptions, not formatting.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:mt-12">
          {FEATURES.map((f) => {
            const Icon = f.icon
            return (
              <div
                key={f.title}
                data-reveal
                className="group relative rounded-2xl border border-slate-200 bg-white p-3"
              >
                <div className="w-9 h-9 rounded-xl bg-primary-50 grid place-items-center text-primary-600 ring-1 ring-primary-100">
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="mt-2 text-base font-bold text-gray-900">{f.title}</h3>
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
 * Section 5b: Product spotlight (report visual)
 * ------------------------------------------------------------------------- */

function ProductSpotlight() {
  return (
    <section className="py-16 lg:py-20 bg-slate-950 text-white overflow-hidden relative">
      <div
        aria-hidden
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'radial-gradient(ellipse at 20% 20%, rgba(4,115,234,0.35), transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(56,210,0,0.18), transparent 45%)',
        }}
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div data-reveal>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary-300">
              Audit-ready output
            </p>
            <h2 className="mt-1 text-2xl sm:text-[1.65rem] font-bold tracking-tight">
              A BRS your reviewers will recognise.
            </h2>
            <p className="mt-2 text-sm text-slate-300 leading-snug max-w-xl">
              Formal statement lines, branded exports, and a clear trail from match to sign-off —
              so the report looks like your firm&apos;s work, not a generic SaaS dump.
            </p>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-200">
              {[
                'Excel + PDF with your logo and colours',
                'Uncredited lodgments & unpresented cheques laid out cleanly',
                'Preparer / reviewer sign-off states preserved',
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
          <div data-reveal className="relative">
            <div
              className="absolute -inset-4 rounded-3xl bg-primary-500/20 blur-2xl"
              aria-hidden
            />
            <div className="relative overflow-hidden rounded-xl border border-white/15 bg-white ring-1 ring-white/10">
              <img
                src={MARKETING.productReport}
                alt="KQ-SOFT bank reconciliation statement report preview"
                className="w-full object-cover object-top aspect-[2/1]"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>
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
    <section id="how-it-works" className="py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          data-reveal
          className="mx-auto max-w-2xl px-4 py-0 text-center"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">
            How it works
          </p>
          <h2 className="mt-1 text-2xl sm:text-[1.65rem] font-bold tracking-tight text-gray-900">
            Three steps from raw files to a signed-off BRS.
          </h2>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6 lg:mt-12">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            return (
              <div
                key={s.title}
                data-reveal
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-none"
              >
                <div className="relative aspect-[2/1] overflow-hidden bg-gray-100">
                  <img
                    src={s.image}
                    alt={s.imageAlt}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
                  <span className="absolute left-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white ring-4 ring-white/80">
                    {i + 1}
                  </span>
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary-600" />
                    <h3 className="text-lg font-bold text-gray-900">{s.title}</h3>
                  </div>
                  <p className="mt-2 text-sm text-gray-600 leading-relaxed">{s.description}</p>
                </div>
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
  const navigate = useNavigate()
  const isAuthed = useAuth((s) => !!s.token)
  return (
    <section className="py-16 lg:py-20 bg-gradient-to-b from-white via-gray-50/60 to-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div data-reveal>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">
              Built for accountants
            </p>
            <h2 className="mt-1 text-2xl sm:text-[1.65rem] font-bold tracking-tight text-gray-900">
              Familiar controls — without the busywork.
            </h2>
            <p className="mt-1 text-sm text-gray-600 leading-snug">
              The product mirrors how firms already think about bank recs: uncredited
              lodgments, unpresented cheques, brought-forward lines, and discrepancy
              narratives — automated where it helps, transparent where it matters.
            </p>
            <ul className="mt-4 space-y-2">
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
            <div className="mt-4 flex gap-3">
              <Button
                className="gap-2 shadow-sm"
                onClick={() => navigate(isAuthed ? '/dashboard' : '/register')}
              >
                {isAuthed ? 'Open dashboard' : 'Try it free'}
                <ArrowRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })
                }
              >
                See pricing
              </Button>
            </div>
          </div>

          <div data-reveal className="relative">
            <div
              className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-primary-100 via-white to-green-100 blur-2xl opacity-60"
              aria-hidden
            />
            <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-2 ring-1 ring-black/5">
              <img
                src={MARKETING.productReport}
                alt="KQ-SOFT bank reconciliation statement with lodgments and cheques"
                className="w-full rounded-lg object-cover object-top aspect-[2/1]"
                loading="lazy"
                decoding="async"
              />
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
  billingPeriod: BillingPeriod
  setBillingPeriod: (p: BillingPeriod) => void
  showCompare: boolean
  setShowCompare: (b: boolean) => void
}) {
  const maxYearlyDiscount = maxYearlyDiscountPercent(plans)
  const yearlySavingsCopy =
    maxYearlyDiscount != null && maxYearlyDiscount > 0
      ? `save up to ${maxYearlyDiscount}%`
      : 'pay annually'

  return (
    <section id="pricing" className="relative py-16 lg:py-20 bg-gray-50/40 overflow-hidden">
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          data-reveal
          className="mx-auto max-w-2xl px-4 py-0 text-center"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">
            Pricing
          </p>
          <h2 className="mt-1 text-2xl sm:text-[1.65rem] font-bold tracking-tight text-gray-900">
            Simple pricing — billed in GHS via Paystack.
          </h2>
          <p className="mt-1 text-sm text-gray-600 leading-snug">
            Start on Free. Paid plans are monthly, quarterly (~5% off), or{' '}
            {yearlySavingsCopy} annually. Checkout is always in{' '}
            <abbr title="Ghana cedis">GHS</abbr> via Paystack; use the reference converter below for USD, EUR, or GBP.
          </p>

          {/* Billing period toggle */}
          <div className="mt-4 inline-flex flex-wrap items-center justify-center p-1 rounded-xl border border-gray-200 bg-white shadow-none gap-0.5">
            <button
              type="button"
              onClick={() => setBillingPeriod('monthly')}
              className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
                billingPeriod === 'monthly'
                  ? 'bg-primary-600 text-white shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingPeriod('quarterly')}
              className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                billingPeriod === 'quarterly'
                  ? 'bg-primary-600 text-white shadow'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Quarterly
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  billingPeriod === 'quarterly'
                    ? 'bg-white text-primary-700'
                    : 'bg-green-100 text-green-700'
                }`}
              >
                ~5% off
              </span>
            </button>
            <button
              type="button"
              onClick={() => setBillingPeriod('yearly')}
              className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
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
                {yearlySavingsCopy}
              </span>
            </button>
          </div>
        </div>

        <div className="mt-10 max-w-4xl mx-auto w-full lg:mt-12">
          <SubscriptionFxReference plans={plans} billingPeriod={billingPeriod} />
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((p) => (
            <PlanCard key={p.slug} plan={p} period={billingPeriod} />
          ))}
        </div>

        {/* Trust line */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-600">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-green-600" />
            Paystack checkout · charged in GHS
          </span>
          <span className="inline-flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600" />
            Cancel any time
          </span>
        </div>

        {/* Comparison table toggle */}
        <div className="mt-5 text-center">
          <Button
            variant="outline"
            className="gap-1.5 border-primary-200 text-primary-700 hover:bg-primary-50"
            onClick={() => setShowCompare(!showCompare)}
            aria-expanded={showCompare}
          >
            {showCompare ? 'Hide full comparison' : 'Compare all features'}
            <ChevronDown
              className={`w-4 h-4 transition-transform ${showCompare ? 'rotate-180' : ''}`}
            />
          </Button>
        </div>

        {showCompare && <ComparisonTable plans={plans} />}

        <p className="mt-5 text-center text-sm text-gray-500">
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
  period: BillingPeriod
}) {
  const navigate = useNavigate()
  const isAuthed = useAuth((s) => !!s.token)
  const isHighlight = !!plan.highlight && plan.active !== false
  const isCustom = plan.slug === 'firm' && plan.monthlyGhs <= 0 && plan.yearlyGhs <= 0
  const checkoutClosed = plan.active === false && !isCustom
  const amount = planAmountForPeriod(plan, period)
  const monthlyEq = period === 'monthly' ? null : planMonthlyEquivalent(plan, period)
  const periodLabel = period === 'yearly' ? 'year' : period === 'quarterly' ? 'quarter' : 'month'
  const ctaHref =
    isAuthed && plan.ctaHref === '/register' ? '/settings/billing' : plan.ctaHref
  const ctaLabel =
    isAuthed && plan.ctaHref === '/register' ? 'Billing & plans' : plan.ctaLabel
  const isInternalCta = ctaHref.startsWith('/')

  return (
    <div
      data-reveal
      className={`relative rounded-lg p-3.5 flex flex-col transition-colors ${
        isHighlight
          ? 'border-2 border-primary-500 bg-white'
          : 'border border-gray-200 bg-white hover:border-primary-200'
      }`}
    >
      {plan.badge && (
        <span
          className={`absolute -top-2.5 left-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow ${
            isHighlight
              ? 'bg-primary-600 text-white'
              : 'bg-gray-900 text-white'
          }`}
        >
          {isHighlight && <Sparkles className="w-2.5 h-2.5" />}
          {plan.badge}
        </span>
      )}

      <h3 className="text-sm font-semibold text-gray-900">{plan.name}</h3>
      <p className="mt-0.5 text-xs text-gray-500 leading-snug line-clamp-2">{plan.tagline}</p>

      <div className="mt-2">
        {isCustom ? (
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-gray-900">Custom</span>
          </div>
        ) : amount === 0 ? (
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-bold text-gray-900">Free</span>
          </div>
        ) : (
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-gray-900 tabular-nums">
                {formatGhs(amount)}
              </span>
              <span className="text-xs text-gray-500">/ {periodLabel}</span>
            </div>
            {monthlyEq !== null && (
              <p className="mt-0.5 text-[11px] text-gray-500">
                ≈ {formatGhs(Math.round(monthlyEq))} / month, billed {periodLabel === 'year' ? 'annually' : 'quarterly'}
              </p>
            )}
          </div>
        )}
      </div>

      {plan.inheritsFromLabel && (
        <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-primary-700">
          {plan.inheritsFromLabel}
        </p>
      )}

      <ul className={`${plan.inheritsFromLabel ? 'mt-1.5' : 'mt-3'} space-y-1 flex-1`}>
        {plan.bullets.map((b) => (
          <li key={b} className="flex items-start gap-1.5 text-xs text-gray-700 leading-snug">
            <Check
              className={`mt-0.5 w-3.5 h-3.5 flex-shrink-0 ${
                isHighlight ? 'text-primary-600' : 'text-green-600'
              }`}
            />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      {checkoutClosed ? (
        <Button className="mt-3 w-full" size="sm" variant="outline" disabled>
          Currently unavailable
        </Button>
      ) : isInternalCta ? (
        <Button
          size="sm"
          className={`mt-3 w-full gap-1 ${
            isHighlight
              ? ''
              : 'border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100'
          }`}
          variant={isHighlight ? 'primary' : 'outline'}
          onClick={() => navigate(ctaHref)}
        >
          {ctaLabel}
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      ) : (
        <Button
          size="sm"
          className={`mt-3 w-full gap-1 ${
            isHighlight
              ? ''
              : 'border-primary-200 bg-primary-50 text-primary-700 hover:bg-primary-100'
          }`}
          variant={isHighlight ? 'primary' : 'outline'}
          onClick={() => {
            window.location.href = ctaHref
          }}
        >
          {ctaLabel}
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  )
}

/** Side-by-side feature comparison across all 4 plans, grouped by capability. */
function ComparisonTable({ plans }: { plans: MarketingPlan[] }) {
  return (
    <div data-reveal className="mt-6 rounded-xl border border-gray-200 bg-white overflow-hidden">
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
    <section className="py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          data-reveal
          className="mx-auto max-w-2xl px-4 py-0 text-center"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">
            Teams worldwide rely on it
          </p>
          <h2 className="mt-1 text-2xl sm:text-[1.65rem] font-bold tracking-tight text-gray-900">
            What finance leaders say.
          </h2>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6 lg:mt-12">
          {TESTIMONIALS.map((t, i) => (
            <figure
              key={i}
              data-reveal
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-none flex flex-col"
            >
              <div className="flex gap-0.5 text-amber-400" aria-hidden>
                {Array.from({ length: 5 }).map((_, idx) => (
                  <svg key={idx} className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.16c.969 0 1.371 1.24.588 1.81l-3.366 2.448a1 1 0 00-.364 1.118l1.287 3.957c.299.921-.755 1.688-1.539 1.118L10 14.347l-3.366 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.652 8.156c-.783-.57-.38-1.81.588-1.81h4.161a1 1 0 00.95-.69l1.286-3.957z" />
                  </svg>
                ))}
              </div>
              <blockquote className="mt-2 text-sm text-gray-700 leading-snug flex-1">
                “{t.quote}”
              </blockquote>
              <figcaption className="mt-3 pt-3 border-t border-gray-100">
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
    <section id="faq" className="py-16 lg:py-20 bg-gray-50/40">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div
          data-reveal
          className="px-4 py-0 text-center"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">
            FAQ
          </p>
          <h2 className="mt-1 text-2xl sm:text-[1.65rem] font-bold tracking-tight text-gray-900">
            Common questions, answered.
          </h2>
        </div>

        <div className="mt-10 space-y-3 lg:mt-12">
          {FAQS.map((f, i) => {
            const isOpen = openFaq === i
            return (
              <div
                key={f.q}
                data-reveal
                className={`rounded-xl border transition-colors ${
                  isOpen
                    ? 'border-primary-200 bg-white'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <button
                  type="button"
                  className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left"
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
  const navigate = useNavigate()
  const isAuthed = useAuth((s) => !!s.token)
  return (
    <section className="py-16 lg:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-2xl p-4 sm:p-5 text-white">
          <img
            src={MARKETING.ctaAtmosphere}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            aria-hidden
          />
          <div className="absolute inset-0 bg-gradient-to-br from-primary-900/92 via-primary-800/88 to-primary-950/90" />
          <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary-200/95">
                Ready when you are
              </p>
              <h2 className="mt-1 text-2xl sm:text-[1.65rem] font-bold tracking-tight">
                Close the next period before the inbox piles up.
              </h2>
              <p className="mt-2 text-sm text-white/85 leading-snug max-w-xl">
                Start on the free plan, drop in a real cash book and bank extract, and
                watch suggestions populate. Paid plans from GHS 199/mo.
              </p>
            </div>
            <div className="lg:justify-self-end flex flex-col sm:flex-row gap-3">
              {isAuthed ? (
                <Button
                  size="lg"
                  className="gap-2 !bg-white !text-primary-700 hover:!bg-gray-100 hover:!text-primary-700 shadow-lg focus:ring-white"
                  onClick={() => navigate('/dashboard')}
                >
                  Go to dashboard
                  <ArrowRight className="w-4 h-4" />
                </Button>
              ) : (
                <>
                  <Button
                    size="lg"
                    className="gap-2 !bg-white !text-primary-700 hover:!bg-gray-100 hover:!text-primary-700 shadow-lg focus:ring-white"
                    onClick={() => navigate('/register')}
                  >
                    Start free
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                  <Button
                    size="lg"
                    className="bg-white/10 text-white hover:bg-white/20 border border-white/20 backdrop-blur focus:ring-white"
                    onClick={() => navigate('/login')}
                  >
                    Sign in
                  </Button>
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

function NewsletterForm() {
  const [pending, setPending] = useState(false)
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault()
        const form = e.currentTarget
        const emailInput = form.elements.namedItem('email') as HTMLInputElement | null
        const email = emailInput?.value?.trim()
        if (!email) return
        setPending(true)
        setStatus(null)
        try {
          const res = await publicApi.createLead({ email, source: 'newsletter' })
          if (emailInput) emailInput.value = ''
          setStatus({
            tone: 'success',
            message: res.duplicate
              ? 'You are already subscribed with this email.'
              : 'Thanks — you are on the product updates list.',
          })
        } catch (err) {
          setStatus({
            tone: 'error',
            message: err instanceof Error ? err.message : 'Could not subscribe. Try again.',
          })
        } finally {
          setPending(false)
        }
      }}
      aria-label="Subscribe to updates"
    >
      <div className="flex flex-col sm:flex-row gap-2">
        <label htmlFor="newsletter-email" className="sr-only">
          Email address
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@firm.com"
          className="flex-1 min-w-0 px-4 py-2.5 text-sm rounded-lg bg-white/5 border border-white/10 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <Button
          type="submit"
          isLoading={pending}
          className="whitespace-nowrap shadow-md shadow-primary-600/30"
        >
          Subscribe
          <Send className="w-4 h-4 ml-2" />
        </Button>
      </div>
      {status && (
        <p
          role={status.tone === 'error' ? 'alert' : 'status'}
          className={`text-sm ${status.tone === 'error' ? 'text-red-300' : 'text-green-300'}`}
        >
          {status.message}
        </p>
      )}
    </form>
  )
}

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

      {/* Newsletter strip */}
      <div className="relative border-b border-white/10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-2 gap-8 items-center lg:py-16">
          <div>
            <h3 className="text-xl font-bold text-white">
              Stay ahead of each close.
            </h3>
            <p className="mt-2 text-sm text-gray-400 max-w-md">
              Product updates, new statement layouts, and reconciliation playbooks —
              concise, optional, one-click unsubscribe.
            </p>
          </div>
          <NewsletterForm />
        </div>
      </div>

      {/* Main grid — five columns on large screens: Brand · Contact · Product · Account · Resources */}
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-12 pb-10 lg:pt-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Column 1: Brand + social */}
          <div>
            <div className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2">
              <BrandLogo className="h-9 w-auto" />
            </div>
            <p className="mt-5 text-sm text-gray-400 leading-relaxed max-w-md lg:max-w-none">
              Cloud bank reconciliation for accounting firms and in-house finance teams.
              Match with confidence, publish polished BRS packs, and preserve the audit trail.
            </p>
            <a
              href="mailto:info@kqsoftwaresolutions.com"
              className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
            >
              info@kqsoftwaresolutions.com
            </a>
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
                  <a href="tel:+233200158182" className="text-gray-300 hover:text-white transition-colors">
                    0200 158 182
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
        <div className="mt-6 pt-4 border-t border-white/10 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-gray-400">
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
            <Link to="/privacy" className="hover:text-gray-300 transition-colors">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-gray-300 transition-colors">
              Terms
            </Link>
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
