/**
 * GT Bank EUR BRS workbook rules (acct430-style):
 * - CANBNK vs BANKCHRG at the same amount and charge period are netted off the face
 *   (both sides leave Add/Less; they are cancel/reversal, not timing residue)
 * - TRANSFER FROM A/C lodgments → uncredited even when booked as CB payments
 * - Relocation receipts → unpresented even when booked as CB receipts
 * - Bank debits with a cash-book counterpart are cancel-out, not bank-only on the BRS
 */
import {
  clearingCreditHasPaymentCounterpart,
  debitHasPaymentCounterpart,
  isBankStatementMirrorReceipt,
  isCreditReclassifiedAsDebit,
  paymentHasBankCreditCounterpart,
  paymentHasBankDebitCounterpart,
  type ClearingTxLike,
} from './ecobankClearingMatcher.js'

function bankText(tx: ClearingTxLike): string {
  return [tx.details, tx.name].filter(Boolean).join(' ')
}

function amountsMatch(a: number, b: number, tolerance = 0.01): boolean {
  return Math.abs(a - b) <= tolerance
}

export interface GtBankEurProfile {
  active: boolean
}

export function isGtBankEurScope(
  project: { currency?: string | null; name?: string | null },
  bankAccounts: { bankName?: string | null; name?: string | null; accountNo?: string | null }[],
  sampleBankText?: string
): GtBankEurProfile {
  if ((project.currency || '').toUpperCase() !== 'EUR') return { active: false }
  const joined = [
    project.name || '',
    ...bankAccounts.flatMap((a) => [a.bankName, a.name, a.accountNo]),
    sampleBankText || '',
  ]
    .filter(Boolean)
    .join(' ')
  return { active: /gt\s*bank|gtb[-\d]|201\/105646|\bTGRF\b/i.test(joined) }
}

const CANBNK_RE = /CANBNK/i
const BANKCHR_RE = /BANKCHR|BANKCHG|BNKCHG|BANKCH-/i

export function isGtBankChargeCancelPayment(tx: ClearingTxLike): boolean {
  return CANBNK_RE.test(bankText(tx))
}

export function isGtBankChargeReceipt(tx: ClearingTxLike): boolean {
  if (isGtBankChargeCancelPayment(tx)) return false
  return BANKCHR_RE.test(bankText(tx))
}

export function isGtBankLodgmentTransferPayment(tx: ClearingTxLike): boolean {
  return /TRANSFER\s+FROM\s+A\/C/i.test(bankText(tx))
}

export function isGtBankRelocationReceipt(tx: ClearingTxLike): boolean {
  return /AFRICA\s+MOVE|RELOCATION/i.test(bankText(tx))
}

const CHARGE_PERIOD_STOP = new Set([
  'BANK',
  'BANKCH',
  'BANKCHG',
  'BANKCHRG',
  'BNKCHG',
  'CANBNK',
  'CANBNKCH',
  'CANBNKCHG',
  'CANMAR',
  'MARCH',
  'SEPT',
  'FROM',
  'GTB',
])

/** Narration month (MAR18 / MARCH / AUG / SEPT / CANMAR) so March cancels do not net August charges. */
export function gtBankEurChargePeriodKey(tx: ClearingTxLike): string | null {
  const t = bankText(tx).toUpperCase()
  if (/CANMAR/.test(t)) return 'MAR'
  const m = t.match(/\b(JAN|FEB|MAR(?:CH)?|APR|MAY|JUN|JUL|AUG|SEP(?:T)?|OCT|NOV|DEC)\b/)
  if (!m) return null
  const raw = m[1]
  if (raw.startsWith('MAR')) return 'MAR'
  if (raw.startsWith('SEP')) return 'SEP'
  return raw.slice(0, 3)
}

function partyTokens(tx: ClearingTxLike): string[] {
  return bankText(tx)
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter((w) => w.length >= 3 && !CHARGE_PERIOD_STOP.has(w) && !/^\d+$/.test(w))
}

function partyScore(a: ClearingTxLike, b: ClearingTxLike): number {
  const ta = partyTokens(a)
  const tb = partyTokens(b)
  let score = 0
  for (const x of ta) {
    for (const y of tb) {
      if (x === y || (x.length >= 4 && y.length >= 4 && (x.startsWith(y) || y.startsWith(x)))) {
        score += Math.min(x.length, y.length)
      }
    }
  }
  return score
}

/**
 * Drop matched CANBNK (Add) and BANKCHRG (Less) pairs from the face lists.
 * Same amount + same charge period; party tokens break ties. Not generic equal-count cancel.
 */
export function netGtBankEurChargeReversals(
  uncreditedRows: ClearingTxLike[],
  unpresentedRows: ClearingTxLike[],
  amountTolerance = 0.01
): {
  uncreditedRows: ClearingTxLike[]
  unpresentedRows: ClearingTxLike[]
  nettedPairs: Array<{ cancel: ClearingTxLike; original: ClearingTxLike }>
} {
  const cancels = uncreditedRows.filter(isGtBankChargeCancelPayment)
  const originals = unpresentedRows.filter(isGtBankChargeReceipt)
  const usedCancel = new Set<string>()
  const usedOriginal = new Set<string>()
  const nettedPairs: Array<{ cancel: ClearingTxLike; original: ClearingTxLike }> = []

  for (const cancel of cancels) {
    const period = gtBankEurChargePeriodKey(cancel)
    if (!period) continue
    const candidates = originals.filter(
      (o) =>
        !usedOriginal.has(o.id) &&
        amountsMatch(cancel.amount, o.amount, amountTolerance) &&
        gtBankEurChargePeriodKey(o) === period
    )
    if (!candidates.length) continue
    candidates.sort((a, b) => partyScore(cancel, b) - partyScore(cancel, a) || a.id.localeCompare(b.id))
    const original = candidates[0]!
    usedCancel.add(cancel.id)
    usedOriginal.add(original.id)
    nettedPairs.push({ cancel, original })
  }

  return {
    uncreditedRows: uncreditedRows.filter((t) => !usedCancel.has(t.id)),
    unpresentedRows: unpresentedRows.filter((t) => !usedOriginal.has(t.id)),
    nettedPairs,
  }
}

function dateWithinWindow(
  a: ClearingTxLike,
  b: ClearingTxLike,
  windowDays: number,
  amountTolerance: number
): boolean {
  if (!amountsMatch(a.amount, b.amount, amountTolerance)) return false
  const da = a.date ? new Date(a.date) : null
  const db = b.date ? new Date(b.date) : null
  if (!da || !db || Number.isNaN(da.getTime()) || Number.isNaN(db.getTime())) return false
  const dayDiff = Math.abs((da.getTime() - db.getTime()) / (1000 * 60 * 60 * 24))
  return dayDiff <= windowDays
}

/** EUR exports sometimes book bank debits against receipt lines (sign-flipped FC column). */
export function debitHasGtBankReceiptCounterpart(
  debit: ClearingTxLike,
  receipts: ClearingTxLike[],
  amountTolerance = 0.01,
  windowDays = 400
): boolean {
  const atAmount = receipts.filter((r) => amountsMatch(r.amount, debit.amount, amountTolerance))
  if (atAmount.length !== 1) return false
  return dateWithinWindow(atAmount[0]!, debit, windowDays, amountTolerance)
}

export function receiptHasGtBankDebitCounterpart(
  receipt: ClearingTxLike,
  debits: ClearingTxLike[],
  amountTolerance = 0.01,
  windowDays = 400
): boolean {
  const atAmount = debits.filter((d) => amountsMatch(d.amount, receipt.amount, amountTolerance))
  if (atAmount.length !== 1) return false
  return dateWithinWindow(receipt, atAmount[0]!, windowDays, amountTolerance)
}

export function computeGtBankEurTimingSchedule(input: {
  unmatchedReceipts: ClearingTxLike[]
  unmatchedPayments: ClearingTxLike[]
  unmatchedDebits: ClearingTxLike[]
  unmatchedCredits: ClearingTxLike[]
  allBankDebits: ClearingTxLike[]
  allBankCredits: ClearingTxLike[]
  broughtForwardReceiptLodgmentsTotal: number
  broughtForwardUnpresentedTotal: number
  amountTolerance?: number
}): {
  uncreditedLodgmentsTimingTotal: number
  unpresentedChequesTotal: number
  uncreditedRows: ClearingTxLike[]
  unpresentedRows: ClearingTxLike[]
} {
  const tol = input.amountTolerance ?? 0.01
  const uncreditedRows: ClearingTxLike[] = []
  const unpresentedRows: ClearingTxLike[] = []

  for (const receipt of input.unmatchedReceipts) {
    if (isGtBankChargeCancelPayment(receipt) || isGtBankLodgmentTransferPayment(receipt)) {
      uncreditedRows.push(receipt)
      continue
    }
    if (isGtBankChargeReceipt(receipt) || isGtBankRelocationReceipt(receipt)) {
      if (
        isGtBankChargeReceipt(receipt) &&
        receiptHasGtBankDebitCounterpart(receipt, input.allBankDebits, tol)
      ) {
        continue
      }
      unpresentedRows.push(receipt)
      continue
    }
    if (
      isBankStatementMirrorReceipt(
        receipt,
        input.unmatchedDebits,
        input.unmatchedCredits,
        tol
      )
    ) {
      continue
    }
    if (receiptHasGtBankDebitCounterpart(receipt, input.allBankDebits, tol)) {
      continue
    }
    uncreditedRows.push(receipt)
  }

  for (const payment of input.unmatchedPayments) {
    if (isGtBankChargeCancelPayment(payment) || isGtBankLodgmentTransferPayment(payment)) {
      uncreditedRows.push(payment)
      continue
    }
    if (
      !paymentHasBankDebitCounterpart(payment, input.allBankDebits, tol) &&
      !paymentHasBankCreditCounterpart(payment, input.allBankCredits, tol)
    ) {
      unpresentedRows.push(payment)
    }
  }

  const netted = netGtBankEurChargeReversals(uncreditedRows, unpresentedRows, tol)
  const uncreditedLodgmentsTimingTotal =
    netted.uncreditedRows.reduce((s, t) => s + t.amount, 0) + input.broughtForwardReceiptLodgmentsTotal
  const unpresentedChequesTotal =
    netted.unpresentedRows.reduce((s, t) => s + t.amount, 0) + input.broughtForwardUnpresentedTotal

  return {
    uncreditedLodgmentsTimingTotal,
    unpresentedChequesTotal,
    uncreditedRows: netted.uncreditedRows,
    unpresentedRows: netted.unpresentedRows,
  }
}

/** Bank-only debit rows that belong on the BRS Add line (cancel-out counterparts omitted). */
export function buildGtBankEurBankOnlyDebitRows(input: {
  unmatchedDebits: ClearingTxLike[]
  unmatchedCredits: ClearingTxLike[]
  payments: ClearingTxLike[]
  receipts: ClearingTxLike[]
  amountTolerance?: number
  matchedPaymentIds?: Set<string>
  excludeBankIds?: Set<string>
}): ClearingTxLike[] {
  const tol = input.amountTolerance ?? 0.01
  const excluded = input.excludeBankIds ?? new Set<string>()
  const debits = input.unmatchedDebits.filter(
    (d) =>
      !excluded.has(d.id) &&
      !debitHasGtBankCashBookCounterpart(
        d,
        input.payments,
        input.receipts,
        input.matchedPaymentIds,
        tol
      )
  )
  const reclassified = input.unmatchedCredits.filter(
    (c) =>
      !excluded.has(c.id) &&
      isCreditReclassifiedAsDebit(c) &&
      !clearingCreditHasPaymentCounterpart(c, input.payments, tol, {
        matchedPaymentIds: input.matchedPaymentIds,
      })
  )
  return [...debits, ...reclassified]
}

export function computeGtBankEurBankOnlyDebitsTotal(input: {
  unmatchedDebits: ClearingTxLike[]
  unmatchedCredits: ClearingTxLike[]
  payments: ClearingTxLike[]
  receipts: ClearingTxLike[]
  amountTolerance?: number
  matchedPaymentIds?: Set<string>
  excludeBankIds?: Set<string>
}): number {
  return buildGtBankEurBankOnlyDebitRows(input).reduce((s, t) => s + t.amount, 0)
}

function debitHasGtBankCashBookCounterpart(
  debit: ClearingTxLike,
  payments: ClearingTxLike[],
  receipts: ClearingTxLike[],
  matchedPaymentIds: Set<string> | undefined,
  amountTolerance: number
): boolean {
  if (
    debitHasPaymentCounterpart(debit, payments, amountTolerance, matchedPaymentIds, undefined)
  ) {
    return true
  }
  return debitHasGtBankReceiptCounterpart(debit, receipts, amountTolerance)
}
