/**
 * Ghana Ecobank BRS: cash-book cheque payments often clear via bank CREDIT lines
 * (inward clearing, HSE cheque deposit) — not bank debits.
 */
import type { SuggestedMatch, SuggestMatchesOptions, Tx } from './matching.js'

/** Minimal tx shape for BRS clearing logic (report routes may use string dates). */
export type ClearingTxLike = {
  id: string
  amount: number
  chqNo?: string | null
  details?: string | null
  name?: string | null
  date?: Date | string | null
  docRef?: string | null
}

/** Bank credit lines that pair with cash-book cheque payments. */
export const ECOBANK_CLEARING_CREDIT_RE =
  /CHEQUE\s+CLEARING\s*-\s*INWARD|CHEQUE\s+DEPOSIT\s*-\s*HSE|CHEQUE\s+DEPOSIT(?!\s+-\s*HSE)/i

const CHEQUE_REF_RE =
  /\b(?:CHQ|Cheque|REF|Ref)(?:\s*(?:No|NO|no)\.?)?\s*[#:.]?\s*(\d{2,10})(?=[A-Z]|\b|$)/gi
const TRANSFER_DEBIT_RE = /FUNDS\s+TRANSFER|OUTWARD\s*-\s*LOCAL|NRT\s+BO/i
const FT_CONSOLIDATION_RE = /FT\s+Consolidation|PAYROLL\s+UPLOAD/i
const WITHDRAWAL_DEBIT_RE = /CHEQUE\s+WITHDRAWAL|WITHDRAWAL/i

/** Bulk-match tier B: only auto-apply payment suggestions with these reasons (not generic chq↔debit). */
export const ECOBANK_BULK_SAFE_REASON_RE =
  /Ecobank clearing|Ecobank transfer|Ecobank withdrawal/i

export function isEcobankPatternMatchReason(reason: string): boolean {
  return ECOBANK_BULK_SAFE_REASON_RE.test(reason)
}

export interface EcobankGhanaProfile {
  active: boolean
  label: string
  clearingDateWindowDays: number
}

export function resolveEcobankGhanaProfile(opts: {
  bankAccounts?: { name?: string | null; bankName?: string | null }[]
  sampleBankText?: string
}): EcobankGhanaProfile {
  const names = (opts.bankAccounts || []).flatMap((a) => [a.name, a.bankName].filter(Boolean))
  const text = [...names, opts.sampleBankText || ''].join(' ')
  const active =
    /ecobank/i.test(text) ||
    /CHEQUE\s+CLEARING\s*-\s*INWARD|CHEQUE\s+DEPOSIT\s*-\s*HSE/i.test(opts.sampleBankText || '')
  return {
    active,
    label: 'Ecobank Ghana BRS',
    clearingDateWindowDays: 14,
  }
}

function normalizeRefToken(value: string | null | undefined): string {
  if (!value) return ''
  const digits = String(value).trim().replace(/\D/g, '')
  if (digits) return digits.replace(/^0+/, '') || '0'
  return String(value).trim().toLowerCase()
}

function padChqRef(value: string | null | undefined): string {
  const digits = String(value || '').replace(/\D/g, '')
  return digits ? digits.padStart(6, '0') : ''
}

function refTokensEquivalent(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeRefToken(a)
  const nb = normalizeRefToken(b)
  if (!na || !nb) return false
  if (na === nb) return true
  const pa = padChqRef(a)
  const pb = padChqRef(b)
  if (pa && pb && pa === pb) return true
  if (pa.length >= 4 && pb.length >= 2 && (pa.endsWith(pb) || pb.endsWith(pa))) return true
  if (na.length >= 3 && nb.length >= 3 && (na.endsWith(nb) || nb.endsWith(na))) return true
  return false
}

function extractRefsFromText(text: string | null | undefined): string[] {
  if (!text) return []
  const refs = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = CHEQUE_REF_RE.exec(text)) !== null) refs.add(m[1]!)
  CHEQUE_REF_RE.lastIndex = 0
  const standaloneRe = /\b(\d{4,8})\b/g
  while ((m = standaloneRe.exec(text)) !== null) refs.add(m[1]!)
  return Array.from(refs)
}

function bankText(tx: ClearingTxLike): string {
  return [tx.details, tx.name].filter(Boolean).join(' ')
}

export function isEcobankClearingCredit(tx: { details?: string | null; name?: string | null }): boolean {
  const text = [tx.details, tx.name].filter(Boolean).join(' ')
  return ECOBANK_CLEARING_CREDIT_RE.test(text)
}

export function chequeOrRefLink(left: ClearingTxLike, right: ClearingTxLike): boolean {
  const leftChq = left.chqNo?.trim()
  const rightChq = right.chqNo?.trim()
  if (refTokensEquivalent(leftChq, rightChq)) return true
  const rightText = bankText(right)
  const leftText = [left.details, left.name].filter(Boolean).join(' ')
  const rightRefs = extractRefsFromText(rightText)
  const leftRefs = extractRefsFromText(leftText)
  if (leftChq) {
    const leftPadded = padChqRef(leftChq)
    if (rightRefs.some((r) => refTokensEquivalent(r, leftChq))) return true
    if (rightText.includes(leftChq) || (leftPadded && rightText.includes(leftPadded))) return true
    if (leftPadded && rightRefs.some((r) => leftPadded.endsWith(padChqRef(r)))) return true
  }
  if (rightChq) {
    const rightPadded = padChqRef(rightChq)
    if (leftRefs.some((r) => refTokensEquivalent(r, rightChq))) return true
    if (leftText.includes(rightChq) || (rightPadded && leftText.includes(rightPadded))) return true
    if (rightPadded && leftRefs.some((r) => rightPadded.endsWith(padChqRef(r)))) return true
  }
  return false
}

/** IBAG / inland levy lines are reconciled via clearing schedules, not unpresented timing cheques. */
export function isLevyPayment(payment: ClearingTxLike): boolean {
  const text = [payment.details, payment.name].filter(Boolean).join(' ')
  return /\blevy\b/i.test(text)
}

function payeeTokens(payment: ClearingTxLike): string[] {
  return [payment.name, payment.details]
    .filter(Boolean)
    .join(' ')
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter((t) => t.length >= 4)
}

/** Ecobank withdrawal debits with matching amount and payee name (handles truncated CHQ refs). */
export function paymentHasNamedWithdrawalCounterpart(
  payment: ClearingTxLike,
  bankDebits: ClearingTxLike[],
  amountTolerance = 0.01
): boolean {
  const tokens = payeeTokens(payment)
  if (!tokens.length) return false
  for (const d of bankDebits) {
    if (!amountsMatch(payment.amount, d.amount, amountTolerance)) continue
    const text = bankText(d).toUpperCase()
    if (!/CHEQUE\s+WITHDRAWAL|WITHDRAWAL/i.test(text)) continue
    if (tokens.some((t) => text.includes(t))) return true
  }
  return false
}

/** Outward transfer debits (no chq) that pair with large cash-book payments by amount + payee hint. */
export function paymentHasTransferCounterpart(
  payment: ClearingTxLike,
  bankDebits: ClearingTxLike[],
  amountTolerance = 0.01
): boolean {
  const tokens = payeeTokens(payment)
  for (const d of bankDebits) {
    if (!amountsMatch(payment.amount, d.amount, amountTolerance)) continue
    const text = bankText(d).toUpperCase()
    if (!TRANSFER_DEBIT_RE.test(text)) continue
    if (!tokens.length || tokens.some((t) => text.includes(t))) return true
  }
  return false
}

function amountsMatch(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance
}

function datesWithinWindow(d1: Date | null, d2: Date | null, windowDays: number): boolean {
  if (!d1 || !d2) return true
  const days = Math.abs(d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24)
  return days <= windowDays
}

export interface ClearingPairIds {
  paymentIds: Set<string>
  creditIds: Set<string>
}

/** Unmatched CB payments linked to unmatched Ecobank clearing credits (same chq + amount). */
export function findLinkedEcobankClearingPairIds(
  payments: ClearingTxLike[],
  credits: ClearingTxLike[],
  amountTolerance = 0.01
): ClearingPairIds {
  const paymentIds = new Set<string>()
  const creditIds = new Set<string>()
  for (const p of payments) {
    for (const c of credits) {
      if (!isEcobankClearingCredit(c)) continue
      if (!amountsMatch(p.amount, c.amount, amountTolerance)) continue
      if (!chequeOrRefLink(p, c)) continue
      paymentIds.add(p.id)
      creditIds.add(c.id)
      break
    }
  }
  return { paymentIds, creditIds }
}

export interface DuplicateChequeWarning {
  chqNo: string
  count: number
  transactionIds: string[]
  totalAmount: number
}

export function detectDuplicateChequePayments(payments: Tx[]): DuplicateChequeWarning[] {
  const byChq = new Map<string, Tx[]>()
  for (const p of payments) {
    const chq = p.chqNo?.trim()
    if (!chq) continue
    const key = chq.padStart(6, '0')
    if (!byChq.has(key)) byChq.set(key, [])
    byChq.get(key)!.push(p)
  }
  const out: DuplicateChequeWarning[] = []
  for (const [chqNo, rows] of byChq) {
    if (rows.length < 2) continue
    out.push({
      chqNo,
      count: rows.length,
      transactionIds: rows.map((r) => r.id),
      totalAmount: rows.reduce((s, r) => s + r.amount, 0),
    })
  }
  return out.sort((a, b) => b.count - a.count)
}

/**
 * Suggest cash-book payments ↔ bank credits for Ecobank inward clearing / HSE deposits.
 */
export function suggestEcobankClearingMatches(
  payments: Tx[],
  credits: Tx[],
  matchedCashBookIds: Set<string>,
  matchedBankIds: Set<string>,
  options: Pick<SuggestMatchesOptions, 'amountTolerance' | 'dateWindowDays'> = {}
): SuggestedMatch[] {
  const amountTolerance = options.amountTolerance ?? 0.01
  const dateWindowDays = options.dateWindowDays ?? 7
  const suggestions: SuggestedMatch[] = []

  for (const cb of payments) {
    if (matchedCashBookIds.has(cb.id)) continue
    if (!cb.chqNo?.trim()) continue

    for (const bk of credits) {
      if (matchedBankIds.has(bk.id)) continue
      if (!isEcobankClearingCredit(bk)) continue
      if (!amountsMatch(cb.amount, bk.amount, amountTolerance)) continue
      if (!chequeOrRefLink(cb, bk)) continue

      const dateMatch = datesWithinWindow(cb.date, bk.date, dateWindowDays)
      let confidence = 0.92
      if (dateMatch) confidence += 0.05
      confidence = Math.min(confidence, 0.98)

      suggestions.push({
        cashBookTx: cb,
        bankTx: bk,
        confidence,
        reason: `Ecobank clearing: chq/ref + amount${dateMatch ? ', date' : ''}`,
      })
    }
  }

  // One suggestion per cash-book row; prefer highest confidence per CB.
  const byCb = new Map<string, SuggestedMatch>()
  for (const s of suggestions) {
    const prev = byCb.get(s.cashBookTx.id)
    if (!prev || s.confidence > prev.confidence) byCb.set(s.cashBookTx.id, s)
  }

  // One bank credit per suggestion; drop lower-confidence duplicates on bank side.
  const byBank = new Map<string, SuggestedMatch>()
  for (const s of byCb.values()) {
    const prev = byBank.get(s.bankTx.id)
    if (!prev || s.confidence > prev.confidence) byBank.set(s.bankTx.id, s)
  }

  return Array.from(byBank.values()).sort((a, b) => b.confidence - a.confidence)
}

export interface BrsClearingAdjustments {
  unmatchedPaymentsTotal: number
  unpresentedChequesTotal: number
  bankOnlyCreditsNotInCashBookTotal: number
  clearingLinkedPairCount: number
  unpresentedPaymentCount: number
}

/** True when any bank debit or Ecobank clearing credit corresponds to this cash-book payment. */
export function paymentHasBankCounterpart(
  payment: ClearingTxLike,
  bankDebits: ClearingTxLike[],
  bankCredits: ClearingTxLike[],
  amountTolerance = 0.01
): boolean {
  if (isLevyPayment(payment)) return true
  if (paymentHasTransferCounterpart(payment, bankDebits, amountTolerance)) return true
  if (paymentHasNamedWithdrawalCounterpart(payment, bankDebits, amountTolerance)) return true
  for (const d of bankDebits) {
    if (!amountsMatch(payment.amount, d.amount, amountTolerance)) continue
    if (chequeOrRefLink(payment, d)) return true
  }
  for (const c of bankCredits) {
    if (!isEcobankClearingCredit(c)) continue
    if (!amountsMatch(payment.amount, c.amount, amountTolerance)) continue
    if (chequeOrRefLink(payment, c)) return true
  }
  return false
}

/** @deprecated Use paymentHasBankCounterpart — kept for tests naming clarity */
export const paymentHasUnmatchedBankCounterpart = paymentHasBankCounterpart

/**
 * Ghana BRS: unpresented = cash-book payments with no corresponding bank movement yet
 * (neither a debit nor an Ecobank inward clearing / HSE credit with matching chq + amount).
 */
export function computeUnpresentedChequesTotal(
  unmatchedPayments: ClearingTxLike[],
  allBankDebits: ClearingTxLike[],
  allBankCredits: ClearingTxLike[],
  broughtForwardUnpresentedTotal: number,
  amountTolerance = 0.01
): { total: number; rows: ClearingTxLike[] } {
  const rows = unmatchedPayments.filter(
    (p) => !paymentHasBankCounterpart(p, allBankDebits, allBankCredits, amountTolerance)
  )
  const total = rows.reduce((s, t) => s + t.amount, 0) + broughtForwardUnpresentedTotal
  return { total, rows }
}

/** Ghana manual BRS: inward clearing and FT payroll credits appear on the debit (add) side. */
export function isCreditReclassifiedAsDebit(credit: ClearingTxLike): boolean {
  const text = bankText(credit as Tx)
  return isEcobankClearingCredit(credit) || FT_CONSOLIDATION_RE.test(text)
}

/** True when a bank debit corresponds to any cash-book payment (matched or unmatched). */
export function debitHasPaymentCounterpart(
  debit: ClearingTxLike,
  payments: ClearingTxLike[],
  amountTolerance = 0.01,
  matchedPaymentIds?: Set<string>
): boolean {
  const text = bankText(debit).toUpperCase()
  const isTransfer = TRANSFER_DEBIT_RE.test(text)
  const isWithdrawal = WITHDRAWAL_DEBIT_RE.test(text)
  for (const p of payments) {
    if (!amountsMatch(p.amount, debit.amount, amountTolerance)) continue
    if (chequeOrRefLink(p, debit)) return true
    const tokens = payeeTokens(p)
    if (tokens.length && (isWithdrawal || isTransfer) && tokens.some((t) => text.includes(t))) {
      return true
    }
  }
  if (matchedPaymentIds && isWithdrawal) {
    for (const p of payments) {
      if (!matchedPaymentIds.has(p.id)) continue
      if (!amountsMatch(p.amount, debit.amount, amountTolerance)) continue
      return true
    }
  }
  return false
}

/** True when a bank credit corresponds to a cash-book receipt or payment. */
export function creditHasCashBookCounterpart(
  credit: ClearingTxLike,
  payments: ClearingTxLike[],
  receipts: ClearingTxLike[],
  amountTolerance = 0.01
): boolean {
  const text = bankText(credit as Tx)
  if (isEcobankClearingCredit(credit)) return true
  // Withdrawal lines posted as credits stay in bank-only schedules (manual Ghana BRS).
  if (WITHDRAWAL_DEBIT_RE.test(text)) return false
  for (const r of receipts) {
    if (!amountsMatch(r.amount, credit.amount, amountTolerance)) continue
    if (chequeOrRefLink(r, credit)) return true
  }
  for (const p of payments) {
    if (!amountsMatch(p.amount, credit.amount, amountTolerance)) continue
    if (chequeOrRefLink(p, credit)) return true
  }
  return false
}

export function computeBankOnlyDebitsTotal(
  unmatchedDebits: ClearingTxLike[],
  unmatchedCredits: ClearingTxLike[],
  allPayments: ClearingTxLike[],
  amountTolerance = 0.01,
  matchedPaymentIds?: Set<string>
): number {
  const debitTotal = unmatchedDebits
    .filter((d) => !debitHasPaymentCounterpart(d, allPayments, amountTolerance, matchedPaymentIds))
    .reduce((s, t) => s + t.amount, 0)
  const reclassified = unmatchedCredits
    .filter((c) => isCreditReclassifiedAsDebit(c))
    .reduce((s, t) => s + t.amount, 0)
  return debitTotal + reclassified
}

export interface BankOnlyScheduleRows {
  debits: ClearingTxLike[]
  credits: ClearingTxLike[]
}

/** Rows that belong on the bank-only debit/credit schedules (matches BRS totals). */
export function buildBankOnlyScheduleRows(
  unmatchedDebits: ClearingTxLike[],
  unmatchedCredits: ClearingTxLike[],
  allPayments: ClearingTxLike[],
  allReceipts: ClearingTxLike[],
  amountTolerance = 0.01,
  matchedPaymentIds?: Set<string>
): BankOnlyScheduleRows {
  const debits = [
    ...unmatchedDebits.filter(
      (d) => !debitHasPaymentCounterpart(d, allPayments, amountTolerance, matchedPaymentIds)
    ),
    ...unmatchedCredits.filter((c) => isCreditReclassifiedAsDebit(c)),
  ]
  const credits = unmatchedCredits.filter(
    (c) =>
      !isCreditReclassifiedAsDebit(c) &&
      !creditHasCashBookCounterpart(c, allPayments, allReceipts, amountTolerance)
  )
  return { debits, credits }
}

export function computeBankOnlyCreditsTotal(
  unmatchedCredits: ClearingTxLike[],
  allPayments: ClearingTxLike[],
  allReceipts: ClearingTxLike[],
  broughtForwardBankCreditsTotal: number,
  amountTolerance = 0.01
): number {
  const current = unmatchedCredits
    .filter((c) => !isCreditReclassifiedAsDebit(c))
    .filter((c) => !creditHasCashBookCounterpart(c, allPayments, allReceipts, amountTolerance))
    .reduce((s, t) => s + t.amount, 0)
  return current + broughtForwardBankCreditsTotal
}

/** Exclude linked Ecobank clearing pairs from bank-only credit totals; refine unpresented cheques. */
export function brsTotalsExcludingLinkedClearingPairs(
  unmatchedPayments: ClearingTxLike[],
  unmatchedCredits: ClearingTxLike[],
  allBankDebits: ClearingTxLike[],
  allBankCredits: ClearingTxLike[],
  broughtForwardUnpresentedTotal: number,
  broughtForwardBankCreditsTotal: number,
  amountTolerance = 0.01
): BrsClearingAdjustments {
  const unmatchedPaymentsTotal = unmatchedPayments.reduce((s, t) => s + t.amount, 0)
  const unpresented = computeUnpresentedChequesTotal(
    unmatchedPayments,
    allBankDebits,
    allBankCredits,
    broughtForwardUnpresentedTotal,
    amountTolerance
  )
  const { paymentIds } = findLinkedEcobankClearingPairIds(
    unmatchedPayments,
    unmatchedCredits,
    amountTolerance
  )
  return {
    unmatchedPaymentsTotal,
    unpresentedChequesTotal: unpresented.total,
    bankOnlyCreditsNotInCashBookTotal: 0,
    clearingLinkedPairCount: paymentIds.size,
    unpresentedPaymentCount: unpresented.rows.length,
  }
}

/**
 * Suggest payment ↔ bank debit for Ecobank transfers and named withdrawals
 * (patterns that standard chq matching often misses).
 */
export function suggestEcobankPaymentDebitMatches(
  payments: Tx[],
  debits: Tx[],
  matchedCashBookIds: Set<string>,
  matchedBankIds: Set<string>,
  amountTolerance = 0.01
): SuggestedMatch[] {
  const suggestions: SuggestedMatch[] = []
  for (const cb of payments) {
    if (matchedCashBookIds.has(cb.id)) continue
    for (const bk of debits) {
      if (matchedBankIds.has(bk.id)) continue
      if (!amountsMatch(cb.amount, bk.amount, amountTolerance)) continue
      const transfer = paymentHasTransferCounterpart(cb, [bk], amountTolerance)
      const named = paymentHasNamedWithdrawalCounterpart(cb, [bk], amountTolerance)
      if (!transfer && !named) continue
      suggestions.push({
        cashBookTx: cb,
        bankTx: bk,
        confidence: transfer ? 0.91 : 0.89,
        reason: transfer
          ? 'Ecobank transfer: amount + payee'
          : 'Ecobank withdrawal: amount + payee (truncated chq)',
      })
    }
  }
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

/** Merge clearing suggestions ahead of standard payment↔debit suggestions (no duplicate CB/bank ids). */
export function mergePaymentSuggestions(
  clearing: SuggestedMatch[],
  standard: SuggestedMatch[]
): SuggestedMatch[] {
  const usedCb = new Set<string>()
  const usedBank = new Set<string>()
  const out: SuggestedMatch[] = []
  for (const s of [...clearing, ...standard]) {
    const cbId = s.cashBookTx.id
    const bkId = s.bankTx.id
    if (usedCb.has(cbId) || usedBank.has(bkId)) continue
    usedCb.add(cbId)
    usedBank.add(bkId)
    out.push(s)
  }
  return out.sort((a, b) => b.confidence - a.confidence)
}
