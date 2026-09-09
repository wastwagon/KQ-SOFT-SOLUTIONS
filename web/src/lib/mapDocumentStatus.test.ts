import { describe, expect, it } from 'vitest'
import {
  formatMapDocType,
  hasBankDocs,
  hasCashBookDocs,
  isDocMapped,
  mappedCountSummary,
  mapFileStatus,
  nextBulkSelection,
} from './mapDocumentStatus'

function doc(
  partial: Partial<{
    id: string
    filename: string
    type: string
    parseStatus: string
    parseStatusMessage: string | null
    tx: number
  }>
) {
  return {
    id: partial.id ?? 'd1',
    filename: partial.filename ?? 'file.xlsx',
    type: partial.type ?? 'cash_book_receipts',
    parseStatus: partial.parseStatus,
    parseStatusMessage: partial.parseStatusMessage,
    _count: { transactions: partial.tx ?? 0 },
  }
}

describe('mapFileStatus', () => {
  it('treats extracted rows as mapped on any project', () => {
    expect(mapFileStatus(doc({ tx: 20, parseStatus: 'ready' }))).toBe('mapped')
    expect(isDocMapped(doc({ tx: 20, parseStatus: 'ready' }))).toBe(true)
  })
  it('does not treat a parsing file as mapped even if count is still 0', () => {
    expect(mapFileStatus(doc({ tx: 0, parseStatus: 'processing' }))).toBe('parsing')
    expect(isDocMapped(doc({ tx: 0, parseStatus: 'processing' }))).toBe(false)
  })
  it('flags ready files with no rows as needing mapping', () => {
    expect(mapFileStatus(doc({ tx: 0, parseStatus: 'ready' }))).toBe('needs_mapping')
  })
})

describe('nextBulkSelection', () => {
  const mapped = [
    doc({ id: 'r', type: 'cash_book_receipts', tx: 20, parseStatus: 'ready' }),
    doc({ id: 'p', type: 'cash_book_payments', tx: 9, parseStatus: 'ready' }),
    doc({ id: 'c', type: 'bank_credits', tx: 2, parseStatus: 'ready' }),
    doc({ id: 'd', type: 'bank_debits', tx: 8, parseStatus: 'ready' }),
  ]

  it('first load: leaves already-mapped files unticked', () => {
    const next = nextBulkSelection({
      docs: mapped,
      prevSelected: new Set(),
      previousDocIds: [],
      prevTxnCounts: {},
    })
    expect([...next]).toEqual([])
  })

  it('first load: ticks files that still need mapping or are parsing', () => {
    const docs = [
      doc({ id: 'a', tx: 0, parseStatus: 'ready' }),
      doc({ id: 'b', tx: 0, parseStatus: 'processing' }),
      doc({ id: 'c', tx: 12, parseStatus: 'ready' }),
    ]
    const next = nextBulkSelection({
      docs,
      prevSelected: new Set(),
      previousDocIds: [],
      prevTxnCounts: {},
    })
    expect(next.has('a')).toBe(true)
    expect(next.has('b')).toBe(true)
    expect(next.has('c')).toBe(false)
  })

  it('unticks a file after auto-map fills transactions', () => {
    const docs = [doc({ id: 'a', tx: 15, parseStatus: 'ready' })]
    const next = nextBulkSelection({
      docs,
      prevSelected: new Set(['a']),
      previousDocIds: ['a'],
      prevTxnCounts: { a: 0 },
    })
    expect(next.has('a')).toBe(false)
  })

  it('ticks a newly uploaded unmapped file without reticking mapped ones', () => {
    const docs = [
      doc({ id: 'old', tx: 10, parseStatus: 'ready' }),
      doc({ id: 'new', tx: 0, parseStatus: 'ready' }),
    ]
    const next = nextBulkSelection({
      docs,
      prevSelected: new Set(),
      previousDocIds: ['old'],
      prevTxnCounts: { old: 10 },
    })
    expect(next.has('old')).toBe(false)
    expect(next.has('new')).toBe(true)
  })
})

describe('summaries', () => {
  it('lists mapped counts in a stable receipts/payments/credits/debits order', () => {
    const summary = mappedCountSummary([
      doc({ type: 'bank_debits', tx: 8, parseStatus: 'ready' }),
      doc({ type: 'cash_book_receipts', tx: 20, parseStatus: 'ready' }),
    ])
    expect(summary).toBe('20 receipts, 8 debits')
  })
  it('detects cash book vs bank families for incomplete projects', () => {
    expect(hasCashBookDocs([doc({ type: 'cash_book_payments' })])).toBe(true)
    expect(hasBankDocs([doc({ type: 'cash_book_payments' })])).toBe(false)
    expect(hasBankDocs([doc({ type: 'bank_credits' })])).toBe(true)
    expect(formatMapDocType('cash_book_receipts')).toBe('receipts')
  })
})
