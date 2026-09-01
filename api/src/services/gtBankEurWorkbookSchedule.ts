/**
 * GT Bank EUR manual BRS workbook rules (acct430-style):
 * - CANBNKCHG payments → uncredited lodgments (cancel/reversal timing)
 * - BANKCHRG receipts → unpresented cheques (charge timing / to be reversed)
 * - TRANSFER FROM A/C lodgments → uncredited even when booked as CB payments
 * - Relocation receipts → unpresented even when booked as CB receipts
 * - Bank debits pair to cash-book receipts at same amount (EUR sign-flip exports)
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
  return BANKCHR_RE.test(bankText(tx))
}

export function isGtBankLodgmentTransferPayment(tx: ClearingTxLike): boolean {
  return /TRANSFER\s+FROM\s+A\/C/i.test(bankText(tx))
}

export function isGtBankRelocationReceipt(tx: ClearingTxLike): boolean {
  return /AFRICA\s+MOVE|RELOCATION/i.test(bankText(tx))
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

  const uncreditedLodgmentsTimingTotal =
    uncreditedRows.reduce((s, t) => s + t.amount, 0) + input.broughtForwardReceiptLodgmentsTotal
  const unpresentedChequesTotal =
    unpresentedRows.reduce((s, t) => s + t.amount, 0) + input.broughtForwardUnpresentedTotal

  return {
    uncreditedLodgmentsTimingTotal,
    unpresentedChequesTotal,
    uncreditedRows,
    unpresentedRows,
  }
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
  const tol = input.amountTolerance ?? 0.01
  const excluded = input.excludeBankIds ?? new Set<string>()

  const debitTotal = input.unmatchedDebits
    .filter((d) => !excluded.has(d.id))
    .filter(
      (d) =>
        !debitHasGtBankCashBookCounterpart(
          d,
          input.payments,
          input.receipts,
          input.matchedPaymentIds,
          tol
        )
    )
    .reduce((s, t) => s + t.amount, 0)

  const reclassified = input.unmatchedCredits
    .filter((c) => !excluded.has(c.id))
    .filter((c) => isCreditReclassifiedAsDebit(c))
    .filter(
      (c) =>
        !clearingCreditHasPaymentCounterpart(c, input.payments, tol, {
          matchedPaymentIds: input.matchedPaymentIds,
        })
    )
    .reduce((s, t) => s + t.amount, 0)

  return debitTotal + reclassified
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
