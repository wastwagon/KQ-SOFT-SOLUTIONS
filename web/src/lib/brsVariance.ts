import type { ReportResponse } from './api'

/** Signed variance between computed BRS bank balance and stated bank closing (0 = tied out). */
export function brsTieOutVariance(report: Pick<ReportResponse, 'brsStatement'> | null | undefined): number | null {
  const s = report?.brsStatement
  if (!s) return null
  if (
    typeof s.workbookScheduleTieOutVariance === 'number' &&
    Number.isFinite(s.workbookScheduleTieOutVariance)
  ) {
    return s.workbookScheduleTieOutVariance
  }
  const computed = s.bankClosingBalanceGhanaStyle ?? s.bankClosingBalance
  const stated = s.bankStatementClosingBalance
  if (computed == null || stated == null || !Number.isFinite(computed) || !Number.isFinite(stated)) {
    return null
  }
  return Math.round((computed - stated) * 100) / 100
}

export function brsVarianceLabel(variance: number | null): string | null {
  if (variance == null) return null
  if (Math.abs(variance) < 0.01) return 'Tied out'
  return variance > 0 ? 'Over' : 'Under'
}
