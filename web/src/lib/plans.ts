/**
 * Marketing-side plan definitions (published pricing & feature matrix).
 *
 * Offline fallback when `/api/v1/public/plans` is unreachable. When the API
 * responds, CMS data from platform admin Plans is the source of truth for
 * prices, limits, taglines, bullets, and comparison-table copy.
 *
 * See `docs/PRICING_CMS_AUDIT.md` for what is CMS-driven vs catalogue defaults.
 */

export type PlanSlug = 'free' | 'basic' | 'standard' | 'premium' | 'firm'

/** Public names for the stable slugs. Unknown values are returned unchanged. */
const PUBLIC_PLAN_NAMES: Record<string, string> = {
  free: 'Free',
  basic: 'Solo',
  standard: 'Team',
  premium: 'Firm',
  firm: 'Custom',
}

export function publicPlanName(slug: string | null | undefined, cmsName?: string | null): string {
  if (cmsName?.trim()) return cmsName.trim()
  if (!slug) return 'Solo'
  return PUBLIC_PLAN_NAMES[slug] ?? slug
}

export type BillingPeriod = 'monthly' | 'quarterly' | 'yearly'

export interface MarketingPlan {
  slug: PlanSlug
  name: string
  tagline: string
  audience: string
  /** Optional ribbon — e.g. "Most popular", "Best for firms" */
  badge?: string
  /** Whether to apply the visual highlight treatment (border, ring, primary CTA). */
  highlight?: boolean
  monthlyGhs: number
  yearlyGhs: number
  quarterlyGhs: number
  /** -1 = unlimited */
  projectsPerMonth: number
  /** -1 = unlimited */
  transactionsPerMonth: number
  /** Org-wide bank account seats (-1 = unlimited). */
  bankAccounts: number
  /** -1 = unlimited */
  users: number
  /** Full Tools clean Excel/PDF exports per month (-1 = unlimited). */
  cleanExportsPerMonth?: number
  /** Concise bullets shown directly on the plan card. */
  bullets: string[]
  /** Inherits-from copy for the card, e.g. "Everything in Solo, plus:". */
  inheritsFromLabel?: string
  /** Per-feature value used by the comparison matrix. */
  features: Record<string, boolean | string>
  ctaLabel: string
  /** Either an internal route (`/register`) or external mailto/URL. */
  ctaHref: string
  /** When false, landing still lists the package but checkout is closed. */
  active?: boolean
}

/* -------------------------------------------------------------------------
 * Comparison matrix
 *
 * Grouped by capability area for the landing-page comparison table.
 * Feature IDs match the shape used in `MarketingPlan.features`.
 * ----------------------------------------------------------------------- */

export interface FeatureRow {
  id: string
  label: string
  /** Optional tooltip / longer description. */
  hint?: string
}

export interface FeatureGroup {
  title: string
  features: FeatureRow[]
}

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    title: 'Plan limits',
    features: [
      { id: 'bank_accounts', label: 'Bank accounts' },
      { id: 'transactions', label: 'Transactions per month' },
      { id: 'projects', label: 'Projects per month' },
      { id: 'users', label: 'Team members' },
    ],
  },
  {
    title: 'Document import',
    features: [
      { id: 'imports', label: 'Excel, CSV & PDF imports' },
      { id: 'ocr', label: 'OCR for scanned bank statements' },
      {
        id: 'bank_parsers',
        label:
          'Pre-built bank statement layouts (e.g. Ecobank, GCB, Access, Stanbic, Fidelity, Zenith, CalBank, ADB, Prudential) + generic CSV/Excel/PDF',
      },
    ],
  },
  {
    title: 'Matching engine',
    features: [
      { id: 'one_to_one', label: 'One-to-one auto-match suggestions' },
      { id: 'bulk_match', label: 'Bulk match', hint: 'Confirm many suggestions in one click' },
      { id: 'ai_suggestions', label: 'AI-powered match ranking' },
      { id: 'one_to_many', label: 'One-to-many matches (split payments)' },
      { id: 'many_to_many', label: 'Many-to-many matches' },
      { id: 'bank_rules', label: 'Bank rules engine' },
    ],
  },
  {
    title: 'Reporting & audit',
    features: [
      { id: 'brs_export', label: 'BRS export (Excel + PDF)' },
      { id: 'clean_exports', label: 'Full clean Excel/PDF exports' },
      { id: 'discrepancy', label: 'Discrepancy report (date/amount differences in matched pairs)' },
      { id: 'missing_cheques', label: 'Missing cheques report with ageing' },
      { id: 'audit_trail', label: 'Activity log' },
      { id: 'roll_forward', label: 'Roll forward across periods' },
      { id: 'threshold_approval', label: 'Threshold approval' },
    ],
  },
  {
    title: 'Branding & multi-client',
    features: [
      { id: 'basic_branding', label: 'Default report branding' },
      { id: 'full_branding', label: 'Full branding (logo, colours, custom footer)' },
      { id: 'firm_dashboard', label: 'Practice overview dashboard' },
      { id: 'multi_client', label: 'Multi-client organisation' },
    ],
  },
  {
    title: 'Support & services',
    features: [
      { id: 'email_support', label: 'Email support' },
      { id: 'priority_support', label: 'Priority support' },
      { id: 'advisory', label: 'Bookkeeping consultancy / advisory' },
      { id: 'onboarding', label: 'Personalised onboarding' },
      { id: 'api_access', label: 'Public REST API' },
    ],
  },
]

/* -------------------------------------------------------------------------
 * Sep 2026 plan lineup — keep in sync with api/src/config/subscription.ts
 * Slugs stay free / basic / standard / premium / firm. Public names are Free / Solo / Team / Firm / Custom.
 * Paid plans have no trial. New organisations start on Free.
 * ----------------------------------------------------------------------- */

export const MARKETING_PLANS: MarketingPlan[] = [
  {
    slug: 'free',
    name: 'Free',
    tagline: '1 person, 1 bank account, 300 transactions, and 3 projects a month.',
    audience: 'Getting started',
    monthlyGhs: 0,
    yearlyGhs: 0,
    quarterlyGhs: 0,
    projectsPerMonth: 3,
    transactionsPerMonth: 300,
    bankAccounts: 1,
    users: 1,
    cleanExportsPerMonth: 0,
    bullets: [
      '3 projects / month · 1 team member',
      'Watermarked sample downloads',
      'Excel, CSV and PDF imports, plus OCR',
      'Auto-match suggestions and BRS export',
      'Bulk confirm up to 10 pairs',
      '14-day activity log and a 5-row discrepancy preview',
    ],
    features: {
      bank_accounts: '1',
      projects: '3 / month',
      transactions: '300 / month',
      users: '1',
      imports: true,
      ocr: true,
      bank_parsers: true,
      one_to_one: true,
      bulk_match: 'Up to 10 pairs',
      ai_suggestions: false,
      one_to_many: false,
      many_to_many: false,
      bank_rules: false,
      brs_export: true,
      clean_exports: 'Samples only',
      discrepancy: 'First 5 rows',
      missing_cheques: 'First 10 rows',
      audit_trail: 'Last 14 days',
      roll_forward: false,
      threshold_approval: false,
      basic_branding: true,
      full_branding: false,
      firm_dashboard: false,
      multi_client: false,
      api_access: false,
      email_support: true,
      priority_support: false,
      advisory: false,
      onboarding: false,
    },
    ctaLabel: 'Start free',
    ctaHref: '/register',
  },
  {
    slug: 'basic',
    name: 'Solo',
    tagline: '1 person, 3 bank accounts, and 3,000 transactions a month.',
    audience: 'Solo accountant',
    monthlyGhs: 199,
    yearlyGhs: 1990,
    quarterlyGhs: 567,
    projectsPerMonth: 12,
    transactionsPerMonth: 3_000,
    bankAccounts: 3,
    users: 1,
    cleanExportsPerMonth: 5,
    inheritsFromLabel: 'Everything in Free, plus:',
    bullets: [
      '12 projects / month',
      '5 full clean exports / month',
      'Bulk confirm up to 50 pairs',
      'Split and many-to-many matching',
      'Roll forward across periods',
      'AI match ranking',
      'Bookkeeping advisory',
      'Full discrepancy and missing-cheques reports',
      'Up to 5 bank rules',
      'Activity log (view)',
    ],
    features: {
      bank_accounts: '3',
      projects: '12 / month',
      transactions: '3,000 / month',
      users: '1',
      imports: true,
      ocr: true,
      bank_parsers: true,
      one_to_one: true,
      bulk_match: 'Up to 50 pairs',
      ai_suggestions: true,
      one_to_many: true,
      many_to_many: true,
      bank_rules: 'Up to 5 rules',
      brs_export: true,
      clean_exports: '5 / month',
      discrepancy: true,
      missing_cheques: true,
      audit_trail: 'View only',
      roll_forward: true,
      threshold_approval: false,
      basic_branding: true,
      full_branding: false,
      firm_dashboard: false,
      multi_client: false,
      api_access: false,
      email_support: true,
      priority_support: false,
      advisory: true,
      onboarding: false,
    },
    ctaLabel: 'Subscribe',
    ctaHref: '/register',
  },
  {
    slug: 'standard',
    name: 'Team',
    tagline: '5 people, 10 bank accounts, and 15,000 transactions a month.',
    audience: 'Small finance team',
    badge: 'Most popular',
    highlight: true,
    monthlyGhs: 399,
    yearlyGhs: 3990,
    quarterlyGhs: 1137,
    projectsPerMonth: 40,
    transactionsPerMonth: 15_000,
    bankAccounts: 10,
    users: 5,
    cleanExportsPerMonth: 20,
    inheritsFromLabel: 'Everything in Solo, plus:',
    bullets: [
      '40 projects / month',
      '20 full clean exports / month',
      'Bank rules engine',
      'Discrepancy report and audit trail',
      'Logo and report branding',
      'Activity log export',
      'Approval threshold warning',
    ],
    features: {
      bank_accounts: '10',
      projects: '40 / month',
      transactions: '15,000 / month',
      users: '5',
      imports: true,
      ocr: true,
      bank_parsers: true,
      one_to_one: true,
      bulk_match: 'Up to 50 pairs',
      ai_suggestions: true,
      one_to_many: true,
      many_to_many: true,
      bank_rules: true,
      brs_export: true,
      clean_exports: '20 / month',
      discrepancy: true,
      missing_cheques: true,
      audit_trail: 'View and export',
      roll_forward: true,
      threshold_approval: 'Warning',
      basic_branding: true,
      full_branding: true,
      firm_dashboard: false,
      multi_client: false,
      api_access: false,
      email_support: true,
      priority_support: false,
      advisory: true,
      onboarding: false,
    },
    ctaLabel: 'Subscribe',
    ctaHref: '/register',
  },
  {
    slug: 'premium',
    name: 'Firm',
    tagline: '10 people, 30 bank accounts, and 40,000 transactions a month.',
    audience: 'Established practice',
    monthlyGhs: 990,
    yearlyGhs: 9900,
    quarterlyGhs: 2822,
    projectsPerMonth: 100,
    transactionsPerMonth: 40_000,
    bankAccounts: 30,
    users: 10,
    cleanExportsPerMonth: 60,
    inheritsFromLabel: 'Everything in Team, plus:',
    bullets: [
      '100 projects / month',
      '60 full clean exports / month',
      'Threshold blocks checker approval',
      'Priority support',
      'Bulk confirm up to 100 pairs',
    ],
    features: {
      bank_accounts: '30',
      projects: '100 / month',
      transactions: '40,000 / month',
      users: '10',
      imports: true,
      ocr: true,
      bank_parsers: true,
      one_to_one: true,
      bulk_match: 'Up to 100 pairs',
      ai_suggestions: true,
      one_to_many: true,
      many_to_many: true,
      bank_rules: true,
      brs_export: true,
      clean_exports: '60 / month',
      discrepancy: true,
      missing_cheques: true,
      audit_trail: 'View and export',
      roll_forward: true,
      threshold_approval: 'Blocks checker approval',
      basic_branding: true,
      full_branding: true,
      firm_dashboard: true,
      multi_client: false,
      api_access: false,
      email_support: true,
      priority_support: true,
      advisory: true,
      onboarding: false,
    },
    ctaLabel: 'Subscribe',
    ctaHref: '/register',
  },
  {
    slug: 'firm',
    name: 'Custom',
    tagline: 'Unlimited accounts and seats, with a multi-client organisation. From GHS 1,800 / month.',
    audience: 'Accounting firm / enterprise',
    badge: 'Best for firms',
    monthlyGhs: 0,
    yearlyGhs: 0,
    quarterlyGhs: 0,
    projectsPerMonth: -1,
    transactionsPerMonth: -1,
    bankAccounts: -1,
    users: -1,
    cleanExportsPerMonth: -1,
    inheritsFromLabel: 'Everything in Firm, plus:',
    bullets: [
      'Unlimited projects and clean exports',
      'Public REST API',
      'Personalised onboarding',
      'Priority support (4-hour SLA)',
      'Custom contract',
    ],
    features: {
      bank_accounts: 'Unlimited',
      projects: 'Unlimited',
      transactions: 'Unlimited',
      users: 'Unlimited',
      imports: true,
      ocr: true,
      bank_parsers: true,
      one_to_one: true,
      bulk_match: '500 per confirm',
      ai_suggestions: true,
      one_to_many: true,
      many_to_many: true,
      bank_rules: true,
      brs_export: true,
      clean_exports: 'Unlimited',
      discrepancy: true,
      missing_cheques: true,
      audit_trail: 'View and export',
      roll_forward: true,
      threshold_approval: 'Blocks checker approval',
      basic_branding: true,
      full_branding: true,
      firm_dashboard: true,
      multi_client: true,
      api_access: true,
      email_support: true,
      priority_support: true,
      advisory: true,
      onboarding: true,
    },
    ctaLabel: 'Contact sales',
    ctaHref: 'mailto:info@kqsoftwaresolutions.com?subject=KQ-SOFT%20Custom%20plan%20enquiry',
  },
]

/* -------------------------------------------------------------------------
 * Helpers
 * ----------------------------------------------------------------------- */

export type ApiPlanMarketing = {
  tagline: string
  audience: string
  badge?: string | null
  highlight?: boolean
  bullets: string[]
  inheritsFromLabel?: string | null
  ctaLabel: string
  ctaHref: string
  featureMatrix: Record<string, boolean | string>
}

export type ApiPublicPlan = {
  id: string
  name: string
  monthlyGhs: number
  yearlyGhs: number
  quarterlyGhs?: number
  projectsPerMonth: number
  transactionsPerMonth: number
  bankAccounts?: number
  usersLimit?: number
  cleanExportsPerMonth?: number
  features?: Record<string, boolean>
  marketing?: ApiPlanMarketing
  active?: boolean
  sortOrder?: number
}

function suggestTaglineFromQuotas(quotas: {
  bankAccounts: number
  projectsPerMonth: number
  transactionsPerMonth: number
  users: number
}): string {
  const banks =
    quotas.bankAccounts < 0
      ? 'unlimited bank accounts'
      : `${quotas.bankAccounts} bank account${quotas.bankAccounts === 1 ? '' : 's'}`
  const tx =
    quotas.transactionsPerMonth < 0
      ? 'unlimited transactions'
      : `${quotas.transactionsPerMonth.toLocaleString('en-GH')} transactions`
  const projects =
    quotas.projectsPerMonth < 0
      ? 'unlimited projects'
      : `${quotas.projectsPerMonth} project${quotas.projectsPerMonth === 1 ? '' : 's'}`
  const people =
    quotas.users < 0
      ? 'unlimited team members'
      : quotas.users === 1
        ? '1 person'
        : `${quotas.users} people`
  if (quotas.users === 1) {
    return `${people}, ${banks}, ${tx}, and ${projects} a month.`
  }
  return `${people}, ${banks}, ${tx}, and ${projects} a month.`
}

const QUOTA_LEAD_BULLET =
  /projects?\s*\/?\s*month|team member|team members|people|person\b/i

/** Align pricing card tagline + lead bullet with CMS numeric limits (API also syncs at serve time). */
function applyQuotaProseToMarketingPlan(plan: MarketingPlan): MarketingPlan {
  const tagline = suggestTaglineFromQuotas({
    bankAccounts: plan.bankAccounts,
    projectsPerMonth: plan.projectsPerMonth,
    transactionsPerMonth: plan.transactionsPerMonth,
    users: plan.users,
  })
  const leadProjects =
    plan.projectsPerMonth < 0
      ? 'Unlimited projects / month'
      : `${plan.projectsPerMonth.toLocaleString('en-GH')} projects / month`
  const leadMembers =
    plan.users < 0
      ? 'unlimited team members'
      : `${plan.users} team member${plan.users === 1 ? '' : 's'}`
  const lead = `${leadProjects} · ${leadMembers}`
  const bullets = plan.bullets.length ? [...plan.bullets] : [lead]
  if (bullets.length > 0 && QUOTA_LEAD_BULLET.test(bullets[0] ?? '')) {
    bullets[0] = lead
  }
  return { ...plan, tagline, bullets }
}

/** Pricing cards: tagline + bullets always follow numeric CMS limits (same source as comparison table). */
export function planPricingCardCopy(plan: MarketingPlan): { tagline: string; bullets: string[] } {
  const synced = applyQuotaProseToMarketingPlan(plan)
  return { tagline: synced.tagline, bullets: synced.bullets }
}

function apiPlanToMarketing(p: ApiPublicPlan, fallback: MarketingPlan): MarketingPlan {
  const m = p.marketing
  if (!m) return applyQuotaProseToMarketingPlan(fallback)
  const merged = {
    ...fallback,
    slug: fallback.slug,
    name: p.name || fallback.name,
    tagline: m.tagline || fallback.tagline,
    audience: m.audience || fallback.audience,
    badge: m.badge ?? fallback.badge,
    highlight: m.highlight ?? fallback.highlight,
    bullets: m.bullets?.length ? m.bullets : fallback.bullets,
    inheritsFromLabel: m.inheritsFromLabel ?? fallback.inheritsFromLabel,
    ctaLabel: m.ctaLabel || fallback.ctaLabel,
    ctaHref: m.ctaHref || fallback.ctaHref,
    monthlyGhs: p.monthlyGhs,
    yearlyGhs: p.yearlyGhs,
    quarterlyGhs: p.quarterlyGhs ?? fallback.quarterlyGhs,
    projectsPerMonth: p.projectsPerMonth,
    transactionsPerMonth: p.transactionsPerMonth,
    bankAccounts: p.bankAccounts ?? fallback.bankAccounts,
    users: p.usersLimit ?? fallback.users,
    cleanExportsPerMonth: p.cleanExportsPerMonth ?? fallback.cleanExportsPerMonth,
    features: {
      ...fallback.features,
      ...(m.featureMatrix ?? {}),
    },
    active: p.active !== false,
  }
  return applyQuotaProseToMarketingPlan(merged)
}

/**
 * Merge live CMS data from the API into published plan definitions.
 * Numeric limits drive taglines, lead bullets, and comparison limit rows.
 */
export function mergeWithApiPlans(apiPlans: ReadonlyArray<ApiPublicPlan> | undefined): MarketingPlan[] {
  if (!apiPlans || apiPlans.length === 0) return MARKETING_PLANS
  const pickNum = (v: unknown, fallback: number) => {
    if (v === null || v === undefined) return fallback
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
  }
  const staticBySlug = new Map(MARKETING_PLANS.map((p) => [p.slug, p]))
  const sorted = [...apiPlans].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id.localeCompare(b.id)
  )

  return sorted.map((live) => {
    const slug = live.id as PlanSlug
    const p = staticBySlug.get(slug) ?? {
      slug,
      name: live.name || live.id,
      tagline: '',
      audience: '',
      monthlyGhs: 0,
      yearlyGhs: 0,
      quarterlyGhs: 0,
      projectsPerMonth: 0,
      transactionsPerMonth: 0,
      bankAccounts: 0,
      users: 1,
      bullets: [],
      features: {},
      ctaLabel: 'Subscribe',
      ctaHref: '/register',
    }
    const merged: MarketingPlan = {
      ...p,
      slug,
      name: live.name || p.name,
      monthlyGhs: pickNum(live.monthlyGhs, p.monthlyGhs),
      yearlyGhs: pickNum(live.yearlyGhs, p.yearlyGhs),
      quarterlyGhs: pickNum(live.quarterlyGhs, p.quarterlyGhs),
      projectsPerMonth: pickNum(live.projectsPerMonth, p.projectsPerMonth),
      transactionsPerMonth: pickNum(live.transactionsPerMonth, p.transactionsPerMonth),
      bankAccounts: pickNum(live.bankAccounts, p.bankAccounts),
      users: pickNum(live.usersLimit, p.users),
      cleanExportsPerMonth: pickNum(live.cleanExportsPerMonth, p.cleanExportsPerMonth ?? 0),
      active: live.active !== false,
    }
    merged.features = {
      ...p.features,
      bank_accounts:
        merged.bankAccounts < 0 ? 'Unlimited' : String(merged.bankAccounts),
      projects:
        merged.projectsPerMonth < 0
          ? 'Unlimited'
          : `${merged.projectsPerMonth.toLocaleString('en-GH')} / month`,
      transactions:
        merged.transactionsPerMonth < 0
          ? 'Unlimited'
          : `${merged.transactionsPerMonth.toLocaleString('en-GH')} / month`,
      users: merged.users < 0 ? 'Unlimited' : String(merged.users),
    }
    if (live.features) {
      const featureAlias: Record<string, string> = {
        discrepancy_report: 'discrepancy',
        missing_cheques_report: 'missing_cheques',
      }
      for (const [key, value] of Object.entries(live.features)) {
        if (typeof value !== 'boolean') continue
        const target = featureAlias[key] ?? key
        if (!(target in merged.features)) merged.features[target] = value
        else {
          const current = merged.features[target]
          if (value === false) merged.features[target] = false
          else if (current === false) merged.features[target] = true
        }
      }
    }
    if (live.marketing) {
      return apiPlanToMarketing(live, merged)
    }
    return applyQuotaProseToMarketingPlan(merged)
  })
}

export function formatGhs(amount: number): string {
  if (!Number.isFinite(amount)) return '—'
  if (amount === 0) return 'Free'
  if (amount < 0) return '—'
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

export function planAmountForPeriod(plan: MarketingPlan, period: BillingPeriod): number {
  if (period === 'yearly') return plan.yearlyGhs
  if (period === 'quarterly') return plan.quarterlyGhs
  return plan.monthlyGhs
}

/** Paid checkout is closed; price is sales-led (not the Free tier). */
export function isContactSalesPlan(plan: Pick<MarketingPlan, 'slug' | 'monthlyGhs' | 'yearlyGhs' | 'quarterlyGhs'>): boolean {
  if (plan.slug === 'free') return false
  return plan.monthlyGhs <= 0 && plan.yearlyGhs <= 0 && plan.quarterlyGhs <= 0
}

/** Short label for comparison tables when checkout amounts are zero (CMS tagline first). */
export function contactSalesPriceLabel(tagline: string | undefined): string {
  const raw = tagline?.trim()
  if (!raw) return 'Custom pricing'
  const first = raw.split(/[.!?\n]/)[0]?.trim()
  if (!first) return 'Custom pricing'
  return first.length > 56 ? `${first.slice(0, 53)}…` : first
}

export function comparisonTablePriceLabel(
  plan: Pick<MarketingPlan, 'slug' | 'tagline' | 'monthlyGhs' | 'yearlyGhs' | 'quarterlyGhs'>,
  amount: number
): string {
  if (isContactSalesPlan(plan)) return contactSalesPriceLabel(plan.tagline)
  if (amount === 0) return 'Free'
  return formatGhs(amount)
}

export function planMonthlyEquivalent(plan: MarketingPlan, period: BillingPeriod): number {
  if (period === 'yearly') return plan.yearlyGhs / 12
  if (period === 'quarterly') return plan.quarterlyGhs / 3
  return plan.monthlyGhs
}
