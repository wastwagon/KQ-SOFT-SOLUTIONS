/**
 * Shared transaction date order for Reconcile + Clean tools.
 * Default: oldest first (cash book / BRS practice). Optional newest first for scanning.
 */
import type { Tx } from '../components/reconcile/types'

export type DateOrder = 'oldest_first' | 'newest_first'

/** Canonical preference key (shared by Reconcile and Clean). */
export const DATE_ORDER_STORAGE_KEY = 'brs.transaction.dateOrder'
/** Legacy key from reconcile-only toggle — still read for migration. */
const LEGACY_DATE_ORDER_STORAGE_KEY = 'brs.reconcile.dateOrder'

function readValidOrder(raw: string | null): DateOrder | null {
  if (raw === 'newest_first' || raw === 'oldest_first') return raw
  return null
}

export function getStoredDateOrder(): DateOrder {
  try {
    const current = readValidOrder(localStorage.getItem(DATE_ORDER_STORAGE_KEY))
    if (current) return current
    const legacy = readValidOrder(localStorage.getItem(LEGACY_DATE_ORDER_STORAGE_KEY))
    if (legacy) {
      localStorage.setItem(DATE_ORDER_STORAGE_KEY, legacy)
      return legacy
    }
  } catch {
    /* ignore */
  }
  return 'oldest_first'
}

export function setStoredDateOrder(order: DateOrder): void {
  try {
    localStorage.setItem(DATE_ORDER_STORAGE_KEY, order)
    localStorage.removeItem(LEGACY_DATE_ORDER_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function compareDatesAscending(
  a: Date | string | null | undefined,
  b: Date | string | null | undefined
): number {
  const ta = a ? new Date(a).getTime() : NaN
  const tb = b ? new Date(b).getTime() : NaN
  const aOk = Number.isFinite(ta)
  const bOk = Number.isFinite(tb)
  if (aOk && bOk) return ta - tb
  if (aOk) return -1
  if (bOk) return 1
  return 0
}

export function compareDatesNewestFirst(
  a: Date | string | null | undefined,
  b: Date | string | null | undefined
): number {
  const ta = a ? new Date(a).getTime() : NaN
  const tb = b ? new Date(b).getTime() : NaN
  const aOk = Number.isFinite(ta)
  const bOk = Number.isFinite(tb)
  if (aOk && bOk) return tb - ta
  if (aOk) return -1
  if (bOk) return 1
  return 0
}

/** Sort by date; default oldest first. Stable on equal dates via original index. */
export function sortTxsByDate<T extends Pick<Tx, 'date'>>(
  txs: T[],
  order: DateOrder = 'oldest_first'
): T[] {
  const cmp = order === 'newest_first' ? compareDatesNewestFirst : compareDatesAscending
  return txs
    .map((t, index) => ({ t, index }))
    .sort((a, b) => {
      const byDate = cmp(a.t.date, b.t.date)
      if (byDate !== 0) return byDate
      return a.index - b.index
    })
    .map((x) => x.t)
}

export function dateOrderLabel(order: DateOrder): string {
  return order === 'newest_first' ? 'Newest date first' : 'Oldest date first'
}
