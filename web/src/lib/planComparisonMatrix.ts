import { FEATURE_GROUPS, type FeatureRow } from './plans'

/** Comparison rows synced from numeric plan quotas at serve time — not edited here. */
export const QUOTA_DRIVEN_MATRIX_IDS = new Set(['bank_accounts', 'transactions', 'projects', 'users'])

export function allComparisonFeatureRows(): FeatureRow[] {
  return FEATURE_GROUPS.flatMap((g) => g.features)
}

export function quotaMatrixPreview(
  id: string,
  quotas: {
    bankAccounts: number
    projectsPerMonth: number
    transactionsPerMonth: number
    usersLimit: number
  }
): string {
  switch (id) {
    case 'bank_accounts':
      return quotas.bankAccounts < 0 ? 'Unlimited' : String(quotas.bankAccounts)
    case 'projects':
      return quotas.projectsPerMonth < 0
        ? 'Unlimited'
        : `${quotas.projectsPerMonth.toLocaleString('en-GH')} / month`
    case 'transactions':
      return quotas.transactionsPerMonth < 0
        ? 'Unlimited'
        : `${quotas.transactionsPerMonth.toLocaleString('en-GH')} / month`
    case 'users':
      return quotas.usersLimit < 0 ? 'Unlimited' : String(quotas.usersLimit)
    default:
      return ''
  }
}

export type MatrixCellMode = 'included' | 'excluded' | 'custom'

export function matrixCellMode(value: boolean | string | undefined): MatrixCellMode {
  if (value === true) return 'included'
  if (value === false) return 'excluded'
  if (typeof value === 'string' && value.length > 0) return 'custom'
  return 'included'
}

export function matrixCellFromMode(mode: MatrixCellMode, customText: string): boolean | string {
  if (mode === 'included') return true
  if (mode === 'excluded') return false
  return customText.trim() || '—'
}
