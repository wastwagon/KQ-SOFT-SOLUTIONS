/**
 * Unified reconcile/report profile for Ghana BRS bank formats.
 * Same shape everywhere so Reconcile UI and training docs stay consistent.
 */
import { isGtBankEurScope } from './gtBankEurWorkbookSchedule.js'

export type BrsStyle = 'match_first' | 'schedule_first'

export type ReconcileProfilePayload = {
  bankFormat: string
  ghanaBrs: boolean
  brsStyle: BrsStyle
  clearingDateWindowDays: number
  /** Match-by-counting panel (Ecobank cancel/open schedules). */
  showCountMatch: boolean
  /** Bulk / phased auto-match buttons on Reconcile. */
  encourageAutoMatch: boolean
  /** Report uses workbook timing rules (not pair totals). */
  scheduleBrs: boolean
  workbookNetting?: boolean
  workbookNettingMode?: 'inherit' | 'on' | 'off' | 'working'
  workbookNettingSource?: 'query' | 'project' | 'org' | 'platform' | 'env' | 'off'
  workbookNettingDetail?: Record<string, unknown>
}

export type BuildReconcileProfileInput = {
  project: { currency?: string | null; name?: string | null }
  bankAccounts: { bankName?: string | null; name?: string | null; accountNo?: string | null }[]
  sampleBankText?: string
  ecobankActive: boolean
  ecobankClearingDateWindowDays?: number
  ecobankWorkbookNetting?: boolean
  workbookNettingMode?: 'inherit' | 'on' | 'off' | 'working'
  workbookNettingSource?: 'query' | 'project' | 'org' | 'platform' | 'env' | 'off'
  workbookNettingDetail?: Record<string, unknown>
  ghanaBankFormat: string | null
  defaultDateWindowDays?: number
}

export function buildReconcileProfile(input: BuildReconcileProfileInput): ReconcileProfilePayload | null {
  const {
    project,
    bankAccounts,
    sampleBankText,
    ecobankActive,
    ecobankClearingDateWindowDays = 7,
    ecobankWorkbookNetting = false,
    workbookNettingMode,
    workbookNettingSource,
    workbookNettingDetail,
    ghanaBankFormat,
    defaultDateWindowDays = 3,
  } = input

  if (ecobankActive) {
    return {
      bankFormat: 'ecobank',
      ghanaBrs: true,
      brsStyle: 'match_first',
      clearingDateWindowDays: ecobankClearingDateWindowDays,
      showCountMatch: true,
      encourageAutoMatch: true,
      scheduleBrs: ecobankWorkbookNetting,
      workbookNetting: ecobankWorkbookNetting,
      workbookNettingMode,
      workbookNettingSource,
      ...(workbookNettingDetail ? { workbookNettingDetail } : {}),
    }
  }

  const gtBankEur = isGtBankEurScope(project, bankAccounts, sampleBankText)
  if (gtBankEur.active) {
    return {
      bankFormat: 'gt_bank_eur',
      ghanaBrs: true,
      brsStyle: 'schedule_first',
      clearingDateWindowDays: defaultDateWindowDays,
      showCountMatch: false,
      encourageAutoMatch: false,
      scheduleBrs: true,
      workbookNetting: false,
    }
  }

  if (ghanaBankFormat) {
    return {
      bankFormat: ghanaBankFormat,
      ghanaBrs: true,
      brsStyle: 'match_first',
      clearingDateWindowDays: defaultDateWindowDays,
      showCountMatch: ghanaBankFormat === 'ecobank',
      encourageAutoMatch: true,
      scheduleBrs: false,
      workbookNetting: false,
    }
  }

  return null
}
