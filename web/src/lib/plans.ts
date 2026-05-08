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
  /** -1 = unlimited */
  projectsPerMonth: number
  /** -1 = unlimited */
  transactionsPerMonth: number
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
      { id: 'projects', label: 'Projects per month' },
      { id: 'transactions', label: 'Transactions per month' },
      { id: 'users', label: 'Team members' },
    ],
  },
  {
    title: 'Document import',
    features: [
      { id: 'imports', label: 'Excel, CSV & PDF imports' },
      { id: 'ocr', label: 'OCR for scanned bank statements' },
      { id: 'bank_parsers', label: 'Ghana bank parsers (Ecobank, GCB, Access, Stanbic, Fidelity, Zenith, CalBank, ADB)' },
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
    title: 'Integrations',
    features: [
      { id: 'api_access', label: 'Public REST API access' },
    ],
  },
  {
    title: 'Support',
    features: [
      { id: 'email_support', label: 'Email support' },
      { id: 'priority_support', label: 'Priority support (4-hour SLA)' },
      { id: 'onboarding', label: 'Personalised onboarding' },
    ],
  },
]

/* -------------------------------------------------------------------------
 * Plan definitions (4 tiers)
 *
 * Pricing aligns with PLAN_PRICES in api/src/config/subscription.ts and the
 * tiers in PLANNING_DATA.json. Update both places when pricing changes.
 * ----------------------------------------------------------------------- */

export const MARKETING_PLANS: MarketingPlan[] = [
  {
    slug: 'basic',
    name: 'Basic',
    tagline: 'For solo accountants getting started.',
    audience: 'Solo practitioner',
    monthlyGhs: 150,
    yearlyGhs: 1500,
    projectsPerMonth: 5,
    transactionsPerMonth: 500,
    users: 1,
    bullets: [
      '5 projects · 500 transactions / month',
      '1 team member',
      'Excel, CSV & PDF imports + OCR',
      'Ghana bank statement parsers',
      'One-to-one auto-matching',
      'BRS export (Excel + PDF)',
      'Default report branding',
      'Email support',
    ],
    features: {
      projects: '5 / month',
      transactions: '500 / month',
      users: '1',
      imports: true,
      ocr: true,
      bank_parsers: true,
      one_to_one: true,
      bulk_match: false,
      ai_suggestions: false,
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
      onboarding: false,
    },
    ctaLabel: 'Start free trial',
    ctaHref: '/register',
  },
  {
    slug: 'standard',
    name: 'Standard',
    tagline: 'For small teams and growing practices.',
    audience: 'Small finance team',
    badge: 'Most popular',
    highlight: true,
    monthlyGhs: 400,
    yearlyGhs: 4000,
    projectsPerMonth: 20,
    transactionsPerMonth: 2000,
    users: 3,
    inheritsFromLabel: 'Everything in Basic, plus:',
    bullets: [
      '20 projects · 2,000 transactions / month',
      'Up to 3 team members',
      'Bulk match (up to 50 pairs)',
      'AI-powered match ranking',
      'Bank rules engine',
      'Discrepancy report',
      'Full audit trail',
      'Email support',
    ],
    features: {
      projects: '20 / month',
      transactions: '2,000 / month',
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
      full_branding: false,
      multi_client: false,
      api_access: false,
      email_support: true,
      priority_support: false,
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
    monthlyGhs: 900,
    yearlyGhs: 9000,
    projectsPerMonth: 100,
    transactionsPerMonth: 10000,
    users: 5,
    inheritsFromLabel: 'Everything in Standard, plus:',
    bullets: [
      '100 projects · 10,000 transactions / month',
      'Up to 5 team members',
      'One-to-many & many-to-many matches',
      'Roll forward across periods',
      'Threshold approval workflow',
      'Full branding (logo, colours, footer)',
      'Priority support',
    ],
    features: {
      projects: '100 / month',
      transactions: '10,000 / month',
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
      onboarding: false,
    },
    ctaLabel: 'Start free trial',
    ctaHref: '/register',
  },
  {
    slug: 'firm',
    name: 'Firm',
    tagline: 'For accounting firms and large practices.',
    audience: 'Accounting firm / enterprise',
    badge: 'Best for firms',
    monthlyGhs: 0,
    yearlyGhs: 0,
    projectsPerMonth: -1,
    transactionsPerMonth: -1,
    users: -1,
    inheritsFromLabel: 'Everything in Premium, plus:',
    bullets: [
      'Unlimited projects, transactions & members',
      'Multi-client workspace',
      'Public REST API access',
      'Personalised onboarding',
      'Priority support (4-hour SLA)',
      'Custom contract & billing',
    ],
    features: {
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
      onboarding: true,
    },
    ctaLabel: 'Contact sales',
    ctaHref: 'mailto:info@kqsoftwaresolutions.com?subject=KQ-SOFT%20Firm%20plan%20enquiry',
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
    projectsPerMonth: number
    transactionsPerMonth: number
  }> | undefined
): MarketingPlan[] {
  if (!apiPlans || apiPlans.length === 0) return MARKETING_PLANS
  const byId = new Map(apiPlans.map((p) => [p.id, p]))
  return MARKETING_PLANS.map((p) => {
    const live = byId.get(p.slug)
    if (!live) return p
    const merged: MarketingPlan = {
      ...p,
      monthlyGhs: live.monthlyGhs ?? p.monthlyGhs,
      yearlyGhs: live.yearlyGhs ?? p.yearlyGhs,
      projectsPerMonth: live.projectsPerMonth ?? p.projectsPerMonth,
      transactionsPerMonth: live.transactionsPerMonth ?? p.transactionsPerMonth,
    }
    // Sync feature-matrix limits so the comparison table reflects live values.
    merged.features = {
      ...p.features,
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
  if (!Number.isFinite(amount) || amount <= 0) return 'Custom'
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

export function planMonthlyEquivalent(plan: MarketingPlan, period: 'monthly' | 'yearly'): number {
  if (period === 'yearly') return plan.yearlyGhs / 12
  return plan.monthlyGhs
}
