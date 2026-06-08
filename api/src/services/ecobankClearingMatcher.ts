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

/**
 * Bank credit lines that pair with cash-book cheque payments.
 * Lordship Ecobank exports often use "HSE CHEQUE-EGH … DEPOSIT" without the "CHEQUE DEPOSIT - HSE" prefix.
 */
export const ECOBANK_CLEARING_CREDIT_RE =
  /CHEQUE\s+CLEARING\s*-\s*INWARD|CHQ\s+NO\s+[\d.]+\s+received\s+from\s+Clearing|received\s+from\s+Clearing|CHEQUE\s+DEPOSIT\s*-\s*HSE|CHEQUE\s+DEPOSIT(?!\s+-\s*HSE)|HSE\s+CHEQUE(?:-EGH|-EBG)?[\s\S]*(?:DEPOSIT|DEP\.?\b|DEP\s+BO|DEPOSIT\s+BO)/i

const CHEQUE_REF_RE =
  /\b(?:CHQ|Cheque|REF|Ref)(?:\s*(?:No|NO|no)\.?)?\s*[#:.]?\s*(\d{2,10})(?=[A-Z]|\b|$)/gi
const TRANSFER_DEBIT_RE = /FUNDS\s+TRANSFER|OUTWARD\s*-\s*LOCAL|NRT\s+BO/i
const FT_CONSOLIDATION_RE = /FT\s+Consolidation|PAYROLL\s+UPLOAD/i
const WITHDRAWAL_DEBIT_RE = /CHEQUE\s+WITHDRAWAL|WITHDRAWAL/i

/** Bulk-match tier B: only auto-apply payment suggestions with these reasons (not generic chq↔debit). */
export const ECOBANK_BULK_SAFE_REASON_RE =
  /Ecobank clearing|Ecobank transfer|Ecobank withdrawal|Ecobank statutory deposit/i

export function isEcobankPatternMatchReason(reason: string): boolean {
  return ECOBANK_BULK_SAFE_REASON_RE.test(reason)
}

export interface EcobankGhanaProfile {
  active: boolean
  label: string
  clearingDateWindowDays: number
  /** When true, BRS unpresented uses manual workbook Groups 2–3 netting (opt-in; default off). */
  workbookNetting: boolean
}

export type ScopedBankAccount = {
  id?: string
  name?: string | null
  bankName?: string | null
}

/** Limit profile detection to the selected bank account when reconciling multi-bank projects. */
export function bankAccountsForScope(
  bankAccounts: ScopedBankAccount[] | undefined,
  bankAccountId?: string
): ScopedBankAccount[] {
  const all = bankAccounts || []
  if (!bankAccountId) return all
  const scoped = all.filter((a) => a.id === bankAccountId)
  return scoped.length ? scoped : all
}

export function resolveEcobankGhanaProfile(opts: {
  bankAccounts?: ScopedBankAccount[]
  sampleBankText?: string
  workbookNetting?: boolean
}): EcobankGhanaProfile {
  const names = (opts.bankAccounts || []).flatMap((a) => [a.name, a.bankName].filter(Boolean))
  const text = [...names, opts.sampleBankText || ''].join(' ')
  const active =
    /ecobank/i.test(text) ||
    /CHEQUE\s+CLEARING\s*-\s*INWARD|CHEQUE\s+DEPOSIT\s*-\s*HSE/i.test(opts.sampleBankText || '')
  const envOn =
    process.env.GHANA_BRS_WORKBOOK_NETTING === '1' || process.env.GHANA_BRS_WORKBOOK_NETTING === 'true'
  const workbookNetting =
    opts.workbookNetting !== undefined ? opts.workbookNetting : envOn
  return {
    active,
    label: 'Ecobank Ghana BRS',
    clearingDateWindowDays: 14,
    workbookNetting: active && workbookNetting,
  }
}

export function resolveEcobankGhanaProfileForScope(opts: {
  bankAccounts?: ScopedBankAccount[]
  bankAccountId?: string
  sampleBankText?: string
  workbookNetting?: boolean
}): EcobankGhanaProfile {
  return resolveEcobankGhanaProfile({
    bankAccounts: bankAccountsForScope(opts.bankAccounts, opts.bankAccountId),
    sampleBankText: opts.sampleBankText,
    workbookNetting: opts.workbookNetting,
  })
}

/** Non-Ecobank Ghana bank label for reconcile/report profile (mapping + UI hints only). */
export function resolveGhanaBankFormatLabel(
  bankAccounts: ScopedBankAccount[] | undefined,
  bankAccountId?: string
): string | null {
  const text = bankAccountsForScope(bankAccounts, bankAccountId)
    .flatMap((a) => [a.name, a.bankName])
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  if (/ecobank/.test(text)) return 'ecobank'
  if (/\bgcb\b|ghana commercial/.test(text)) return 'gcb'
  if (/stanbic|standard bank/.test(text)) return 'stanbic'
  if (/fidelity/.test(text)) return 'fidelity'
  if (/\buba\b|united bank/.test(text)) return 'uba'
  if (/absa|barclays/.test(text)) return 'absa'
  if (/access bank/.test(text)) return 'access'
  return null
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

/** Judgment / timing lines the manual workbook keeps off bank-only debit schedules. */
export function isEcobankJudgmentSchedulePayment(payment: ClearingTxLike): boolean {
  const text = [payment.name, payment.details].filter(Boolean).join(' ').toUpperCase()
  return /VODAFONE|GRA\b|SSNIT|SODIUM|DORIS|RITA KORKOI/i.test(text)
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

/** GRA / PAYE / statutory lines often clear via HSE deposits with a different cheque number. */
const STATUTORY_DEPOSIT_PAIRS: { payment: RegExp; bank: RegExp }[] = [
  { payment: /\bGRA\b/i, bank: /\bGRA\b/i },
  { payment: /\bSSNIT\b/i, bank: /\bSSNIT\b/i },
  { payment: /\bNBC\b/i, bank: /\bNBC\b/i },
  { payment: /\bECG\b/i, bank: /\bECG\b/i },
  { payment: /ENTERPRISE\s+TRUSTEES/i, bank: /ENTERPRISE\s+TRUSTEES/i },
]

function paymentMatchesStatutoryBankLine(payment: ClearingTxLike, bankLine: ClearingTxLike): boolean {
  const payText = [payment.name, payment.details].filter(Boolean).join(' ')
  const bankT = bankText(bankLine)
  return STATUTORY_DEPOSIT_PAIRS.some(
    ({ payment: payRe, bank: bankRe }) => payRe.test(payText) && bankRe.test(bankT)
  )
}

/** HSE cheque deposit lines (may post to debit or credit column). */
export function isEcobankHseDepositLine(tx: ClearingTxLike): boolean {
  const text = bankText(tx)
  return /CHEQUE\s+DEPOSIT\s*-\s*HSE|HSE\s+CHEQUE(?:-EGH|-EBG)?/i.test(text)
}

/** HSE statutory deposits sometimes post to the debit column on Ecobank exports. */
export function isEcobankHseStatutoryDepositLine(tx: ClearingTxLike): boolean {
  const text = bankText(tx)
  return (
    isEcobankHseDepositLine(tx) &&
    /\bDEP/i.test(text) &&
    /\b(GRA|SSNIT|NBC|ECG|ENTERPRISE\s+TRUSTEES)\b/i.test(text)
  )
}

function paymentIsStatutoryDeposit(payment: ClearingTxLike): boolean {
  const payText = [payment.name, payment.details].filter(Boolean).join(' ')
  return STATUTORY_DEPOSIT_PAIRS.some(({ payment: payRe }) => payRe.test(payText))
}

function statutoryDepositBankLines<T extends ClearingTxLike>(
  bankCredits: T[],
  bankDebits: T[] = []
): T[] {
  return [
    ...bankCredits.filter((c) => isEcobankClearingCredit(c)),
    ...bankDebits.filter((d) => isEcobankHseStatutoryDepositLine(d)),
  ]
}

/** True when the payment chq appears anywhere on a bank line (timing signal / workbook section B). */
export function paymentChqMentionedOnBankStatement(
  payment: ClearingTxLike,
  bankDebits: ClearingTxLike[],
  bankCredits: ClearingTxLike[]
): boolean {
  const lines = [...bankDebits, ...bankCredits]
  for (const line of lines) {
    if (chequeOrRefLink(payment, line)) return true
  }
  const chq = payment.chqNo?.trim()
  if (!chq) return false
  const padded = padChqRef(chq)
  for (const line of lines) {
    const text = bankText(line)
    if (text.includes(chq) || (padded && text.includes(padded))) return true
  }
  return false
}

/** Payee-only withdrawal pairing is unsafe when the bank line cites a different explicit chq. */
function withdrawalPayeeMatchAllowed(
  payment: ClearingTxLike,
  debit: ClearingTxLike,
  amountTolerance: number
): boolean {
  const payChq = payment.chqNo?.trim()
  if (payChq) {
    const refs = extractRefsFromText(bankText(debit)).filter((r) => r.length >= 5)
    if (refs.length > 0 && !refs.some((r) => refTokensEquivalent(r, payChq))) return false
  }
  const tokens = payeeTokens(payment)
  if (!tokens.length) return false
  const text = bankText(debit).toUpperCase()
  if (!/CHEQUE\s+WITHDRAWAL|WITHDRAWAL/i.test(text)) return false
  return tokens.some((t) => text.includes(t))
}

/** HSE / inward clearing bank line that pairs with a statutory cash-book payment (amount + payee keyword). */
export function paymentHasStatutoryDepositCounterpart(
  payment: ClearingTxLike,
  bankCredits: ClearingTxLike[],
  amountTolerance = 0.01,
  bankDebits: ClearingTxLike[] = []
): boolean {
  for (const line of statutoryDepositBankLines(bankCredits, bankDebits)) {
    if (!amountsMatch(payment.amount, line.amount, amountTolerance)) continue
    if (paymentMatchesStatutoryBankLine(payment, line)) return true
  }
  return false
}

/** Ecobank withdrawal debits with matching amount and payee name (handles truncated CHQ refs). */
export function paymentHasNamedWithdrawalCounterpart(
  payment: ClearingTxLike,
  bankDebits: ClearingTxLike[],
  amountTolerance = 0.01
): boolean {
  for (const d of bankDebits) {
    if (!amountsMatch(payment.amount, d.amount, amountTolerance)) continue
    if (withdrawalPayeeMatchAllowed(payment, d, amountTolerance)) return true
  }
  return false
}

/** Withdrawal cites a different chq but names the same payee (manual cross-chq pairs). */
export function paymentHasCrossChqWithdrawalCounterpart(
  payment: ClearingTxLike,
  bankDebits: ClearingTxLike[],
  amountTolerance = 0.01
): boolean {
  const payChq = payment.chqNo?.trim()
  const tokens = payeeTokens(payment)
  if (!tokens.length) return false
  for (const d of bankDebits) {
    if (!amountsMatch(payment.amount, d.amount, amountTolerance)) continue
    const text = bankText(d).toUpperCase()
    if (!/CHEQUE\s+WITHDRAWAL|WITHDRAWAL/i.test(text)) continue
    const bankRefs = extractRefsFromText(bankText(d)).filter((r) => r.length >= 5)
    if (payChq && bankRefs.some((r) => refTokensEquivalent(r, payChq))) continue
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
  /** Cash-book payments that count toward the BRS unpresented line (Ecobank Ghana rules). */
  unpresentedChequeRows: ClearingTxLike[]
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
  if (paymentHasCrossChqWithdrawalCounterpart(payment, bankDebits, amountTolerance)) return true
  for (const d of bankDebits) {
    if (!amountsMatch(payment.amount, d.amount, amountTolerance)) continue
    if (chequeOrRefLink(payment, d)) return true
  }
  if (paymentHasStatutoryDepositCounterpart(payment, bankCredits, amountTolerance, bankDebits)) return true
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

export interface BankOnlyDebitsContext {
  workbookNetting?: boolean
  matchedPaymentIds?: Set<string>
}

/** Clearing / HSE lines that pair to a cash-book payment (debit or credit column). */
export function ecobankClearingLineHasPaymentCounterpart(
  line: ClearingTxLike,
  payments: ClearingTxLike[],
  amountTolerance = 0.01,
  ctx?: BankOnlyDebitsContext
): boolean {
  const lineText = bankText(line)
  const clearingOrHse =
    (isEcobankClearingCredit(line) || isEcobankHseDepositLine(line)) &&
    !FT_CONSOLIDATION_RE.test(lineText)
  if (!clearingOrHse) return false
  if (ctx?.workbookNetting && isEcobankHseDepositLine(line)) {
    const statutoryAtAmount = payments.filter(
      (p) =>
        paymentIsStatutoryDeposit(p) && amountsMatch(p.amount, line.amount, amountTolerance)
    )
    if (statutoryAtAmount.length >= 1) return true
  }
  const judgmentAtAmount = payments.filter(
    (p) =>
      isEcobankJudgmentSchedulePayment(p) &&
      amountsMatch(p.amount, line.amount, amountTolerance)
  )
  const unmatchedJudgmentAtAmount = judgmentAtAmount.filter(
    (p) => !ctx?.matchedPaymentIds?.has(p.id)
  )
  if (judgmentAtAmount.length === 1) return true
  if (unmatchedJudgmentAtAmount.length === 1) return true
  for (const p of payments) {
    if (!amountsMatch(p.amount, line.amount, amountTolerance)) continue
    if (chequeOrRefLink(p, line)) return true
    if (paymentChqMentionedOnBankStatement(p, [line], [])) return true
    if (paymentMatchesStatutoryBankLine(p, line)) return true
    const tokens = payeeTokens(p)
    if (tokens.length && tokens.some((t) => lineText.toUpperCase().includes(t))) return true
  }
  return false
}

/** True when a bank debit corresponds to any cash-book payment (matched or unmatched). */
export function debitHasPaymentCounterpart(
  debit: ClearingTxLike,
  payments: ClearingTxLike[],
  amountTolerance = 0.01,
  matchedPaymentIds?: Set<string>,
  ctx?: BankOnlyDebitsContext
): boolean {
  if (ecobankClearingLineHasPaymentCounterpart(debit, payments, amountTolerance, ctx)) {
    return true
  }
  const text = bankText(debit).toUpperCase()
  const isTransfer = TRANSFER_DEBIT_RE.test(text)
  const isWithdrawal = WITHDRAWAL_DEBIT_RE.test(text)
  if (isEcobankHseStatutoryDepositLine(debit)) {
    for (const p of payments) {
      if (!amountsMatch(p.amount, debit.amount, amountTolerance)) continue
      if (paymentMatchesStatutoryBankLine(p, debit)) return true
    }
  }
  for (const p of payments) {
    if (!amountsMatch(p.amount, debit.amount, amountTolerance)) continue
    if (chequeOrRefLink(p, debit)) return true
    const tokens = payeeTokens(p)
    if (tokens.length && isWithdrawal && withdrawalPayeeMatchAllowed(p, debit, amountTolerance)) {
      return true
    }
    if (isWithdrawal && paymentHasCrossChqWithdrawalCounterpart(p, [debit], amountTolerance)) {
      return true
    }
    if (tokens.length && isTransfer && tokens.some((t) => text.includes(t))) {
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
    if (isEcobankClearingCredit(credit) && paymentMatchesStatutoryBankLine(p, credit)) return true
  }
  return false
}

/** Inward clearing credits reclassified as debits that pair to a cash-book payment. */
export function clearingCreditHasPaymentCounterpart(
  credit: ClearingTxLike,
  payments: ClearingTxLike[],
  amountTolerance = 0.01,
  ctx?: BankOnlyDebitsContext
): boolean {
  if (!isCreditReclassifiedAsDebit(credit)) return false
  return ecobankClearingLineHasPaymentCounterpart(credit, payments, amountTolerance, ctx)
}

export function computeBankOnlyDebitsTotal(
  unmatchedDebits: ClearingTxLike[],
  unmatchedCredits: ClearingTxLike[],
  allPayments: ClearingTxLike[],
  amountTolerance = 0.01,
  matchedPaymentIds?: Set<string>,
  excludeBankIds?: Set<string>,
  ctx?: BankOnlyDebitsContext
): number {
  const excluded = excludeBankIds ?? new Set<string>()
  const fullCtx: BankOnlyDebitsContext = {
    ...ctx,
    matchedPaymentIds: matchedPaymentIds ?? ctx?.matchedPaymentIds,
  }
  const debitTotal = unmatchedDebits
    .filter((d) => !excluded.has(d.id))
    .filter(
      (d) =>
        !debitHasPaymentCounterpart(d, allPayments, amountTolerance, matchedPaymentIds, fullCtx)
    )
    .reduce((s, t) => s + t.amount, 0)
  const reclassified = unmatchedCredits
    .filter((c) => !excluded.has(c.id))
    .filter((c) => isCreditReclassifiedAsDebit(c))
    .filter((c) => !clearingCreditHasPaymentCounterpart(c, allPayments, amountTolerance, fullCtx))
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
  matchedPaymentIds?: Set<string>,
  excludeBankIds?: Set<string>,
  ctx?: BankOnlyDebitsContext
): BankOnlyScheduleRows {
  const excluded = excludeBankIds ?? new Set<string>()
  const fullCtx: BankOnlyDebitsContext = {
    ...ctx,
    matchedPaymentIds: matchedPaymentIds ?? ctx?.matchedPaymentIds,
  }
  const debits = [
    ...unmatchedDebits.filter(
      (d) =>
        !excluded.has(d.id) &&
        !debitHasPaymentCounterpart(d, allPayments, amountTolerance, matchedPaymentIds, fullCtx)
    ),
    ...unmatchedCredits.filter(
      (c) =>
        !excluded.has(c.id) &&
        isCreditReclassifiedAsDebit(c) &&
        !clearingCreditHasPaymentCounterpart(c, allPayments, amountTolerance, fullCtx)
    ),
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
    unpresentedChequeRows: unpresented.rows,
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
      const text = bankText(bk).toUpperCase()
      const isWithdrawal = /CHEQUE\s+WITHDRAWAL|WITHDRAWAL/i.test(text)
      if (isWithdrawal && chequeOrRefLink(cb, bk)) {
        suggestions.push({
          cashBookTx: cb,
          bankTx: bk,
          confidence: 0.94,
          reason: 'Ecobank withdrawal: chq/ref + amount',
        })
        continue
      }
      const transfer = paymentHasTransferCounterpart(cb, [bk], amountTolerance)
      const crossChq =
        isWithdrawal &&
        paymentHasCrossChqWithdrawalCounterpart(cb, [bk], amountTolerance) &&
        !chequeOrRefLink(cb, bk)
      const named = isWithdrawal && withdrawalPayeeMatchAllowed(cb, bk, amountTolerance)
      if (!transfer && !crossChq && !named) continue
      suggestions.push({
        cashBookTx: cb,
        bankTx: bk,
        confidence: transfer ? 0.91 : crossChq ? 0.88 : 0.89,
        reason: transfer
          ? 'Ecobank transfer: amount + payee'
          : crossChq
            ? 'Ecobank withdrawal: amount + payee (cross-chq)'
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

/**
 * Suggest payment ↔ HSE/statutory bank credit when amount and payee keyword match
 * (manual workbooks often use different cheque numbers for GRA / PAYE deposits).
 */
export function suggestEcobankStatutoryDepositMatches(
  payments: Tx[],
  credits: Tx[],
  matchedCashBookIds: Set<string>,
  matchedBankIds: Set<string>,
  amountTolerance = 0.01,
  debits: Tx[] = []
): SuggestedMatch[] {
  const suggestions: SuggestedMatch[] = []
  const bankLines = statutoryDepositBankLines(credits, debits)
  for (const cb of payments) {
    if (matchedCashBookIds.has(cb.id)) continue
    for (const bk of bankLines) {
      if (matchedBankIds.has(bk.id)) continue
      if (!amountsMatch(cb.amount, bk.amount, amountTolerance)) continue
      if (!paymentMatchesStatutoryBankLine(cb, bk)) continue
      suggestions.push({
        cashBookTx: cb,
        bankTx: bk,
        confidence: 0.9,
        reason: 'Ecobank statutory deposit: amount + payee keyword',
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
