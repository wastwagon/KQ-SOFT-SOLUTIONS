/**
 * BRS roll-forward: carry prior-period unpresented cheques into the current reconciliation.
 *
 * Uses Ecobank Ghana BRS unpresented rules (and optional workbook netting) for the source
 * period, then drops cheques that reappear in the current cash book or clear on the bank.
 */
import {
  type ClearingTxLike,
  bankAccountsForScope,
  brsTotalsExcludingLinkedClearingPairs,
  paymentHasBankCounterpart,
  resolveEcobankGhanaProfile,
} from './ecobankClearingMatcher.js'
import { unpresentedWithOptionalWorkbookNetting } from './ghanaBrsWorkbookNetting.js'

export interface BroughtForwardUnpresentedItem {
  date: string
  name: string
  chqNo: string | null
  amount: number
  fromProject: string
}

export interface RollForwardMatch {
  cb: ClearingTxLike
  bank: ClearingTxLike
}

export interface RollForwardProjectSnapshot {
  name: string
  bankAccounts: { name?: string | null; bankName?: string | null }[]
  payments: ClearingTxLike[]
  receipts: ClearingTxLike[]
  debits: ClearingTxLike[]
  credits: ClearingTxLike[]
  matchedCbIds: Set<string>
  matchedBankIds: Set<string>
  matchedPaymentDebits: { payment: ClearingTxLike; bankDebit: ClearingTxLike }[]
}

export interface RollForwardCurrentPeriod {
  payments: ClearingTxLike[]
  debits: ClearingTxLike[]
  credits: ClearingTxLike[]
}

export interface RollForwardOptions {
  workbookNetting?: boolean
  amountTolerance?: number
  /** When set, Ecobank profile detection uses only this bank account. */
  bankAccountId?: string
}

function amountsClose(a: number, b: number, tolerance: number): boolean {
  return Math.abs(a - b) <= tolerance
}

function normalizeChequeDigits(chqNo: string | null | undefined): string {
  const digits = String(chqNo || '').replace(/\D/g, '')
  if (!digits) return ''
  return digits.replace(/^0+/, '') || '0'
}

/** Stable key for the same physical cheque across periods (chq + amount). */
export function chequeRollForwardKey(
  chqNo: string | null | undefined,
  amount: number,
  amountTolerance = 0.01
): string | null {
  const digits = normalizeChequeDigits(chqNo)
  if (!digits) return null
  return `${digits}|${amount.toFixed(2)}`
}

function businessTransactionKey(tx: ClearingTxLike): string {
  const dStr = tx.date ? new Date(tx.date).toISOString().slice(0, 10) : ''
  return `${dStr}|${Number(tx.amount).toFixed(2)}|${(tx.chqNo || '').toLowerCase()}|${(tx.docRef || '').toLowerCase()}|${(tx.name || tx.details || '').toLowerCase().trim()}`
}

/** True when the same cheque (or exact business row) is already in the current-period cash book. */
export function paymentAppearsInCurrentPeriod(
  prior: ClearingTxLike,
  currentPayments: ClearingTxLike[],
  amountTolerance = 0.01
): boolean {
  const priorChqKey = chequeRollForwardKey(prior.chqNo, prior.amount, amountTolerance)
  if (priorChqKey) {
    return currentPayments.some(
      (p) => chequeRollForwardKey(p.chqNo, p.amount, amountTolerance) === priorChqKey
    )
  }
  const key = businessTransactionKey(prior)
  return currentPayments.some((p) => businessTransactionKey(p) === key)
}

/** True when the bank statement in the current period shows movement for this cheque. */
export function paymentClearedInCurrentPeriod(
  prior: ClearingTxLike,
  currentDebits: ClearingTxLike[],
  currentCredits: ClearingTxLike[],
  amountTolerance = 0.01
): boolean {
  return paymentHasBankCounterpart(prior, currentDebits, currentCredits, amountTolerance)
}

function fmtDate(d: Date | string | null | undefined): string {
  return d ? new Date(d).toISOString().slice(0, 10) : ''
}

function dedupeOutstandingRows(rows: ClearingTxLike[], amountTolerance = 0.01): ClearingTxLike[] {
  const seenChq = new Set<string>()
  const seenBiz = new Set<string>()
  const out: ClearingTxLike[] = []
  for (const row of rows) {
    const chqKey = chequeRollForwardKey(row.chqNo, row.amount, amountTolerance)
    if (chqKey) {
      if (seenChq.has(chqKey)) continue
      seenChq.add(chqKey)
      out.push(row)
      continue
    }
    const biz = businessTransactionKey(row)
    if (seenBiz.has(biz)) continue
    seenBiz.add(biz)
    out.push(row)
  }
  return out
}

function broughtForwardItemToTx(item: BroughtForwardUnpresentedItem): ClearingTxLike {
  return {
    id: `bf:${item.fromProject}:${item.chqNo || ''}:${item.amount}`,
    amount: item.amount,
    chqNo: item.chqNo,
    name: item.name,
    details: item.name,
    date: item.date,
    docRef: null,
  }
}

/**
 * Compute unpresented cheque rows for a closed period snapshot (Ecobank-aware).
 * Returns current-period rows only; nested brought-forward rows are passed separately.
 */
export function computeSnapshotUnpresentedRows(
  snapshot: RollForwardProjectSnapshot,
  nestedBroughtForwardTotal: number,
  options: RollForwardOptions = {}
): ClearingTxLike[] {
  const amountTolerance = options.amountTolerance ?? 0.01
  const unmatchedPayments = snapshot.payments.filter((p) => !snapshot.matchedCbIds.has(p.id))
  const unmatchedCredits = snapshot.credits.filter((c) => !snapshot.matchedBankIds.has(c.id))
  const clearingBrsTotals = brsTotalsExcludingLinkedClearingPairs(
    unmatchedPayments,
    unmatchedCredits,
    snapshot.debits,
    snapshot.credits,
    nestedBroughtForwardTotal,
    0,
    amountTolerance
  )
  const ecobankProfile = resolveEcobankGhanaProfile({
    bankAccounts: bankAccountsForScope(snapshot.bankAccounts, options.bankAccountId),
    sampleBankText: [...snapshot.credits, ...snapshot.debits]
      .slice(0, 12)
      .map((t) => [t.details, t.name].filter(Boolean).join(' '))
      .join('\n'),
    workbookNetting: options.workbookNetting,
  })
  const unpresentedResolved = unpresentedWithOptionalWorkbookNetting(
    ecobankProfile.workbookNetting,
    {
      total: clearingBrsTotals.unpresentedChequesTotal,
      rows: clearingBrsTotals.unpresentedChequeRows,
    },
    {
      unmatchedPayments,
      unmatchedDebits: snapshot.debits.filter((d) => !snapshot.matchedBankIds.has(d.id)),
      unmatchedCredits,
      allBankDebits: snapshot.debits,
      allBankCredits: snapshot.credits,
      broughtForwardUnpresentedTotal: nestedBroughtForwardTotal,
      allPayments: snapshot.payments,
      matchedPaymentDebits: snapshot.matchedPaymentDebits,
    }
  )
  if (ecobankProfile.active) {
    return unpresentedResolved.rows
  }
  return unmatchedPayments
}

/**
 * All cheque rows still outstanding at the end of the prior period (nested BF + period rows).
 */
export function listPriorOutstandingChequeRows(
  snapshot: RollForwardProjectSnapshot,
  nestedBroughtForward: BroughtForwardUnpresentedItem[],
  options: RollForwardOptions = {}
): ClearingTxLike[] {
  const nestedTotal = nestedBroughtForward.reduce((s, t) => s + t.amount, 0)
  const currentRows = computeSnapshotUnpresentedRows(snapshot, nestedTotal, options)
  return dedupeOutstandingRows(
    [...nestedBroughtForward.map(broughtForwardItemToTx), ...currentRows],
    options.amountTolerance ?? 0.01
  )
}

/**
 * BRS roll-forward unpresented cheques: prior outstanding rows minus current-period clearance.
 */
export function computeBroughtForwardUnpresented(
  priorSnapshot: RollForwardProjectSnapshot,
  nestedBroughtForward: BroughtForwardUnpresentedItem[],
  current: RollForwardCurrentPeriod,
  options: RollForwardOptions = {}
): BroughtForwardUnpresentedItem[] {
  const amountTolerance = options.amountTolerance ?? 0.01
  const outstanding = listPriorOutstandingChequeRows(
    priorSnapshot,
    nestedBroughtForward,
    options
  )
  return outstanding
    .filter((row) => !paymentAppearsInCurrentPeriod(row, current.payments, amountTolerance))
    .filter(
      (row) =>
        !paymentClearedInCurrentPeriod(row, current.debits, current.credits, amountTolerance)
    )
    .map((row) => ({
      date: fmtDate(row.date),
      name: row.name || row.details || '—',
      chqNo: row.chqNo || null,
      amount: row.amount,
      fromProject: priorSnapshot.name,
    }))
}

export function buildMatchedPaymentDebits(
  matchPairs: RollForwardMatch[],
  receiptIds: Set<string>,
  debitIds: Set<string>,
  creditIds: Set<string>
): { payment: ClearingTxLike; bankDebit: ClearingTxLike }[] {
  return matchPairs
    .filter((p) => !receiptIds.has(p.cb.id))
    .filter((p) => debitIds.has(p.bank.id) || creditIds.has(p.bank.id))
    .map((p) => ({ payment: p.cb, bankDebit: p.bank }))
}

export function buildRollForwardSnapshot(input: {
  name: string
  bankAccounts: { name?: string | null; bankName?: string | null }[]
  receipts: ClearingTxLike[]
  payments: ClearingTxLike[]
  debits: ClearingTxLike[]
  credits: ClearingTxLike[]
  matches: { matchItems: { transactionId: string; side: string }[] }[]
}): RollForwardProjectSnapshot {
  const matchedCbIds = new Set<string>()
  const matchedBankIds = new Set<string>()
  for (const m of input.matches) {
    for (const mi of m.matchItems) {
      if (mi.side === 'cash_book') matchedCbIds.add(mi.transactionId)
      else matchedBankIds.add(mi.transactionId)
    }
  }
  const allTxs = [...input.receipts, ...input.payments, ...input.credits, ...input.debits]
  const matchPairs = buildRollForwardMatchPairs(input.matches, allTxs)
  const receiptIds = new Set(input.receipts.map((t) => t.id))
  const debitIds = new Set(input.debits.map((t) => t.id))
  const creditIds = new Set(input.credits.map((t) => t.id))
  return {
    name: input.name,
    bankAccounts: input.bankAccounts,
    payments: input.payments,
    receipts: input.receipts,
    debits: input.debits,
    credits: input.credits,
    matchedCbIds,
    matchedBankIds,
    matchedPaymentDebits: buildMatchedPaymentDebits(matchPairs, receiptIds, debitIds, creditIds),
  }
}

export function buildRollForwardMatchPairs(
  matches: { matchItems: { transactionId: string; side: string }[] }[],
  allTxs: ClearingTxLike[]
): RollForwardMatch[] {
  const pairs: RollForwardMatch[] = []
  for (const m of matches) {
    const cbIds: string[] = []
    const bankIds: string[] = []
    for (const mi of m.matchItems) {
      const tx = allTxs.find((t) => t.id === mi.transactionId)
      if (!tx) continue
      if (mi.side === 'cash_book') cbIds.push(tx.id)
      else bankIds.push(tx.id)
    }
    const cbTxs = cbIds.map((id) => allTxs.find((t) => t.id === id)).filter(Boolean) as ClearingTxLike[]
    const bankTxs = bankIds
      .map((id) => allTxs.find((t) => t.id === id))
      .filter(Boolean) as ClearingTxLike[]
    if (cbTxs.length === 0 || bankTxs.length === 0) continue
    if (cbTxs.length === 1 && bankTxs.length >= 1) {
      bankTxs.forEach((bt) => pairs.push({ cb: cbTxs[0]!, bank: bt }))
    } else if (cbTxs.length >= 1 && bankTxs.length === 1) {
      cbTxs.forEach((ct) => pairs.push({ cb: ct, bank: bankTxs[0]! }))
    } else if (cbTxs.length === 1 && bankTxs.length === 1) {
      pairs.push({ cb: cbTxs[0]!, bank: bankTxs[0]! })
    } else {
      const n = Math.max(cbTxs.length, bankTxs.length)
      for (let i = 0; i < n; i++) {
        pairs.push({ cb: cbTxs[i % cbTxs.length]!, bank: bankTxs[i % bankTxs.length]! })
      }
    }
  }
  return pairs
}

/** Legacy lodgment roll-forward: unmatched receipts/credits not already in current period. */
export function filterBroughtForwardLodgments<T extends ClearingTxLike>(
  priorRows: T[],
  currentRows: T[]
): T[] {
  return priorRows.filter((t) => !paymentAppearsInCurrentPeriod(t, currentRows))
}

/**
 * Walk a oldest→newest project chain and return all cheques outstanding at the newest period end.
 */
export function computeOutstandingAtEndOfChain(
  chain: RollForwardProjectSnapshot[],
  options: RollForwardOptions = {}
): ClearingTxLike[] {
  let nested: BroughtForwardUnpresentedItem[] = []
  let outstanding: ClearingTxLike[] = []
  for (const snapshot of chain) {
    outstanding = listPriorOutstandingChequeRows(snapshot, nested, options)
    nested = outstanding.map((row) => ({
      date: fmtDate(row.date),
      name: row.name || row.details || '—',
      chqNo: row.chqNo || null,
      amount: row.amount,
      fromProject: snapshot.name,
    }))
  }
  return outstanding
}

export function outstandingRowsToBroughtForward(
  rows: ClearingTxLike[],
  fromProject: string
): BroughtForwardUnpresentedItem[] {
  return rows.map((row) => ({
    date: fmtDate(row.date),
    name: row.name || row.details || '—',
    chqNo: row.chqNo || null,
    amount: row.amount,
    fromProject,
  }))
}

export function applyCurrentPeriodRollForwardFilter(
  outstanding: ClearingTxLike[],
  current: RollForwardCurrentPeriod,
  fromProject: string,
  options: RollForwardOptions = {}
): BroughtForwardUnpresentedItem[] {
  const amountTolerance = options.amountTolerance ?? 0.01
  return outstanding
    .filter((row) => !paymentAppearsInCurrentPeriod(row, current.payments, amountTolerance))
    .filter(
      (row) =>
        !paymentClearedInCurrentPeriod(row, current.debits, current.credits, amountTolerance)
    )
    .map((row) => ({
      date: fmtDate(row.date),
      name: row.name || row.details || '—',
      chqNo: row.chqNo || null,
      amount: row.amount,
      fromProject,
    }))
}
