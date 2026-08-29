import type { SuggestedMatch, Tx } from './matching.js'
import { extractScbClearingRef, extractScbOtRef } from './scbSweepMatcher.js'

function normalizeRef(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits) return digits.replace(/^0+/, '') || '0'
  return value.trim().toUpperCase()
}

/** Best-effort clearing / transfer reference for corroborated duplicate clearing. */
export function suggestionClearingRef(tx: Tx): string | null {
  const ot = extractScbOtRef(tx)
  if (ot) return ot.toUpperCase()
  const clg = extractScbClearingRef(tx)
  if (clg) return normalizeRef(clg)
  return tx.chqNo?.trim() ? normalizeRef(tx.chqNo.trim()) : null
}

/** Flag when multiple suggestions share the same cash-book or bank transaction. */
export function applyDuplicateWarnings(suggestions: SuggestedMatch[]): void {
  const byCbId = new Map<string, SuggestedMatch[]>()
  const byBankId = new Map<string, SuggestedMatch[]>()
  for (const s of suggestions) {
    const cbKey = s.cashBookTx.id
    if (!byCbId.has(cbKey)) byCbId.set(cbKey, [])
    byCbId.get(cbKey)!.push(s)

    const bkKey = s.bankTx.id
    if (!byBankId.has(bkKey)) byBankId.set(bkKey, [])
    byBankId.get(bkKey)!.push(s)
  }
  for (const list of byCbId.values()) {
    if (list.length > 1) {
      for (const s of list) s.duplicateWarning = true
    }
  }
  for (const list of byBankId.values()) {
    if (list.length > 1) {
      for (const s of list) s.duplicateWarning = true
    }
  }
}

/**
 * When duplicateWarning is set but both sides share the same clearing ref (INW CLG, CHQ #, OT REF),
 * allow safe auto-match — same rule used by integration scripts for SCB/TGL books.
 */
export function clearCorroboratedDuplicateWarnings(suggestions: SuggestedMatch[], minConfidence = 0.88): void {
  for (const s of suggestions) {
    if (!s.duplicateWarning || s.confidence < minConfidence) continue
    const refA = suggestionClearingRef(s.cashBookTx)
    const refB = suggestionClearingRef(s.bankTx)
    if (refA && refB && refA === refB) {
      s.duplicateWarning = false
    }
  }
}
