/**
 * SQL-bounded transaction loads for reconcile GET — avoid loading the full
 * document→transactions graph into memory then truncating.
 */
import { prisma } from '../lib/prisma.js'
import type { Tx } from './matching.js'
import { resolveReconcileMaxLimit } from '../config/importLimits.js'

const TX_SELECT = {
  id: true,
  date: true,
  name: true,
  details: true,
  docRef: true,
  chqNo: true,
  amount: true,
} as const

export function toReconcileTx(t: {
  id: string
  date: Date | null
  name: string | null
  details: string | null
  docRef: string | null
  chqNo: string | null
  amount: unknown
}): Tx {
  return {
    id: t.id,
    date: t.date,
    name: t.name,
    details: t.details,
    amount: Number(t.amount),
    docRef: t.docRef,
    chqNo: t.chqNo,
  }
}

export type LaneLoadResult = {
  full: Tx[]
  display: Tx[]
  truncated: boolean
  totalCount: number
}

/**
 * Count + take for one reconcile lane (receipts / credits / payments / debits).
 * Matching uses up to RECONCILE_MAX_LIMIT rows; display is further capped to perCategory.
 */
export async function loadReconcileLane(opts: {
  documentIds: string[]
  perCategory: number
}): Promise<LaneLoadResult> {
  const { documentIds, perCategory } = opts
  if (!documentIds.length) {
    return { full: [], display: [], truncated: false, totalCount: 0 }
  }

  const totalCount = await prisma.transaction.count({
    where: { documentId: { in: documentIds } },
  })
  const matchTake = Math.min(totalCount, resolveReconcileMaxLimit())
  const rows =
    matchTake === 0
      ? []
      : await prisma.transaction.findMany({
          where: { documentId: { in: documentIds } },
          orderBy: [{ date: 'asc' }, { rowIndex: 'asc' }],
          take: matchTake,
          select: TX_SELECT,
        })

  const full = rows.map(toReconcileTx)
  const truncated = totalCount > perCategory
  const display = full.slice(0, perCategory)
  return { full, display, truncated, totalCount }
}

/** Fill in matched txs that fell outside the lane take window (for match list display). */
export async function loadTransactionsByIds(ids: string[]): Promise<Tx[]> {
  if (!ids.length) return []
  const unique = [...new Set(ids)]
  const rows = await prisma.transaction.findMany({
    where: { id: { in: unique } },
    select: TX_SELECT,
  })
  return rows.map(toReconcileTx)
}

/** Fast per-lane counts without loading rows (for limit resolution). */
export async function countReconcileLanes(opts: {
  receiptDocIds: string[]
  paymentDocIds: string[]
  creditDocIds: string[]
  debitDocIds: string[]
}): Promise<[number, number, number, number]> {
  const count = (ids: string[]) =>
    ids.length
      ? prisma.transaction.count({ where: { documentId: { in: ids } } })
      : Promise.resolve(0)
  const [r, p, c, d] = await Promise.all([
    count(opts.receiptDocIds),
    count(opts.paymentDocIds),
    count(opts.creditDocIds),
    count(opts.debitDocIds),
  ])
  return [r, c, p, d]
}
