/**
 * Suggested journal entries from BRS exception schedules.
 * Timing differences (uncredited / unpresented) and bank-only items
 * that typically need GL postings or memo entries.
 */

export type JournalSourceRow = {
  date?: string | null
  name?: string | null
  details?: string | null
  chqNo?: string | null
  docRef?: string | null
  amount: number
}

export type JournalCategory =
  | 'uncredited_lodgment'
  | 'unpresented_cheque'
  | 'bank_only_debit'
  | 'bank_only_credit'

export type SuggestedJournalLine = {
  entryId: string
  line: 1 | 2
  date: string
  accountCode: string
  accountName: string
  debit: number
  credit: number
  narration: string
  category: JournalCategory
  categoryLabel: string
  ref: string
  currency: string
}

const CATEGORY_LABEL: Record<JournalCategory, string> = {
  uncredited_lodgment: 'Uncredited lodgment / uncleared deposit',
  unpresented_cheque: 'Unpresented cheque / uncleared payment',
  bank_only_debit: 'Bank-only debit (e.g. charges)',
  bank_only_credit: 'Bank-only credit (e.g. interest)',
}

/** Standard Ghana chart suggestions — adjust in GL as needed. */
const ACCOUNTS: Record<
  JournalCategory,
  { debit: { code: string; name: string }; credit: { code: string; name: string } }
> = {
  uncredited_lodgment: {
    debit: { code: '1100', name: 'Bank' },
    credit: { code: '1150', name: 'Uncleared deposits (timing)' },
  },
  unpresented_cheque: {
    debit: { code: '2150', name: 'Uncleared payments (timing)' },
    credit: { code: '1100', name: 'Bank' },
  },
  bank_only_debit: {
    debit: { code: '6100', name: 'Bank charges / fees' },
    credit: { code: '1100', name: 'Bank' },
  },
  bank_only_credit: {
    debit: { code: '1100', name: 'Bank' },
    credit: { code: '4100', name: 'Bank interest / other income' },
  },
}

function csvEscape(value: string | number): string {
  const s = String(value ?? '')
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function narrationFor(row: JournalSourceRow, category: JournalCategory): string {
  const bits = [row.name, row.details].filter((x) => x && x !== '—')
  const base = bits.join(' — ') || CATEGORY_LABEL[category]
  return base.slice(0, 200)
}

function refFor(row: JournalSourceRow): string {
  return (row.chqNo || row.docRef || '').trim()
}

function linesForEntry(
  entryId: string,
  category: JournalCategory,
  row: JournalSourceRow,
  currency: string
): SuggestedJournalLine[] {
  const amount = Math.abs(Number(row.amount) || 0)
  if (amount < 0.00001) return []
  const accts = ACCOUNTS[category]
  const narration = narrationFor(row, category)
  const date = row.date || ''
  const ref = refFor(row)
  return [
    {
      entryId,
      line: 1,
      date,
      accountCode: accts.debit.code,
      accountName: accts.debit.name,
      debit: amount,
      credit: 0,
      narration,
      category,
      categoryLabel: CATEGORY_LABEL[category],
      ref,
      currency,
    },
    {
      entryId,
      line: 2,
      date,
      accountCode: accts.credit.code,
      accountName: accts.credit.name,
      debit: 0,
      credit: amount,
      narration,
      category,
      categoryLabel: CATEGORY_LABEL[category],
      ref,
      currency,
    },
  ]
}

export type SuggestedJournalsInput = {
  currency: string
  uncreditedLodgments?: JournalSourceRow[]
  unpresentedCheques?: JournalSourceRow[]
  bankOnlyDebits?: JournalSourceRow[]
  bankOnlyCredits?: JournalSourceRow[]
}

/** Build balanced double-entry lines from BRS exception schedules. */
export function buildSuggestedJournalLines(input: SuggestedJournalsInput): SuggestedJournalLine[] {
  const currency = (input.currency || 'GHS').toUpperCase()
  const out: SuggestedJournalLine[] = []
  let n = 0

  const push = (category: JournalCategory, rows: JournalSourceRow[] | undefined) => {
    for (const row of rows || []) {
      n += 1
      const entryId = `JE-${String(n).padStart(4, '0')}`
      out.push(...linesForEntry(entryId, category, row, currency))
    }
  }

  push('uncredited_lodgment', input.uncreditedLodgments)
  push('unpresented_cheque', input.unpresentedCheques)
  push('bank_only_debit', input.bankOnlyDebits)
  push('bank_only_credit', input.bankOnlyCredits)

  return out
}

const CSV_HEADERS = [
  'EntryId',
  'Line',
  'Date',
  'AccountCode',
  'AccountName',
  'Debit',
  'Credit',
  'Narration',
  'Category',
  'CategoryLabel',
  'Ref',
  'Currency',
] as const

export function suggestedJournalsToCsv(lines: SuggestedJournalLine[]): string {
  const rows = [CSV_HEADERS.join(',')]
  for (const line of lines) {
    rows.push(
      [
        line.entryId,
        line.line,
        line.date,
        line.accountCode,
        line.accountName,
        line.debit.toFixed(2),
        line.credit.toFixed(2),
        line.narration,
        line.category,
        line.categoryLabel,
        line.ref,
        line.currency,
      ]
        .map(csvEscape)
        .join(',')
    )
  }
  return rows.join('\n') + '\n'
}

export function buildSuggestedJournalsCsv(input: SuggestedJournalsInput): string {
  return suggestedJournalsToCsv(buildSuggestedJournalLines(input))
}
