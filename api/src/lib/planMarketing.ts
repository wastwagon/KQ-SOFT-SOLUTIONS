import {
  defaultMarketingForSlug,
  type PlanMarketing,
} from '../config/planMarketingDefaults.js'
import type { PlanFeature } from '../config/planFeatures.js'

export type { PlanMarketing }

export function parseStoredMarketing(raw: unknown, slug: string): PlanMarketing {
  const base = defaultMarketingForSlug(slug)
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  return {
    tagline: typeof o.tagline === 'string' ? o.tagline : base.tagline,
    audience: typeof o.audience === 'string' ? o.audience : base.audience,
    badge: o.badge === null || typeof o.badge === 'string' ? (o.badge as string | null) : base.badge,
    highlight: typeof o.highlight === 'boolean' ? o.highlight : base.highlight,
    bullets: Array.isArray(o.bullets)
      ? o.bullets.filter((b): b is string => typeof b === 'string')
      : base.bullets,
    inheritsFromLabel:
      o.inheritsFromLabel === null || typeof o.inheritsFromLabel === 'string'
        ? (o.inheritsFromLabel as string | null)
        : base.inheritsFromLabel,
    ctaLabel: typeof o.ctaLabel === 'string' ? o.ctaLabel : base.ctaLabel,
    ctaHref: typeof o.ctaHref === 'string' ? o.ctaHref : base.ctaHref,
    featureMatrix: {
      ...base.featureMatrix,
      ...(typeof o.featureMatrix === 'object' && o.featureMatrix
        ? (o.featureMatrix as Record<string, boolean | string>)
        : {}),
    },
  }
}

function fmtQuota(n: number, suffix: string): string {
  if (n < 0) return 'Unlimited'
  return `${n.toLocaleString('en-GH')}${suffix}`
}

/** Keep comparison-table limit rows aligned with CMS quotas. */
export function applyQuotaToMarketingMatrix(
  marketing: PlanMarketing,
  quotas: {
    bankAccounts: number
    projectsPerMonth: number
    transactionsPerMonth: number
    usersLimit: number
  }
): PlanMarketing {
  const featureMatrix = { ...marketing.featureMatrix }
  featureMatrix.bank_accounts =
    quotas.bankAccounts < 0 ? 'Unlimited' : String(quotas.bankAccounts)
  featureMatrix.projects = fmtQuota(quotas.projectsPerMonth, ' / month')
  featureMatrix.transactions = fmtQuota(quotas.transactionsPerMonth, ' / month')
  featureMatrix.users = quotas.usersLimit < 0 ? 'Unlimited' : String(quotas.usersLimit)
  return { ...marketing, featureMatrix }
}

const FEATURE_ALIAS: Record<string, string> = {
  discrepancy_report: 'discrepancy',
  missing_cheques_report: 'missing_cheques',
}

/** Reflect boolean plan features in the comparison matrix. */
export function applyFeatureFlagsToMarketingMatrix(
  marketing: PlanMarketing,
  features: Record<string, boolean>
): PlanMarketing {
  const featureMatrix = { ...marketing.featureMatrix }
  for (const [key, value] of Object.entries(features)) {
    const target = FEATURE_ALIAS[key] ?? key
    if (!(target in featureMatrix)) continue
    const current = featureMatrix[target]
    if (value === false) featureMatrix[target] = false
    else if (current === false) featureMatrix[target] = true
  }
  return { ...marketing, featureMatrix }
}

export function suggestTaglineFromQuotas(quotas: {
  bankAccounts: number
  projectsPerMonth: number
  transactionsPerMonth: number
  usersLimit: number
}): string {
  const banks = quotas.bankAccounts < 0 ? 'unlimited bank accounts' : `${quotas.bankAccounts} bank account${quotas.bankAccounts === 1 ? '' : 's'}`
  const tx =
    quotas.transactionsPerMonth < 0
      ? 'unlimited transactions'
      : `${quotas.transactionsPerMonth.toLocaleString('en-GH')} transactions`
  const projects =
    quotas.projectsPerMonth < 0
      ? 'unlimited projects'
      : `${quotas.projectsPerMonth} project${quotas.projectsPerMonth === 1 ? '' : 's'}`
  const people =
    quotas.usersLimit < 0
      ? 'unlimited team members'
      : quotas.usersLimit === 1
        ? '1 person'
        : `${quotas.usersLimit} people`
  if (quotas.usersLimit === 1) {
    return `${people}, ${banks}, and ${tx} a month.`
  }
  return `${people}, ${banks}, ${tx}, and ${projects} a month.`
}
