/**
 * Standard Chartered Bank (Ghana): internal SWEEP transfers, inward clearing, returns, withdrawals.
 */
import type { SuggestedMatch, Tx } from './matching.js'
import { bankAccountsForScope, type ScopedBankAccount } from './ecobankClearingMatcher.js'
import { isBankStatementNoiseLine, isEndOfStatementAmountLine } from './bankStatementImport.js'

const SWEEP_RE = /\bSWEEP\b/i
const INW_CLG_RE = /\bINW\s*CLG\b|INWARD\s+CLEARING|EXPRESS\s+INWARD/i
const CASH_WITHDRAWAL_RE = /\bCASH\s+WITHDRAWAL\b/i
const OT_REF_RE = /\bOT\s+REF\b/i
const RETURNED_CHEQUE_RE =
  /\b(?:RTNS|FAB\b|WRONG\s+AMOUNT|DRAWERS?\s+CONF|DRAWER'?S?\s+SIGNATURE\s+NOT)/i

export const SCB_BULK_SAFE_REASON_RE =
  /SCB sweep|SCB inward clearing|SCB returned cheque|SCB cash withdrawal|SCB transfer|SCB chq\/ref debit|ref shifted|via bank/i

const CHQ_DEP_RE = /\bCHQ\s+DEP\b/i
const CASH_WITHDRAWN_RE = /\bCASH\s+WITHDRAW/i

export function isScbPatternMatchReason(reason: string): boolean {
  return SCB_BULK_SAFE_REASON_RE.test(reason)
}

function txText(tx: Tx): string {
  return [tx.details, tx.name].filter(Boolean).join(' ')
}

function parseTxDate(tx: Tx): Date | null {
  if (!tx.date) return null
  if (tx.date instanceof Date) return tx.date
  const d = new Date(String(tx.date))
  return Number.isNaN(d.getTime()) ? null : d
}

function daysApart(a: Tx, b: Tx): number {
  const d1 = parseTxDate(a)
  const d2 = parseTxDate(b)
  if (!d1 || !d2) return Number.POSITIVE_INFINITY
  return Math.abs(d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24)
}

function amountsMatch(a: number, b: number, tolerance = 0.01): boolean {
  return Math.abs(a - b) <= tolerance
}

function isScbSweepLine(tx: Tx): boolean {
  return SWEEP_RE.test(txText(tx))
}

function isScbInwardClearingLine(tx: Tx): boolean {
  if (isBankStatementNoiseLine(tx) || isScbSweepLine(tx)) return false
  return INW_CLG_RE.test(txText(tx))
}

/** Block generic amount matches when both sides are INW CLG with different refs. */
export function scbClearingRefsConflict(cb: Tx, bk: Tx): boolean {
  if (!isScbInwardClearingLine(cb) && !isScbInwardClearingLine(bk)) return false
  const cbRef = extractScbClearingRef(cb)
  const bkRef = extractScbClearingRef(bk)
  if (!cbRef || !bkRef) return false
  return normalizeRefToken(cbRef) !== normalizeRefToken(bkRef)
}

function isReturnedChequeLine(tx: Tx): boolean {
  return RETURNED_CHEQUE_RE.test(txText(tx))
}

function normalizeRefToken(value: string | null | undefined): string {
  if (!value) return ''
  const digits = String(value).replace(/\D/g, '')
  if (digits) return digits.replace(/^0+/, '') || '0'
  return String(value).trim().toLowerCase()
}

/** Extract cheque / clearing reference from description (INW CLG 680347, CHQ # 484623). */
export function extractScbClearingRef(tx: Tx): string | null {
  const text = [tx.details, tx.name, tx.chqNo].filter(Boolean).join(' ')
  const lead = text.match(/^0*(\d{6,12})\s/)
  if (lead) return lead[1]!
  const m =
    text.match(/\bINW\s*CLG\s*(\d{5,8})\b/i) ||
    text.match(/\bCHQ#?\s*(\d{5,8})\b/i) ||
    text.match(/\bCHQ\s+NO\.?\s*(\d{5,8})\b/i) ||
    text.match(/\bCHQ\s*#\s*(\d{5,8})\b/i)
  return m ? m[1]! : tx.chqNo?.trim() || null
}

/** OT REF OT00201908090041 style transfer reference. */
export function extractScbOtRef(tx: Tx): string | null {
  const text = txText(tx)
  const m = text.match(/\bOT\s*REF\s*(OT\d+)\b/i)
  return m ? m[1]!.toUpperCase() : null
}

export function resolveScbProfile(opts: {
  bankAccounts?: ScopedBankAccount[]
  bankAccountId?: string
  sampleBankText?: string
}): { active: boolean } {
  const names = bankAccountsForScope(opts.bankAccounts, opts.bankAccountId)
    .flatMap((a) => [a.name, a.bankName])
    .filter(Boolean)
    .join(' ')
  const text = [names, opts.sampleBankText || ''].join(' ')
  const active =
    /standard\s*chartered|\bscb\b/i.test(text) ||
    /\bSWEEP\s+(?:FROM|TO)\b/i.test(opts.sampleBankText || '')
  return { active }
}

function dedupeSuggestions(suggestions: SuggestedMatch[]): SuggestedMatch[] {
  const byCb = new Map<string, SuggestedMatch>()
  for (const s of suggestions) {
    const prev = byCb.get(s.cashBookTx.id)
    if (!prev || s.confidence > prev.confidence) byCb.set(s.cashBookTx.id, s)
  }
  const byBank = new Map<string, SuggestedMatch>()
  for (const s of byCb.values()) {
    const prev = byBank.get(s.bankTx.id)
    if (!prev || s.confidence > prev.confidence) byBank.set(s.bankTx.id, s)
  }
  return Array.from(byBank.values()).sort((a, b) => b.confidence - a.confidence)
}

function pickUniqueCandidate(
  cb: Tx,
  candidates: Tx[],
  refExtractor: (tx: Tx) => string | null = extractScbClearingRef
): Tx | null {
  if (!candidates.length) return null
  if (candidates.length === 1) return candidates[0]!

  const cbRef = refExtractor(cb)
  if (cbRef) {
    const byRef = candidates.filter((bk) => {
      const bkRef = refExtractor(bk)
      return bkRef && normalizeRefToken(bkRef) === normalizeRefToken(cbRef)
    })
    if (byRef.length === 1) return byRef[0]!
    if (byRef.length > 1) {
      return [...byRef].sort((a, b) => daysApart(cb, a) - daysApart(cb, b))[0]!
    }
  }

  const byDate = [...candidates].sort((a, b) => daysApart(cb, a) - daysApart(cb, b))
  if (daysApart(cb, byDate[0]!) <= 7) return byDate[0]!
  return null
}

/** Receipt ↔ credit for linked-account SWEEP lines (amount + SWEEP text; date ignored). */
export function suggestScbSweepMatches(
  receipts: Tx[],
  credits: Tx[],
  matchedCashBookIds: Set<string>,
  matchedBankIds: Set<string>,
  amountTolerance = 0.01
): SuggestedMatch[] {
  const suggestions: SuggestedMatch[] = []
  for (const cb of receipts) {
    if (matchedCashBookIds.has(cb.id)) continue
    if (!isScbSweepLine(cb)) continue
    for (const bk of credits) {
      if (matchedBankIds.has(bk.id)) continue
      if (!isScbSweepLine(bk)) continue
      if (!amountsMatch(cb.amount, bk.amount, amountTolerance)) continue
      suggestions.push({
        cashBookTx: cb,
        bankTx: bk,
        confidence: 0.93,
        reason: 'SCB sweep: amount + SWEEP description',
      })
    }
  }
  return dedupeSuggestions(suggestions)
}

/** Receipt ↔ credit for returned / wrong-amount cheque reversals (FAB RTNS, etc.). */
export function suggestScbReturnedChequeCreditMatches(
  receipts: Tx[],
  credits: Tx[],
  matchedCashBookIds: Set<string>,
  matchedBankIds: Set<string>,
  amountTolerance = 0.01
): SuggestedMatch[] {
  const suggestions: SuggestedMatch[] = []
  for (const cb of receipts) {
    if (matchedCashBookIds.has(cb.id)) continue
    if (!isReturnedChequeLine(cb)) continue
    const cbRef = extractScbClearingRef(cb)
    const candidates = credits.filter(
      (bk) =>
        !matchedBankIds.has(bk.id) &&
        isReturnedChequeLine(bk) &&
        amountsMatch(cb.amount, bk.amount, amountTolerance)
    )
    const picked = pickUniqueCandidate(cb, candidates, extractScbClearingRef)
    if (!picked) continue
    if (cbRef && extractScbClearingRef(picked) && normalizeRefToken(cbRef) !== normalizeRefToken(extractScbClearingRef(picked))) {
      continue
    }
    suggestions.push({
      cashBookTx: cb,
      bankTx: picked,
      confidence: 0.92,
      reason: 'SCB returned cheque: chq/ref + amount',
    })
  }
  return dedupeSuggestions(suggestions)
}

/** Payment ↔ debit for INW CLG / inward clearing (chq/ref + closest date). */
export function suggestScbInwardClearingDebitMatches(
  payments: Tx[],
  debits: Tx[],
  matchedCashBookIds: Set<string>,
  matchedBankIds: Set<string>,
  amountTolerance = 0.01
): SuggestedMatch[] {
  const suggestions: SuggestedMatch[] = []
  for (const cb of payments) {
    if (matchedCashBookIds.has(cb.id)) continue
    if (!isScbInwardClearingLine(cb)) continue
    const cbRef = extractScbClearingRef(cb)
    const candidates = debits.filter(
      (bk) =>
        !matchedBankIds.has(bk.id) &&
        isScbInwardClearingLine(bk) &&
        amountsMatch(cb.amount, bk.amount, amountTolerance)
    )
    if (!candidates.length) continue

    let picked: Tx | null = null
    if (cbRef) {
      const byRef = candidates.filter(
        (bk) => normalizeRefToken(extractScbClearingRef(bk)) === normalizeRefToken(cbRef)
      )
      if (byRef.length === 1) picked = byRef[0]!
      else if (byRef.length > 1) {
        picked = [...byRef].sort((a, b) => daysApart(cb, a) - daysApart(cb, b))[0]!
      }
    } else if (candidates.length === 1) {
      picked = candidates[0]!
    }

    if (!picked) continue
    suggestions.push({
      cashBookTx: cb,
      bankTx: picked,
      confidence: 0.91,
      reason: 'SCB inward clearing: chq/ref + amount',
    })
  }
  return dedupeSuggestions(suggestions)
}

function hasSameRefInwardAmountMatch(
  cb: Tx,
  debits: Tx[],
  matchedBankIds: Set<string>,
  amountTolerance: number
): boolean {
  const cbRef = extractScbClearingRef(cb)
  if (!cbRef) return false
  return debits.some(
    (bk) =>
      !matchedBankIds.has(bk.id) &&
      isScbInwardClearingLine(bk) &&
      normalizeRefToken(extractScbClearingRef(bk)) === normalizeRefToken(cbRef) &&
      amountsMatch(cb.amount, bk.amount, amountTolerance)
  )
}

/**
 * SCB exports sometimes shift INW CLG cheque numbers while keeping the debit amount.
 * Pair unmatched INW CLG lines when the amount is unique on both sides.
 */
export function suggestScbInwardClearingAmountUniqueMatches(
  payments: Tx[],
  debits: Tx[],
  matchedCashBookIds: Set<string>,
  matchedBankIds: Set<string>,
  amountTolerance = 0.01
): SuggestedMatch[] {
  const unmatchedPay = payments.filter(
    (p) => !matchedCashBookIds.has(p.id) && isScbInwardClearingLine(p)
  )
  const unmatchedDeb = debits.filter(
    (d) => !matchedBankIds.has(d.id) && isScbInwardClearingLine(d)
  )
  const debByAmt = new Map<string, Tx[]>()
  for (const d of unmatchedDeb) {
    const key = d.amount.toFixed(2)
    if (!debByAmt.has(key)) debByAmt.set(key, [])
    debByAmt.get(key)!.push(d)
  }
  const payByAmt = new Map<string, Tx[]>()
  for (const p of unmatchedPay) {
    const key = p.amount.toFixed(2)
    if (!payByAmt.has(key)) payByAmt.set(key, [])
    payByAmt.get(key)!.push(p)
  }

  const suggestions: SuggestedMatch[] = []
  for (const cb of unmatchedPay) {
    if (hasSameRefInwardAmountMatch(cb, debits, matchedBankIds, amountTolerance)) continue
    const key = cb.amount.toFixed(2)
    if ((payByAmt.get(key)?.length ?? 0) !== 1) continue
    const debCandidates = debByAmt.get(key) ?? []
    if (debCandidates.length !== 1) continue
    const bk = debCandidates[0]!
    const cbRef = extractScbClearingRef(cb)
    const bkRef = extractScbClearingRef(bk)
    if (cbRef && bkRef && normalizeRefToken(cbRef) === normalizeRefToken(bkRef)) continue
    suggestions.push({
      cashBookTx: cb,
      bankTx: bk,
      confidence: 0.87,
      reason: 'SCB inward clearing: unique amount (ref shifted)',
    })
  }
  return dedupeSuggestions(suggestions)
}

/**
 * Iteratively pair INW CLG lines where amount matches but cheque ref shifted (handles rotation cycles).
 */
export function suggestScbInwardClearingCrossRefMatches(
  payments: Tx[],
  debits: Tx[],
  matchedCashBookIds: Set<string>,
  matchedBankIds: Set<string>,
  amountTolerance = 0.01
): SuggestedMatch[] {
  const usedCb = new Set(matchedCashBookIds)
  const usedBank = new Set(matchedBankIds)
  const all: SuggestedMatch[] = []

  for (let pass = 0; pass < 64; pass++) {
    const batch = suggestScbInwardClearingAmountUniqueMatches(
      payments,
      debits,
      usedCb,
      usedBank,
      amountTolerance
    )
    if (!batch.length) break
    for (const s of batch) {
      all.push(s)
      usedCb.add(s.cashBookTx.id)
      usedBank.add(s.bankTx.id)
    }
  }

  return all
}

/** Cash-book payment ↔ INW CLG bank debit when refs differ but amount is unique (orphan withdrawals). */
export function suggestScbWithdrawnToInwClgMatches(
  payments: Tx[],
  debits: Tx[],
  matchedCashBookIds: Set<string>,
  matchedBankIds: Set<string>,
  amountTolerance = 0.01
): SuggestedMatch[] {
  const suggestions: SuggestedMatch[] = []
  for (const cb of payments) {
    if (matchedCashBookIds.has(cb.id)) continue
    if (isScbInwardClearingLine(cb)) continue
    const text = txText(cb)
    if (!CASH_WITHDRAWN_RE.test(text) && !CASH_WITHDRAWAL_RE.test(text)) continue
    const candidates = debits.filter(
      (bk) =>
        !matchedBankIds.has(bk.id) &&
        isScbInwardClearingLine(bk) &&
        amountsMatch(cb.amount, bk.amount, amountTolerance)
    )
    if (candidates.length !== 1) continue
    suggestions.push({
      cashBookTx: cb,
      bankTx: candidates[0]!,
      confidence: 0.86,
      reason: 'SCB inward clearing: unique amount via bank withdrawal line',
    })
  }
  return dedupeSuggestions(suggestions)
}

/** Cash-book INW CLG that clears via CHQ DEP or CASH WITHDRAWN on the bank (unique amount). */
export function suggestScbInwardClearingAlternateDebitMatches(
  payments: Tx[],
  debits: Tx[],
  matchedCashBookIds: Set<string>,
  matchedBankIds: Set<string>,
  amountTolerance = 0.01
): SuggestedMatch[] {
  const suggestions: SuggestedMatch[] = []
  for (const cb of payments) {
    if (matchedCashBookIds.has(cb.id)) continue
    if (!isScbInwardClearingLine(cb)) continue
    if (hasSameRefInwardAmountMatch(cb, debits, matchedBankIds, amountTolerance)) continue
    const candidates = debits.filter(
      (bk) =>
        !matchedBankIds.has(bk.id) &&
        !isBankStatementNoiseLine(bk) &&
        !isScbSweepLine(bk) &&
        !isScbInwardClearingLine(bk) &&
        (CHQ_DEP_RE.test(txText(bk)) || CASH_WITHDRAWN_RE.test(txText(bk))) &&
        amountsMatch(cb.amount, bk.amount, amountTolerance)
    )
    if (candidates.length !== 1) continue
    const kind = CHQ_DEP_RE.test(txText(candidates[0]!)) ? 'CHQ deposit' : 'cash withdrawal'
    suggestions.push({
      cashBookTx: cb,
      bankTx: candidates[0]!,
      confidence: 0.86,
      reason: `SCB inward clearing: unique amount via bank ${kind}`,
    })
  }
  return dedupeSuggestions(suggestions)
}

/** Cash INW CLG ↔ bank END OF STATEMENT line when SCB parks the clearing total on a footer row. */
export function suggestScbInwardClearingFooterAmountMatches(
  payments: Tx[],
  debits: Tx[],
  matchedCashBookIds: Set<string>,
  matchedBankIds: Set<string>,
  amountTolerance = 0.01
): SuggestedMatch[] {
  const suggestions: SuggestedMatch[] = []
  for (const cb of payments) {
    if (matchedCashBookIds.has(cb.id)) continue
    if (!isScbInwardClearingLine(cb)) continue
    if (hasSameRefInwardAmountMatch(cb, debits, matchedBankIds, amountTolerance)) continue
    const candidates = debits.filter(
      (bk) =>
        !matchedBankIds.has(bk.id) &&
        isEndOfStatementAmountLine(bk) &&
        amountsMatch(cb.amount, bk.amount, amountTolerance)
    )
    if (candidates.length !== 1) continue
    suggestions.push({
      cashBookTx: cb,
      bankTx: candidates[0]!,
      confidence: 0.85,
      reason: 'SCB inward clearing: unique amount via bank statement footer',
    })
  }
  return dedupeSuggestions(suggestions)
}

/** Payment ↔ debit when chq/ref appears in both descriptions (SCB multi-bank cheques, etc.). */
export function suggestScbChqRefDebitMatches(
  payments: Tx[],
  debits: Tx[],
  matchedCashBookIds: Set<string>,
  matchedBankIds: Set<string>,
  amountTolerance = 0.01
): SuggestedMatch[] {
  const suggestions: SuggestedMatch[] = []
  for (const cb of payments) {
    if (matchedCashBookIds.has(cb.id)) continue
    if (
      isScbInwardClearingLine(cb) ||
      isScbSweepLine(cb) ||
      OT_REF_RE.test(txText(cb)) ||
      CASH_WITHDRAWAL_RE.test(txText(cb))
    ) {
      continue
    }
    const cbRef = extractScbClearingRef(cb)
    if (!cbRef) continue
    const candidates = debits.filter(
      (bk) =>
        !matchedBankIds.has(bk.id) &&
        !isBankStatementNoiseLine(bk) &&
        !isScbSweepLine(bk) &&
        !isScbInwardClearingLine(bk) &&
        amountsMatch(cb.amount, bk.amount, amountTolerance) &&
        normalizeRefToken(extractScbClearingRef(bk)) === normalizeRefToken(cbRef)
    )
    const picked = pickUniqueCandidate(cb, candidates)
    if (!picked) continue
    suggestions.push({
      cashBookTx: cb,
      bankTx: picked,
      confidence: 0.89,
      reason: 'SCB chq/ref debit: chq + amount',
    })
  }
  return dedupeSuggestions(suggestions)
}

/** Payment ↔ debit for CASH WITHDRAWAL lines (chq in description; wide date tolerance). */
export function suggestScbCashWithdrawalMatches(
  payments: Tx[],
  debits: Tx[],
  matchedCashBookIds: Set<string>,
  matchedBankIds: Set<string>,
  amountTolerance = 0.01
): SuggestedMatch[] {
  const suggestions: SuggestedMatch[] = []
  for (const cb of payments) {
    if (matchedCashBookIds.has(cb.id)) continue
    if (!CASH_WITHDRAWAL_RE.test(txText(cb))) continue
    const cbRef = extractScbClearingRef(cb)
    if (!cbRef) continue
    const candidates = debits.filter(
      (bk) =>
        !matchedBankIds.has(bk.id) &&
        CASH_WITHDRAWAL_RE.test(txText(bk)) &&
        amountsMatch(cb.amount, bk.amount, amountTolerance)
    )
    const picked = pickUniqueCandidate(cb, candidates)
    if (!picked) continue
    suggestions.push({
      cashBookTx: cb,
      bankTx: picked,
      confidence: 0.9,
      reason: 'SCB cash withdrawal: chq/ref + amount',
    })
  }
  return dedupeSuggestions(suggestions)
}

/** Payment ↔ debit for OT REF transfers (same OT reference token). */
export function suggestScbOtRefMatches(
  payments: Tx[],
  debits: Tx[],
  matchedCashBookIds: Set<string>,
  matchedBankIds: Set<string>,
  amountTolerance = 0.01
): SuggestedMatch[] {
  const suggestions: SuggestedMatch[] = []
  for (const cb of payments) {
    if (matchedCashBookIds.has(cb.id)) continue
    if (!OT_REF_RE.test(txText(cb))) continue
    const cbRef = extractScbOtRef(cb)
    if (!cbRef) continue
    const candidates = debits.filter(
      (bk) =>
        !matchedBankIds.has(bk.id) &&
        OT_REF_RE.test(txText(bk)) &&
        amountsMatch(cb.amount, bk.amount, amountTolerance) &&
        extractScbOtRef(bk) === cbRef
    )
    if (candidates.length !== 1) continue
    suggestions.push({
      cashBookTx: cb,
      bankTx: candidates[0]!,
      confidence: 0.9,
      reason: 'SCB transfer: OT ref + amount',
    })
  }
  return dedupeSuggestions(suggestions)
}

export function mergeReceiptSuggestions(
  ...lists: SuggestedMatch[][]
): SuggestedMatch[] {
  const seenCb = new Set<string>()
  const seenBank = new Set<string>()
  const out: SuggestedMatch[] = []
  for (const list of lists) {
    for (const s of list) {
      if (seenCb.has(s.cashBookTx.id) || seenBank.has(s.bankTx.id)) continue
      seenCb.add(s.cashBookTx.id)
      seenBank.add(s.bankTx.id)
      out.push(s)
    }
  }
  return out.sort((a, b) => b.confidence - a.confidence)
}

export function mergeScbPaymentSuggestions(
  ...lists: SuggestedMatch[][]
): SuggestedMatch[] {
  return mergeReceiptSuggestions(...lists)
}
