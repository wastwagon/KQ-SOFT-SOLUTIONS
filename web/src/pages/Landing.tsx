import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  Check,
  ChevronDown,
  Database,
  FileSpreadsheet,
  FileText,
  LayoutDashboard,
  LineChart,
  Lock,
  Mail,
  MapPin,
  Menu,
  Phone,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  Workflow,
  X,
  Zap,
} from 'lucide-react'
import BrandLogo from '../components/BrandLogo'
import { publicApi, type PublicPlan } from '../lib/api'

/* ---------------------------------------------------------------------------
 * Premium SaaS landing page — KQ-SOFT Bank Reconciliation
 *
 * Sections:
 *   1. Sticky glass-morphism navigation
 *   2. Hero (headline + dual CTA + animated dashboard mockup)
 *   3. Trust strip (Ghana banks supported)
 *   4. Stat band
 *   5. Features grid (6 cards)
 *   6. How it works (3 steps)
 *   7. Live pricing pulled from /api/v1/public/plans
 *   8. Testimonials
 *   9. FAQ accordion
 *  10. Final CTA banner
 *  11. Footer
 *
 * Visual treatment:
 *   - Brand palette: primary blue (#0473ea) + accent green (#38d200)
 *   - Mesh-gradient hero background with floating colour blobs
 *   - Subtle grid overlay for depth
 *   - Smooth fade-in on scroll via IntersectionObserver
 *   - Built entirely with Tailwind utilities + a small inline <style>
 *     block for keyframes; no extra dependencies.
 * ------------------------------------------------------------------------- */

const FEATURES = [
  {
    icon: Zap,
    title: 'Smart matching engine',
    description:
      'One-to-one, one-to-many, and many-to-many auto-suggestions based on amount, date window, reference, and cheque number. Confirm with a single click.',
  },
  {
    icon: Database,
    title: 'Built for Ghana banks',
    description:
      'Pre-tuned parsers for Ecobank, GCB, Access, Stanbic, Fidelity and more. Excel, CSV, PDF, even scanned statements via OCR.',
  },
  {
    icon: FileText,
    title: 'Audit-ready reports',
    description:
      'Branded BRS exports in Excel and PDF with reviewer/preparer sign-off, discrepancy reporting, and a full audit trail of every action.',
  },
  {
    icon: Users,
    title: 'Multi-client workspace',
    description:
      'Manage every client in one place. Reconcile, sign off, and roll forward across periods without losing the trail.',
  },
  {
    icon: ShieldCheck,
    title: 'Roles & approvals',
    description:
      'Preparer → Reviewer → Approver workflow with locked statuses. Threshold approval rules keep large variances reviewed.',
  },
  {
    icon: Workflow,
    title: 'API & bank rules',
    description:
      'REST API for firm automation pipelines. Configurable bank rules engine to flag, categorise, or auto-suggest matches.',
  },
] as const

const STEPS = [
  {
    icon: Upload,
    title: 'Upload',
    description:
      'Drop your cash book and bank statement — Excel, CSV, PDF, or scanned. We auto-detect columns and bank format on the fly.',
  },
  {
    icon: Sparkles,
    title: 'Match',
    description:
      'The matching engine surfaces suggestions ranked by confidence. Bulk-confirm, split, or unmatch in one click.',
  },
  {
    icon: FileSpreadsheet,
    title: 'Report',
    description:
      'Export a branded, audit-ready BRS in Excel and PDF. Sign off, lock the period, and roll balances forward.',
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
      'Reconciliation that used to take three days now takes about an hour. The Ghana-specific bank parsing was the deciding factor for us.',
    author: 'Senior Accountant',
    role: 'Audit firm — Tema',
  },
  {
    quote:
      'The audit trail and sign-off workflow alone justified switching. We can show clients exactly who matched what and when.',
    author: 'Practice Partner',
    role: 'Mid-tier accounting firm',
  },
  {
    quote:
      'We onboarded our team in an afternoon. The interface is clean, the matching is accurate, and exporting branded BRS reports is effortless.',
    author: 'Finance Manager',
    role: 'Logistics group',
  },
] as const

const FAQS = [
  {
    q: 'Which Ghanaian banks are supported?',
    a: 'We ship pre-tuned parsers for Ecobank, GCB, Access, Stanbic, Fidelity, Zenith, CalBank, ADB, and others. We also handle generic Excel, CSV, and PDF formats — and scanned PDFs via OCR. If your bank format is non-standard, we will tune a parser for you on the Standard plan and above.',
  },
  {
    q: 'Do I need to install anything?',
    a: 'No. KQ-SOFT runs in your browser. Sign up, upload, and reconcile. Nothing to download or maintain.',
  },
  {
    q: 'Can my team collaborate on the same project?',
    a: 'Yes. Add team members with Preparer, Reviewer, or Approver roles. Every action is captured in the audit trail. Member counts grow with your plan.',
  },
  {
    q: 'How does pricing work?',
    a: 'Plans are billed monthly or yearly in Ghana cedis (GHS) via Paystack. Limits scale with your tier — projects per month, transactions per month, and feature gates. You can upgrade at any time; downgrades are handled by support to make sure entitlements are reconciled correctly.',
  },
  {
    q: 'Is my data secure?',
    a: 'Documents are stored on encrypted disk inside our managed infrastructure, and access is enforced by per-organisation role-based permissions. Authentication uses signed JWTs over HTTPS. We do not share your data with third parties.',
  },
  {
    q: 'Can I export BRS reports with my own logo and colours?',
    a: 'Yes — branding (logo, primary and secondary colours, custom report title and footer) is included on the Premium tier and above. Reports look like your firm produced them.',
  },
] as const

function formatGhs(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return 'Contact us'
  try {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS',
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `GHS ${amount.toLocaleString('en-GH')}`
  }
}

function formatLimit(n: number): string {
  if (n < 0) return 'Unlimited'
  return n.toLocaleString('en-GH')
}

const PLAN_HIGHLIGHTS: Record<string, { tagline: string; badge?: string; bullets: string[] }> = {
  basic: {
    tagline: 'For solo accountants getting started.',
    bullets: [
      'Core matching engine',
      'Excel, CSV, and PDF imports',
      'Branded BRS export (default branding)',
      '1 user account',
    ],
  },
  standard: {
    tagline: 'For small teams and growing practices.',
    badge: 'Most popular',
    bullets: [
      'Everything in Basic',
      'Bulk match (up to 50 pairs)',
      'AI suggestions, audit trail, discrepancies',
      'Bank rules engine',
      'Up to 3 users',
    ],
  },
  premium: {
    tagline: 'For firms reconciling at scale.',
    bullets: [
      'Everything in Standard',
      '1-to-many & many-to-many matches',
      'Roll-forward across periods',
      'Threshold approvals & full branding',
      'Up to 5 users',
    ],
  },
  firm: {
    tagline: 'For accounting firms and large practices.',
    bullets: [
      'Everything in Premium',
      'Unlimited projects & transactions',
      'Multi-client workspace',
      'Public REST API access',
      'Unlimited users',
    ],
  },
}

const PLAN_DISPLAY_ORDER = ['basic', 'standard', 'premium', 'firm'] as const

export default function Landing() {
  const [navOpen, setNavOpen] = useState(false)
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  const { data: plansData } = useQuery({
    queryKey: ['public', 'plans'],
    queryFn: publicApi.getPlans,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  // Order plans for display, falling back to API order if a slug is unknown.
  const orderedPlans = useMemo(() => {
    const list = plansData?.plans ?? []
    const byId = new Map(list.map((p) => [p.id, p]))
    const ordered: PublicPlan[] = []
    for (const slug of PLAN_DISPLAY_ORDER) {
      const p = byId.get(slug)
      if (p) ordered.push(p)
    }
    for (const p of list) {
      if (!ordered.find((x) => x.id === p.id)) ordered.push(p)
    }
    return ordered
  }, [plansData])

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
        .animate-blob { animation: blob 18s ease-in-out infinite; }
        .animate-blob-slow { animation: blob 26s ease-in-out infinite; }
        .animate-pulse-dot { animation: pulseDot 2.4s ease-in-out infinite; }
        .gradient-text {
          background: linear-gradient(120deg, #0473ea 0%, #1a7de8 30%, #38d200 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
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
      `}</style>

      <Nav navOpen={navOpen} setNavOpen={setNavOpen} />
      <Hero />
      <BankStrip />
      <StatBand />
      <Features />
      <HowItWorks />
      <DashboardShowcase />
      <Pricing
        plans={orderedPlans}
        billingPeriod={billingPeriod}
        setBillingPeriod={setBillingPeriod}
      />
      <Testimonials />
      <Faq openFaq={openFaq} setOpenFaq={setOpenFaq} />
      <FinalCta />
      <Footer />
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * Section: Navigation
 * ------------------------------------------------------------------------- */

function Nav({ navOpen, setNavOpen }: { navOpen: boolean; setNavOpen: (b: boolean) => void }) {
  const links: { label: string; href: string }[] = [
    { label: 'Features', href: '#features' },
    { label: 'How it works', href: '#how-it-works' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
  ]
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/40 bg-white/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
        <Link to="/" className="flex items-center gap-2 shrink-0" aria-label="KQ-SOFT home">
          <BrandLogo className="h-9 w-auto" />
        </Link>

        <nav className="hidden md:flex items-center gap-1" aria-label="Primary">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <Link
            to="/login"
            className="px-4 py-2 text-sm font-semibold text-gray-700 hover:text-gray-900 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Sign in
          </Link>
          <Link
            to="/register"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            Start free
            <ArrowRight className="h-4 w-4" />
          </Link>
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
            <div className="pt-3 border-t border-gray-100 grid grid-cols-2 gap-2">
              <Link
                to="/login"
                className="text-center px-4 py-2 text-sm font-semibold text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
                onClick={() => setNavOpen(false)}
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="text-center px-4 py-2 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg"
                onClick={() => setNavOpen(false)}
              >
                Start free
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}

/* ---------------------------------------------------------------------------
 * Section: Hero
 * ------------------------------------------------------------------------- */

function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      {/* Mesh gradient + animated colour blobs */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-50/60 via-white to-white" />
        <div className="absolute inset-0 grid-overlay opacity-60" />
        <div className="absolute -top-32 left-1/4 h-[420px] w-[420px] rounded-full bg-primary-300/30 blur-3xl animate-blob" />
        <div className="absolute top-10 right-1/4 h-[360px] w-[360px] rounded-full bg-green-300/25 blur-3xl animate-blob-slow" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 h-[340px] w-[600px] rounded-full bg-primary-200/30 blur-3xl animate-blob" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-16 pb-20 sm:pt-24 sm:pb-28 lg:pt-28 lg:pb-32">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white shadow-sm border border-gray-200 text-xs font-semibold text-gray-600">
            <span className="relative inline-flex">
              <span className="absolute inset-0 rounded-full bg-green-500 animate-pulse-dot" />
              <span className="relative h-2 w-2 rounded-full bg-green-500" />
            </span>
            <span>Built for Ghana accountants</span>
          </div>

          <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 leading-[1.05]">
            Bank reconciliation,
            <br className="hidden sm:block" />
            <span className="gradient-text"> automated for Ghana.</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-gray-600 leading-relaxed max-w-2xl mx-auto">
            Upload your cash book and bank statement. Our matching engine handles
            cheques, transfers, and split payments — and exports an audit-ready
            BRS in minutes, not days.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/register"
              className="group inline-flex items-center gap-2 px-6 py-3 text-base font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-xl shadow-lg shadow-primary-600/20 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
              Start free trial
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
            No credit card required · Set up in under 5 minutes
          </p>
        </div>

        {/* Hero dashboard mockup */}
        <div data-reveal className="relative mt-14 sm:mt-20 mx-auto max-w-5xl">
          <div className="absolute -inset-4 sm:-inset-6 rounded-[2rem] bg-gradient-to-br from-primary-200/40 via-white/0 to-green-200/40 blur-2xl" aria-hidden />
          <DashboardMockup />
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------------------
 * Stylised dashboard preview — a product mockup built from real components.
 * ------------------------------------------------------------------------- */

function DashboardMockup() {
  return (
    <div className="relative rounded-2xl border border-gray-200/80 bg-white shadow-2xl ring-1 ring-black/5 overflow-hidden">
      {/* Window chrome */}
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

      {/* Sidebar + main */}
      <div className="grid grid-cols-12 min-h-[420px]">
        {/* Sidebar */}
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

        {/* Main content */}
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

          {/* Metric cards */}
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

          {/* Match suggestion table */}
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
                  pct: 99,
                },
                {
                  cb: 'Mobile money · Pay Bola',
                  bank: 'MOMO 0240XXX5891',
                  amount: 'GHS 850.00',
                  pct: 96,
                },
                {
                  cb: 'Wire · Tema Office Supply',
                  bank: 'EFT 81203 / TOS',
                  amount: 'GHS 4,250.00',
                  pct: 92,
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

      {/* Floating "match" pill */}
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
 * Section: Bank trust strip (marquee)
 * ------------------------------------------------------------------------- */

function BankStrip() {
  // Duplicate the list so the marquee can loop seamlessly with translate -50%.
  const items = [...BANKS_SUPPORTED, ...BANKS_SUPPORTED]
  return (
    <section className="border-y border-gray-100 bg-white py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-bold uppercase tracking-[0.18em] text-gray-400">
          Bank statement formats supported
        </p>
        <div className="mt-6 relative overflow-hidden">
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
 * Section: Stat band
 * ------------------------------------------------------------------------- */

function StatBand() {
  const stats = [
    { value: '10×', label: 'faster than spreadsheet reconciliation' },
    { value: '98%', label: 'auto-match accuracy on Ghana bank statements' },
    { value: '< 5 min', label: 'setup — sign up, upload, reconcile' },
  ]
  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div data-reveal className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-10">
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
    </section>
  )
}

/* ---------------------------------------------------------------------------
 * Section: Features
 * ------------------------------------------------------------------------- */

function Features() {
  return (
    <section id="features" className="py-20 sm:py-28 bg-gray-50/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div data-reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">
            Features
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
            Everything you need to close a clean bank rec.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-gray-600 leading-relaxed">
            From document ingestion to branded BRS report — every stage is
            handled end-to-end inside one workspace.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => {
            const Icon = f.icon
            return (
              <div
                key={f.title}
                data-reveal
                className="group relative rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-xl hover:-translate-y-0.5 hover:border-primary-200 transition-all duration-300"
              >
                <div className="absolute inset-x-0 top-0 h-1 rounded-t-2xl bg-gradient-to-r from-primary-500 to-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
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
 * Section: How it works
 * ------------------------------------------------------------------------- */

function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div data-reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">
            How it works
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
            Three steps from spreadsheet chaos to signed-off BRS.
          </h2>
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            return (
              <div
                key={s.title}
                data-reveal
                className="relative rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
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
 * Section: Dashboard showcase (split layout)
 * ------------------------------------------------------------------------- */

function DashboardShowcase() {
  return (
    <section className="py-20 sm:py-28 bg-gradient-to-b from-white via-gray-50/60 to-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div data-reveal>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">
              Built for accountants
            </p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
              The same workflow you do today — only faster.
            </h2>
            <p className="mt-4 text-base sm:text-lg text-gray-600 leading-relaxed">
              We modelled the system around how Ghanaian accountants already
              prepare a bank rec — uncredited lodgments, unpresented cheques,
              brought-forward items, discrepancy reporting — so there is no
              relearning required.
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
                to="/register"
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg shadow-sm"
              >
                Try it free
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
            <div className="relative rounded-2xl border border-gray-200 bg-white p-2 shadow-2xl ring-1 ring-black/5">
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
 * Section: Pricing
 * ------------------------------------------------------------------------- */

function Pricing({
  plans,
  billingPeriod,
  setBillingPeriod,
}: {
  plans: PublicPlan[]
  billingPeriod: 'monthly' | 'yearly'
  setBillingPeriod: (p: 'monthly' | 'yearly') => void
}) {
  return (
    <section id="pricing" className="py-20 sm:py-28 bg-gray-50/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div data-reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">
            Pricing
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
            Plans that grow with your practice.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-gray-600">
            All prices in Ghana cedis (GHS). Switch monthly or save with annual.
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
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                billingPeriod === 'yearly' ? 'bg-white text-primary-700' : 'bg-green-100 text-green-700'
              }`}>
                save ~17%
              </span>
            </button>
          </div>
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {plans.length > 0 ? (
            plans.map((p) => <PlanCard key={p.id} plan={p} period={billingPeriod} />)
          ) : (
            <PlanFallback />
          )}
        </div>

        <p className="mt-10 text-center text-sm text-gray-500">
          Need something custom? <a href="#contact" className="font-semibold text-primary-600 hover:underline">Talk to us</a> about firm and enterprise plans.
        </p>
      </div>
    </section>
  )
}

function PlanCard({ plan, period }: { plan: PublicPlan; period: 'monthly' | 'yearly' }) {
  const meta = PLAN_HIGHLIGHTS[plan.id] ?? {
    tagline: '',
    bullets: [],
  }
  const isHighlight = !!meta.badge
  const amount = period === 'yearly' ? plan.yearlyGhs : plan.monthlyGhs
  const isCustom = amount === 0
  return (
    <div
      data-reveal
      className={`relative rounded-2xl p-6 flex flex-col ${
        isHighlight
          ? 'border-2 border-primary-500 bg-white shadow-2xl shadow-primary-600/10 ring-1 ring-primary-100'
          : 'border border-gray-200 bg-white shadow-sm'
      }`}
    >
      {meta.badge && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary-600 text-white text-[11px] font-bold uppercase tracking-wider shadow">
          <Sparkles className="w-3 h-3" />
          {meta.badge}
        </span>
      )}
      <h3 className="text-lg font-bold text-gray-900 capitalize">{plan.name}</h3>
      <p className="mt-1 text-sm text-gray-500 min-h-[2.5rem]">{meta.tagline}</p>

      <div className="mt-5">
        {isCustom ? (
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-gray-900">Custom</span>
          </div>
        ) : (
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-gray-900 tabular-nums">
              {formatGhs(amount)}
            </span>
            <span className="text-sm text-gray-500">/ {period === 'yearly' ? 'year' : 'month'}</span>
          </div>
        )}
        {!isCustom && (
          <p className="mt-1 text-[11px] text-gray-500">
            {plan.projectsPerMonth < 0 ? 'Unlimited' : formatLimit(plan.projectsPerMonth)} projects ·{' '}
            {formatLimit(plan.transactionsPerMonth)} transactions / month
          </p>
        )}
      </div>

      <ul className="mt-6 space-y-2.5 flex-1">
        {meta.bullets.map((b) => (
          <li key={b} className="flex items-start gap-2.5 text-sm text-gray-700">
            <Check className={`mt-0.5 w-4 h-4 flex-shrink-0 ${isHighlight ? 'text-primary-600' : 'text-green-600'}`} />
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <Link
        to="/register"
        className={`mt-7 inline-flex justify-center items-center gap-1.5 px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
          isHighlight
            ? 'text-white bg-primary-600 hover:bg-primary-700 shadow-md shadow-primary-600/20'
            : 'text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200'
        }`}
      >
        {isCustom ? 'Contact sales' : 'Start free trial'}
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  )
}

function PlanFallback() {
  return (
    <div className="md:col-span-2 lg:col-span-4 rounded-2xl border border-dashed border-gray-200 p-8 text-center bg-white">
      <p className="text-sm text-gray-500">
        Live pricing temporarily unavailable.{' '}
        <Link to="/register" className="font-semibold text-primary-600 hover:underline">
          Create an account
        </Link>{' '}
        to view current plans.
      </p>
    </div>
  )
}

/* ---------------------------------------------------------------------------
 * Section: Testimonials
 * ------------------------------------------------------------------------- */

function Testimonials() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div data-reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">
            Loved by accounting teams
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
            What customers say.
          </h2>
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-5">
          {TESTIMONIALS.map((t, i) => (
            <figure
              key={i}
              data-reveal
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm flex flex-col"
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
 * Section: FAQ
 * ------------------------------------------------------------------------- */

function Faq({
  openFaq,
  setOpenFaq,
}: {
  openFaq: number | null
  setOpenFaq: (i: number | null) => void
}) {
  return (
    <section id="faq" className="py-20 sm:py-28 bg-gray-50/40">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div data-reveal className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">
            FAQ
          </p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
            Common questions, answered.
          </h2>
        </div>

        <div className="mt-12 space-y-3">
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
 * Section: Final CTA
 * ------------------------------------------------------------------------- */

function FinalCta() {
  return (
    <section className="py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary-700 via-primary-600 to-primary-800 p-10 sm:p-14 text-white shadow-2xl">
          <div aria-hidden className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-green-400/30 blur-3xl" />
          <div aria-hidden className="absolute -bottom-24 -left-10 w-80 h-80 rounded-full bg-primary-300/30 blur-3xl" />
          <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Close your next bank rec in an afternoon, not a week.
              </h2>
              <p className="mt-4 text-base sm:text-lg text-white/85 leading-relaxed max-w-xl">
                Sign up free, upload a sample cash book and statement, and watch
                the matching engine work. Upgrade only when you are ready.
              </p>
            </div>
            <div className="lg:justify-self-end flex flex-col sm:flex-row gap-3">
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
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------------------
 * Section: Footer
 * ------------------------------------------------------------------------- */

function Footer() {
  return (
    <footer id="contact" className="border-t border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10">
          <div className="col-span-2">
            <BrandLogo className="h-9 w-auto" />
            <p className="mt-4 text-sm text-gray-600 leading-relaxed max-w-sm">
              Bank reconciliation built for Ghanaian accountants and finance
              teams. Match faster, report cleaner, audit better.
            </p>
            <ul className="mt-6 space-y-2.5 text-sm text-gray-600">
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary-600 flex-shrink-0" />
                <a
                  href="mailto:info@kqsoftwaresolutions.com"
                  className="hover:text-gray-900 break-all"
                >
                  info@kqsoftwaresolutions.com
                </a>
              </li>
              <li className="flex items-start gap-2">
                <Phone className="w-4 h-4 mt-0.5 text-primary-600 flex-shrink-0" />
                <span className="flex flex-col">
                  <a href="tel:+233302512596" className="hover:text-gray-900">
                    0302 512 596
                  </a>
                  <a href="tel:+233275762180" className="hover:text-gray-900">
                    0275 762 180
                  </a>
                  <a href="tel:+233245396813" className="hover:text-gray-900">
                    0245 396 813
                  </a>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 text-primary-600 flex-shrink-0" />
                <span>
                  USS No. NS 12, Third Gate
                  <br />
                  Madina, Accra
                  <br />
                  P. O. Box CT 6306, Cantonments, Accra
                </span>
              </li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">
              Product
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li><a href="#features" className="text-gray-600 hover:text-gray-900">Features</a></li>
              <li><a href="#how-it-works" className="text-gray-600 hover:text-gray-900">How it works</a></li>
              <li><a href="#pricing" className="text-gray-600 hover:text-gray-900">Pricing</a></li>
              <li><a href="#faq" className="text-gray-600 hover:text-gray-900">FAQ</a></li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">
              Account
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li><Link to="/login" className="text-gray-600 hover:text-gray-900">Sign in</Link></li>
              <li><Link to="/register" className="text-gray-600 hover:text-gray-900">Create account</Link></li>
              <li><Link to="/forgot-password" className="text-gray-600 hover:text-gray-900">Forgot password</Link></li>
            </ul>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-gray-400">
              Resources
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li><a href="/user-manual.md" className="text-gray-600 hover:text-gray-900">User manual</a></li>
              <li><a href="mailto:info@kqsoftwaresolutions.com" className="text-gray-600 hover:text-gray-900">Support</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-gray-100 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} KQ-SOFT Solutions. All rights reserved.
          </p>
          <p className="text-xs text-gray-500 flex items-center gap-2">
            <span className="inline-flex w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse-dot" />
            Service operational
          </p>
        </div>
      </div>
    </footer>
  )
}
