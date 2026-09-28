/**
 * Universal BRS timing contract: face totals are the sum of one explicit row list
 * (plus brought-forward totals). Bank classifiers only fill the rows.
 */
import {
  isBankStatementMirrorReceipt,
  paymentHasBankCreditCounterpart,
  paymentHasBankDebitCounterpart,
  type ClearingTxLike,
} from './ecobankClearingMatcher.js'
import { computeGtBankEurTimingSchedule } from './gtBankEurWorkbookSchedule.js'

export type BrsTimingTx = ClearingTxLike

function sumAmounts(rows: BrsTimingTx[]): number {
  return rows.reduce((s, t) => s + t.amount, 0)
}

export function resolveCanonicalTimingSchedule(input: {
  unmatchedReceipts: BrsTimingTx[]
  unmatchedPayments: BrsTimingTx[]
  unmatchedDebits: BrsTimingTx[]
  unmatchedCredits: BrsTimingTx[]
  allBankDebits: BrsTimingTx[]
  allBankCredits: BrsTimingTx[]
  broughtForwardReceiptLodgmentsTotal: number
  broughtForwardUnpresentedTotal: number
  gtBankEur: boolean
  ecobank: boolean
  /**
   * Match-first banks (GT Bank cedis): face timing is the unmatched cash-book
   * list. Do not drop a cheque because another bank line shares the amount.
   */
  rawUnmatchedTiming?: boolean
  /** Post workbook-netting / working-paper rows (Ecobank only). */
  ecobankUnpresentedRows?: BrsTimingTx[]
  /** Post workbook-netting / working-paper total, already includes brought-forward. */
  ecobankUnpresentedTotal?: number
  amountTolerance?: number
}): {
  uncreditedRows: BrsTimingTx[]
  unpresentedRows: BrsTimingTx[]
  uncreditedLodgmentsTimingTotal: number
  unpresentedChequesTotal: number
} {
  if (input.gtBankEur) {
    const gt = computeGtBankEurTimingSchedule({
      unmatchedReceipts: input.unmatchedReceipts,
      unmatchedPayments: input.unmatchedPayments,
      unmatchedDebits: input.unmatchedDebits,
      unmatchedCredits: input.unmatchedCredits,
      allBankDebits: input.allBankDebits,
      allBankCredits: input.allBankCredits,
      broughtForwardReceiptLodgmentsTotal: input.broughtForwardReceiptLodgmentsTotal,
      broughtForwardUnpresentedTotal: input.broughtForwardUnpresentedTotal,
      amountTolerance: input.amountTolerance,
    })
    return {
      uncreditedRows: gt.uncreditedRows,
      unpresentedRows: gt.unpresentedRows,
      uncreditedLodgmentsTimingTotal: gt.uncreditedLodgmentsTimingTotal,
      unpresentedChequesTotal: gt.unpresentedChequesTotal,
    }
  }

  if (input.rawUnmatchedTiming) {
    const uncreditedRows = input.unmatchedReceipts
    const unpresentedRows = input.unmatchedPayments
    return {
      uncreditedRows,
      unpresentedRows,
      uncreditedLodgmentsTimingTotal:
        sumAmounts(uncreditedRows) + input.broughtForwardReceiptLodgmentsTotal,
      unpresentedChequesTotal:
        sumAmounts(unpresentedRows) + input.broughtForwardUnpresentedTotal,
    }
  }

  if (input.ecobank) {
    const uncreditedRows = input.unmatchedReceipts
    return {
      uncreditedRows,
      unpresentedRows: input.ecobankUnpresentedRows ?? [],
      uncreditedLodgmentsTimingTotal:
        sumAmounts(uncreditedRows) + input.broughtForwardReceiptLodgmentsTotal,
      unpresentedChequesTotal:
        input.ecobankUnpresentedTotal ??
        sumAmounts(input.ecobankUnpresentedRows ?? []) + input.broughtForwardUnpresentedTotal,
    }
  }

  const tol = input.amountTolerance ?? 0.01
  const uncreditedRows = input.unmatchedReceipts.filter(
    (r) =>
      !isBankStatementMirrorReceipt(r, input.unmatchedDebits, input.unmatchedCredits, tol)
  )
  const unpresentedRows = input.unmatchedPayments.filter(
    (p) =>
      !paymentHasBankDebitCounterpart(p, input.allBankDebits, tol) &&
      !paymentHasBankCreditCounterpart(p, input.allBankCredits, tol)
  )
  return {
    uncreditedRows,
    unpresentedRows,
    uncreditedLodgmentsTimingTotal:
      sumAmounts(uncreditedRows) + input.broughtForwardReceiptLodgmentsTotal,
    unpresentedChequesTotal: sumAmounts(unpresentedRows) + input.broughtForwardUnpresentedTotal,
  }
}

export function currentPeriodTimingTotal(rows: BrsTimingTx[]): number {
  return sumAmounts(rows)
}
