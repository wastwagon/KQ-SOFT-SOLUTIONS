/**
 * Marketing-side plan catalogue.
 *
 * This is the single source of truth for what appears on the public landing
 * page (`/`) and never depends on a network round-trip — the landing page
 * always renders even when the API is unreachable.
 *
 * The API may override price/limits via `/api/v1/public/plans` (so admins
 * can tune pricing from the admin dashboard without a redeploy), but the
 * marketing copy (taglines, feature bullets, comparison matrix, audience
 * blurbs) is curated here so it does not get accidentally clobbered by
 * editing the DB directly.
 *
 * Source of truth for tier features:
 *   PLANNING_DATA.json → subscription_tiers
 *   api/src/config/subscription.ts → TIER_LIMITS, PLAN_PRICES
 *
 * Keep this file aligned with those when prices/limits change.
 */

export type PlanSlug = 'basic' | 'standard' | 'premium' | 'firm'

/** Public names for the stable slugs. Unknown values are returned unchanged. */
const PUBLIC_PLAN_NAMES: Record<string, string> = {
  basic: 'Solo',
  standard: 'Team',
  premium: 'Firm',
  firm: 'Custom',
}

export function publicPlanName(slug: string | null | undefined): string {
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
    title: 'Workspace limits',
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
      { id: 'bulk_match', label: 'Bulk match', hint: 'Confirm dozens of suggestions in one click' },
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
      { id: 'discrepancy', label: 'Discrepancy report (date/amount variances)' },
      { id: 'audit_trail', label: 'Full audit trail' },
      { id: 'roll_forward', label: 'Roll forward across periods' },
      { id: 'threshold_approval', label: 'Threshold approval workflow' },
    ],
  },
  {
    title: 'Branding & multi-client',
    features: [
      { id: 'basic_branding', label: 'Default report branding' },
      { id: 'full_branding', label: 'Full branding (logo, colours, custom footer)' },
      { id: 'firm_dashboard', label: 'Practice overview dashboard' },
      { id: 'multi_client', label: 'Multi-client workspace' },
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
 * Sep 2026 catalogue — keep in sync with api/src/config/subscription.ts
 * Slugs stay basic / standard / premium / firm. Public names are Solo / Team / Firm / Custom.
 * ----------------------------------------------------------------------- */

export const MARKETING_PLANS: MarketingPlan[] = [
  {
    slug: 'basic',
    name: 'Solo',
    tagline: 'For one accountant working a full monthly statement.',
    audience: 'Solo accountant',
    monthlyGhs: 199,
    yearlyGhs: 1990,
    quarterlyGhs: 567,
    projectsPerMonth: 12,
    transactionsPerMonth: 3_000,
    bankAccounts: 3,
    users: 1,
    cleanExportsPerMonth: 5,
    bullets: [
      '3 bank accounts · 3,000 transactions / month',
      'Up to 12 projects / month · 1 team member',
      '5 full clean exports / month (sample downloads free)',
      '14-day free trial',
      '50% off your first 2 months',
      'Bookkeeping consultancy / advisory',
      'Excel, CSV & PDF imports + OCR',
      'Pre-built regional bank statement layouts',
      'Auto-match suggestions + bulk confirm (up to 50)',
      '1:1, many-to-1 and many-to-many matching',
      'AI-assisted match ranking from confirmed pairs',
      'BRS export (Excel + PDF)',
      'Email support',
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
      bank_rules: false,
      brs_export: true,
      discrepancy: false,
      audit_trail: false,
      roll_forward: false,
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
    ctaLabel: 'Start 14-day trial',
    ctaHref: '/register',
  },
  {
    slug: 'standard',
    name: 'Team',
    tagline: 'For a small team that needs a full statement, not an 800-row cap.',
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
      '10 bank accounts · 15,000 transactions / month',
      'Up to 40 projects / month · 5 team members',
      '20 full clean exports / month (sample downloads free)',
      'Bulk match (up to 50 pairs)',
      'AI-powered match ranking',
      'Bank rules engine',
      'Discrepancy report & full audit trail',
      'Logo & full report branding on PDF exports',
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
      discrepancy: true,
      audit_trail: true,
      roll_forward: false,
      threshold_approval: false,
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
    ctaLabel: 'Start free trial',
    ctaHref: '/register',
  },
  {
    slug: 'premium',
    name: 'Firm',
    tagline: 'For a practice that has outgrown an eight-person file tool.',
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
      '30 bank accounts · 40,000 transactions / month',
      'Up to 100 projects / month · 10 team members',
      '60 full clean exports / month (sample downloads free)',
      'Roll forward across periods',
      'Threshold approval workflow',
      'Priority support',
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
      bulk_match: 'Up to 50 pairs',
      ai_suggestions: true,
      one_to_many: true,
      many_to_many: true,
      bank_rules: true,
      brs_export: true,
      discrepancy: true,
      audit_trail: true,
      roll_forward: true,
      threshold_approval: true,
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
    ctaLabel: 'Start free trial',
    ctaHref: '/register',
  },
  {
    slug: 'firm',
    name: 'Custom',
    tagline: 'From GHS 1,800 / month. Unlimited seats for multi-client firms.',
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
      'Unlimited bank accounts, transactions & members',
      'Unlimited full clean exports (sample downloads free)',
      'Multi-client workspace',
      'Public REST API access',
      'Personalised onboarding',
      'Priority support (4-hour SLA)',
      'Custom contract & billing',
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
      bulk_match: 'Unlimited',
      ai_suggestions: true,
      one_to_many: true,
      many_to_many: true,
      bank_rules: true,
      brs_export: true,
      discrepancy: true,
      audit_trail: true,
      roll_forward: true,
      threshold_approval: true,
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

export function isQuotaBullet(text: string): boolean {
  return /bank accounts|transactions\s*\/\s*month|projects\s*\/\s*month|team member|clean export/i.test(
    text
  )
}

export function quotaSummaryBullets(plan: {
  bankAccounts: number
  transactionsPerMonth: number
  projectsPerMonth: number
  users: number
  cleanExportsPerMonth?: number
}): string[] {
  const banks =
    plan.bankAccounts < 0
      ? 'Unlimited bank accounts'
      : `${plan.bankAccounts.toLocaleString('en-GH')} bank accounts`
  const tx =
    plan.transactionsPerMonth < 0
      ? 'unlimited transactions / month'
      : `${plan.transactionsPerMonth.toLocaleString('en-GH')} transactions / month`
  const projects =
    plan.projectsPerMonth < 0
      ? 'Unlimited projects'
      : `Up to ${plan.projectsPerMonth.toLocaleString('en-GH')} projects / month`
  const users =
    plan.users < 0 ? 'unlimited members' : `${plan.users} team member${plan.users === 1 ? '' : 's'}`
  const bullets = [`${banks} · ${tx}`, `${projects} · ${users}`]
  if (plan.cleanExportsPerMonth == null) return bullets
  bullets.push(
    plan.cleanExportsPerMonth < 0
      ? 'Unlimited full clean exports (sample downloads free)'
      : `${plan.cleanExportsPerMonth.toLocaleString('en-GH')} full clean exports / month (sample downloads free)`
  )
  return bullets
}

/**
 * Merge live data from the API into the static catalogue.
 * If the API is unreachable or returns nothing, the static catalogue is
 * returned unchanged so the landing page still renders.
 */
export function mergeWithApiPlans(
  apiPlans: ReadonlyArray<{
    id: string
    monthlyGhs: number
    yearlyGhs: number
    quarterlyGhs?: number
    projectsPerMonth: number
    transactionsPerMonth: number
    bankAccounts?: number
    usersLimit?: number
    cleanExportsPerMonth?: number
    features?: Record<string, boolean>
    active?: boolean
  }> | undefined
): MarketingPlan[] {
  if (!apiPlans || apiPlans.length === 0) return MARKETING_PLANS
  const pickNum = (v: unknown, fallback: number) => {
    if (v === null || v === undefined) return fallback
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
  }
  const byId = new Map(apiPlans.map((p) => [p.id, p]))
  return MARKETING_PLANS.map((p) => {
    const live = byId.get(p.slug)
    if (!live) return p
    const merged: MarketingPlan = {
      ...p,
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
      }
      for (const [key, value] of Object.entries(live.features)) {
        if (typeof value !== 'boolean') continue
        const target = featureAlias[key] ?? key
        if (target in merged.features) merged.features[target] = value
      }
    }
    const marketing = p.bullets.filter((b) => !isQuotaBullet(b))
    merged.bullets = [...quotaSummaryBullets(merged), ...marketing]
    return merged
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

export function planMonthlyEquivalent(plan: MarketingPlan, period: BillingPeriod): number {
  if (period === 'yearly') return plan.yearlyGhs / 12
  if (period === 'quarterly') return plan.quarterlyGhs / 3
  return plan.monthlyGhs
}
