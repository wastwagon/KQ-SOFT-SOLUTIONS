/**
 * Map-step file status for every project (not a single specimen).
 * Uses parse status + extracted transaction counts from GET /projects/:id.
 */

export type MapListDoc = {
  id: string
  filename: string
  type: string
  parseStatus?: string
  parseStatusMessage?: string | null
  _count?: { transactions?: number }
}

export type MapFileStatus = 'queued' | 'parsing' | 'failed' | 'mapped' | 'needs_mapping'

const TYPE_ORDER = ['cash_book_receipts', 'cash_book_payments', 'bank_credits', 'bank_debits']

export function formatMapDocType(type: string): string {
  switch (type) {
    case 'cash_book_receipts':
      return 'receipts'
    case 'cash_book_payments':
      return 'payments'
    case 'bank_credits':
      return 'credits'
    case 'bank_debits':
      return 'debits'
    default:
      return type.replace(/_/g, ' ')
  }
}

export function docTransactionCount(d: MapListDoc): number {
  return typeof d._count?.transactions === 'number' ? d._count.transactions : 0
}

export function isDocParsing(d: MapListDoc): boolean {
  return d.parseStatus === 'pending' || d.parseStatus === 'processing'
}

export function isDocMapped(d: MapListDoc): boolean {
  return !isDocParsing(d) && d.parseStatus !== 'failed' && docTransactionCount(d) > 0
}

export function autoMapSkippedNeedsManual(d: MapListDoc): boolean {
  return (
    d.parseStatus === 'ready' &&
    Boolean(d.parseStatusMessage) &&
    /map them on this page|map manually|not a recognised|not certain/i.test(d.parseStatusMessage || '')
  )
}

export function mapFileStatus(d: MapListDoc): MapFileStatus {
  if (d.parseStatus === 'pending') return 'queued'
  if (d.parseStatus === 'processing') return 'parsing'
  if (d.parseStatus === 'failed') return 'failed'
  if (isDocMapped(d)) return 'mapped'
  return 'needs_mapping'
}

export function mappedCountSummary(docs: MapListDoc[]): string {
  const ordered = [...docs].sort(
    (a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type)
  )
  return ordered
    .filter((d) => isDocMapped(d))
    .map((d) => `${docTransactionCount(d)} ${formatMapDocType(d.type)}`)
    .join(', ')
}

export function hasCashBookDocs(docs: MapListDoc[]): boolean {
  return docs.some((d) => d.type.startsWith('cash_book_'))
}

export function hasBankDocs(docs: MapListDoc[]): boolean {
  return docs.some((d) => d.type === 'bank_credits' || d.type === 'bank_debits')
}

/** Tick unmapped/parsing files; leave already-mapped files off unless the user kept them ticked. */
export function nextBulkSelection(input: {
  docs: MapListDoc[]
  prevSelected: Set<string>
  previousDocIds: string[]
  prevTxnCounts: Record<string, number>
}): Set<string> {
  const { docs, prevSelected, previousDocIds, prevTxnCounts } = input
  const oldIds = new Set(previousDocIds.filter(Boolean))
  const next = new Set<string>()
  const firstLoad = previousDocIds.length === 0

  if (firstLoad) {
    for (const d of docs) {
      if (isDocParsing(d) || !isDocMapped(d)) next.add(d.id)
    }
    return next
  }

  for (const d of docs) {
    const n = docTransactionCount(d)
    if (!oldIds.has(d.id)) {
      if (isDocParsing(d) || !isDocMapped(d)) next.add(d.id)
      continue
    }
    if (!prevSelected.has(d.id)) continue
    if (prevTxnCounts[d.id] === 0 && n > 0) continue
    next.add(d.id)
  }
  return next
}

export function sameIdSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const id of a) if (!b.has(id)) return false
  return true
}
