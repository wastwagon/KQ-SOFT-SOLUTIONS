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
  /** Concise bullets shown directly on the plan card. */
  bullets: string[]
  /** Inherits-from copy for the card, e.g. "Everything in Standard, plus:". */
  inheritsFromLabel?: string
  /** Per-feature value used by the comparison matrix. */
  features: Record<string, boolean | string>
  ctaLabel: string
  /** Either an internal route (`/register`) or external mailto/URL. */
  ctaHref: string
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
 * Jul 2026 catalogue — keep in sync with api/src/config/subscription.ts
 * ----------------------------------------------------------------------- */

export const MARKETING_PLANS: MarketingPlan[] = [
  {
    slug: 'basic',
    name: 'Basic',
    tagline: 'For solo accountants getting started — with advisory support.',
    audience: 'Solo practitioner',
    monthlyGhs: 300,
    yearlyGhs: 3000,
    quarterlyGhs: 855,
    projectsPerMonth: 10,
    transactionsPerMonth: 1_000,
    bankAccounts: 5,
    users: 1,
    bullets: [
      '5 bank accounts · 1,000 transactions / month',
      'Up to 10 projects / month · 1 team member',
      '14-day free trial',
      '50% off your first 2 months',
      'Bookkeeping consultancy / advisory',
      'Excel, CSV & PDF imports + OCR',
      'Pre-built regional bank statement layouts',
      'Auto-match suggestions + bulk confirm (up to 50)',
      'AI-assisted match ranking from confirmed pairs',
      'BRS export (Excel + PDF)',
      'Email support',
    ],
    features: {
      bank_accounts: '5',
      projects: '10 / month',
      transactions: '1,000 / month',
      users: '1',
      imports: true,
      ocr: true,
      bank_parsers: true,
      one_to_one: true,
      bulk_match: 'Up to 50 pairs',
      ai_suggestions: true,
      one_to_many: false,
      many_to_many: false,
      bank_rules: false,
      brs_export: true,
      discrepancy: false,
      audit_trail: false,
      roll_forward: false,
      threshold_approval: false,
      basic_branding: true,
      full_branding: false,
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
    name: 'Standard',
    tagline: 'For small teams and growing practices.',
    audience: 'Small finance team',
    badge: 'Most popular',
    highlight: true,
    monthlyGhs: 900,
    yearlyGhs: 9000,
    quarterlyGhs: 2565,
    projectsPerMonth: 30,
    transactionsPerMonth: 5_000,
    bankAccounts: 10,
    users: 3,
    inheritsFromLabel: 'Everything in Basic, plus:',
    bullets: [
      '10 bank accounts · 5,000 transactions / month',
      'Up to 30 projects / month · 3 team members',
      'Bulk match (up to 50 pairs)',
      'AI-powered match ranking',
      'Bank rules engine',
      'Discrepancy report & full audit trail',
      'Logo & full report branding on PDF exports',
    ],
    features: {
      bank_accounts: '10',
      projects: '30 / month',
      transactions: '5,000 / month',
      users: '3',
      imports: true,
      ocr: true,
      bank_parsers: true,
      one_to_one: true,
      bulk_match: 'Up to 50 pairs',
      ai_suggestions: true,
      one_to_many: false,
      many_to_many: false,
      bank_rules: true,
      brs_export: true,
      discrepancy: true,
      audit_trail: true,
      roll_forward: false,
      threshold_approval: false,
      basic_branding: true,
      full_branding: true,
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
    name: 'Premium',
    tagline: 'For firms reconciling at scale.',
    audience: 'Established firm',
    monthlyGhs: 1500,
    yearlyGhs: 15000,
    quarterlyGhs: 4275,
    projectsPerMonth: 100,
    transactionsPerMonth: 20_000,
    bankAccounts: 30,
    users: 5,
    inheritsFromLabel: 'Everything in Standard, plus:',
    bullets: [
      '30 bank accounts · 20,000 transactions / month',
      'Up to 100 projects / month · 5 team members',
      'One-to-many & many-to-many matches',
      'Roll forward across periods',
      'Threshold approval workflow',
      'Priority support',
    ],
    features: {
      bank_accounts: '30',
      projects: '100 / month',
      transactions: '20,000 / month',
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
      roll_forward: true,
      threshold_approval: true,
      basic_branding: true,
      full_branding: true,
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
    tagline: 'Unlimited seats for firms and enterprises.',
    audience: 'Accounting firm / enterprise',
    badge: 'Best for firms',
    monthlyGhs: 0,
    yearlyGhs: 0,
    quarterlyGhs: 0,
    projectsPerMonth: -1,
    transactionsPerMonth: -1,
    bankAccounts: -1,
    users: -1,
    inheritsFromLabel: 'Everything in Premium, plus:',
    bullets: [
      'Unlimited bank accounts, transactions & members',
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
    }
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
