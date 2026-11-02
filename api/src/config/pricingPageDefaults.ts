/**
 * Default landing-page comparison table (CMS can override via PlatformSettings).
 */

export type PricingFeatureRow = {
  id: string
  label: string
  hint?: string
}

export type PricingFeatureGroup = {
  title: string
  features: PricingFeatureRow[]
}

export type PricingPageConfig = {
  featureGroups: PricingFeatureGroup[]
  /** Extra workspace feature flags editable per plan (beyond built-in catalogue). */
  extraFeatureCatalog: { id: string; label: string; hint: string }[]
}

export const DEFAULT_PRICING_PAGE: PricingPageConfig = {
  featureGroups: [
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
        { id: 'discrepancy', label: 'Discrepancy report (date/amount variances)' },
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
  ],
  extraFeatureCatalog: [],
}
