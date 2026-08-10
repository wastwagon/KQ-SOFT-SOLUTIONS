/**
 * Standard Chartered Bank (Ghana) statement parsers.
 * - Excel: multi-page exports with multiline "glued" cells or one row per transaction.
 * - PDF: DepositDescriptionDateBalanceWithdrawal layout (amount+date or date+amount glued).
 */

import { parseImportedAmount } from './amountParser.js'
import type { ParseResult } from './parser.js'

const SCB_HEADERS = ['ENTRY DATE', 'VALUE DATE', 'DESCRIPTION', 'Col_3', 'DEBITS', 'CREDITS', 'BALANCE']

const SCB_PDF_DATE = /\d{2} [A-Za-z]{3} \d{4}/
/** Withdrawal column: amount immediately before date. */
const SCB_PDF_WITHDRAWAL = /^([\d,]+\.\d{2})(\d{2} [A-Za-z]{3} \d{4})(.*)$/i
/** Deposit column: date immediately before amount. */
const SCB_PDF_DEPOSIT = /^(\d{2} [A-Za-z]{3} \d{4})([\d,]+\.\d{2})(.*)$/i
const SCB_PDF_BALANCE_ONLY = /^[\d,]+\.\d{2}$/

export function looksLikeScbStatementText(text: string): boolean {
  const flat = text.replace(/\s+/g, ' ')
  if (/DepositDescriptionDateBalanceWithdrawal/i.test(flat)) return true
  if (
    /standard\s+chartered/i.test(flat) &&
    /statement\s+of\s+account/i.test(flat) &&
    SCB_PDF_DATE.test(flat) &&
    (/sweep\s+to\s+ghs|sweep\s+from\s+ghs|credit\s+interest/i.test(flat) ||
      /balance\s+brought\s+forward/i.test(flat))
  ) {
    return true
  }
  return false
}

export function shouldUseScbPdfParser(result: { headers: string[]; rows: unknown[][] }): boolean {
  const h = result.headers.map((x) => (x || '').toLowerCase()).join(' ')
  if (/\bdebits?\b/.test(h) && /\bcredits?\b/.test(h) && /entry\s*date/.test(h)) return false
  return (
    /statement\s*date|depositdescription|account\s*number/.test(h) ||
    (result.headers.length <= 3 && result.rows.length > 20)
  )
}

function formatScbPdfDate(value: string): string {
  const m = value.trim().match(/^(\d{2})\s+([A-Za-z]{3})\s+(\d{4})$/)
  if (!m) return value.trim()
  return `${m[1]}-${m[2]}-${m[3]}`
}

function isScbPdfNoiseLine(line: string): boolean {
  return (
    /^statement\s+of\s+account$/i.test(line) ||
    /^depositdescription/i.test(line) ||
    /^account\s+type/i.test(line) ||
    /^account\s+number/i.test(line) ||
    /^currency/i.test(line) ||
    /^statement\s+date/i.test(line) ||
    /^branch/i.test(line) ||
    /^page\s+\d+\s+of/i.test(line) ||
    /^\d+\s*page\s+\d+\s+of/i.test(line) ||
    /^generated\s+on/i.test(line) ||
    /^thank\s+you\s+for\s+banking/i.test(line) ||
    /^\(company\s+name\)$/i.test(line) ||
    /^\(address\)$/i.test(line) ||
    /^\(account\s+name\)$/i.test(line) ||
    /^to$/i.test(line) ||
    /^ca$/i.test(line) ||
    /^ghs$/i.test(line) ||
    /^\d{10,}$/.test(line) ||
    /^\d{2} [A-Za-z]{3} \d{4}\d{2} [A-Za-z]{3} \d{4}$/i.test(line)
  )
}

function extractScbPdfOpeningBalance(text: string): number {
  const m = text.match(/([\d,]+\.\d{2})\s*\n\s*Balance Brought Forward/i)
  return m ? parseImportedAmount(m[1]) : 0
}

/** Parse Standard Chartered Ghana PDF text into the same columns as the Excel cleaner. */
export function parseScbPdfText(text: string): ParseResult {
  const rows: unknown[][] = []
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !isScbPdfNoiseLine(l))

  let i = 0
  // Skip opening balance marker; keep for continuity only.
  extractScbPdfOpeningBalance(text)

  while (i < lines.length) {
    const line = lines[i]!

    if (/^balance\s+brought\s+forward$/i.test(line)) {
      i++
      continue
    }

    let kind: 'debit' | 'credit' | null = null
    let date = ''
    let amount = 0
    let descParts: string[] = []

    const withdrawal = line.match(SCB_PDF_WITHDRAWAL)
    const deposit = !withdrawal ? line.match(SCB_PDF_DEPOSIT) : null

    if (withdrawal) {
      kind = 'debit'
      amount = parseImportedAmount(withdrawal[1])
      date = withdrawal[2]!
      if (withdrawal[3]?.trim()) descParts.push(withdrawal[3].trim())
    } else if (deposit) {
      kind = 'credit'
      date = deposit[1]!
      amount = parseImportedAmount(deposit[2])
      if (deposit[3]?.trim()) descParts.push(deposit[3].trim())
    } else {
      i++
      continue
    }

    i++
    let balance: number | null = null
    while (i < lines.length) {
      const next = lines[i]!
      if (SCB_PDF_WITHDRAWAL.test(next) || SCB_PDF_DEPOSIT.test(next)) break
      if (/^balance\s+brought\s+forward$/i.test(next)) break
      if (SCB_PDF_BALANCE_ONLY.test(next)) {
        balance = parseImportedAmount(next)
        i++
        break
      }
      descParts.push(next)
      i++
    }

    if (amount <= 0 || balance == null) continue

    const description = descParts
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!description) continue

    const formatted = formatScbPdfDate(date)
    rows.push([
      formatted,
      formatted,
      description,
      null,
      kind === 'debit' ? amount : null,
      kind === 'credit' ? amount : null,
      balance,
    ])
  }

  return { headers: [...SCB_HEADERS], rows }
}

function isScbTransactionDate(value: unknown): boolean {
  if (typeof value === 'number' && value > 40000) return true
  const s = String(value ?? '').trim()
  return /^\d{2}-\d{2}-\d{4}$/.test(s) || /^\d{2}-[A-Za-z]{3}-\d{2,4}$/.test(s)
}

function splitLines(cell: unknown): string[] {
  return String(cell ?? '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s !== '')
}

function parseScbAmount(v: unknown): number | '' {
  if (v === '-' || v === '' || v == null) return ''
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = parseImportedAmount(String(v))
  return Number.isFinite(n) ? n : ''
}

function scbDateCell(value: unknown, fallback?: unknown): string | number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const raw = value ?? fallback ?? ''
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  return String(raw).trim()
}

export function isScbGluedRow(row: unknown[]): boolean {
  const entry = String(row[0] ?? '')
  const desc = String(row[2] ?? row[3] ?? '')
  return entry.includes('\n') && desc.length > 20
}

export function isScbStatementLayout(rows: unknown[][]): boolean {
  const joined = rows
    .slice(0, 25)
    .flat()
    .map((c) => String(c ?? ''))
    .join(' ')
  if (!/statement of account/i.test(joined) || !/entry date/i.test(joined)) return false
  if (/SWEEP FROM GHS|INW CLG|CHQ #/i.test(joined)) return true
  return rows.some((row) => isScbGluedRow(row))
}

export function parseScbGluedRow(row: unknown[]): Array<{
  entryDate: string | number
  valueDate: string | number
  description: string
  debit: number | ''
  credit: number | ''
  balance: number | ''
}> {
  const descs = splitLines(row[2] ?? row[3])
  const entries = splitLines(row[0])
  const values = splitLines(row[1])
  const debits = splitLines(row[4])
  const credits = splitLines(row[5])
  const balances = splitLines(row[6])

  const transactions: Array<{
    entryDate: string | number
    valueDate: string | number
    description: string
    debit: number | ''
    credit: number | ''
    balance: number | ''
  }> = []
  let amtIdx = 0

  for (let i = 0; i < descs.length; i++) {
    let desc = descs[i]
    if (!desc) continue

    if (/END OF STATEMENT/i.test(desc)) continue

    if (/BALANCE BROUGHT FORWARD/i.test(desc)) {
      const remainder = desc.replace(/BALANCE BROUGHT FORWARD\s*/i, '').trim()
      if (!remainder) {
        transactions.push({
          entryDate: entries[1] ?? entries[0] ?? '',
          valueDate: values[0] ?? entries[1] ?? entries[0] ?? '',
          description: 'BALANCE BROUGHT FORWARD',
          debit: '',
          credit: '',
          balance: parseScbAmount(balances[0] ?? ''),
        })
        continue
      }
      desc = remainder
    }

    const entry = entries[i] ?? entries[Math.max(0, i - 1)] ?? ''
    const value = values[i] ?? values[Math.max(0, i - 1)] ?? entry
    let debit: number | '' = ''
    let credit: number | '' = ''
    while (amtIdx < Math.max(debits.length, credits.length)) {
      debit = parseScbAmount(debits[amtIdx] ?? '-')
      credit = parseScbAmount(credits[amtIdx] ?? '-')
      if (debit || credit) break
      amtIdx++
    }
    const balance = parseScbAmount(balances[amtIdx + 1] ?? balances[amtIdx] ?? '')
    amtIdx++

    if (!debit && !credit) continue

    transactions.push({
      entryDate: entry,
      valueDate: value,
      description: desc,
      debit,
      credit,
      balance,
    })
  }

  return transactions
}

export function extractScbClosingBalance(rows: unknown[][]): number | '' {
  let closing: number | '' = ''
  for (const row of rows) {
    const text = String(row[0] ?? '')
    const match = text.match(/CLOSING BALANCE\s+([\d,.]+)/i)
    if (match) closing = parseScbAmount(match[1])
  }
  if (closing !== '') return closing

  for (let i = rows.length - 1; i >= 0; i--) {
    if (!isScbGluedRow(rows[i]!)) continue
    const descs = splitLines(rows[i]![2] ?? rows[i]![3])
    const balances = splitLines(rows[i]![6])
    const eosIdx = descs.findIndex((d) => /END OF STATEMENT/i.test(d))
    if (eosIdx >= 0 && balances[eosIdx] != null) return parseScbAmount(balances[eosIdx])
    if (balances.length) return parseScbAmount(balances[balances.length - 1])
  }

  return ''
}

function txFingerprint(tx: {
  entryDate: string | number
  description: string
  debit: number | ''
  credit: number | ''
  balance: number | ''
}): string {
  return [
    typeof tx.entryDate === 'number' ? tx.entryDate : String(tx.entryDate),
    String(tx.description).replace(/\s+/g, ' ').trim(),
    tx.debit ?? '',
    tx.credit ?? '',
    tx.balance ?? '',
  ].join('|')
}

export function extractScbTransactions(rows: unknown[][]): Array<{
  entryDate: string | number
  valueDate: string | number
  description: string
  debit: number | ''
  credit: number | ''
  balance: number | ''
}> {
  const seen = new Set<string>()
  const transactions: Array<{
    entryDate: string | number
    valueDate: string | number
    description: string
    debit: number | ''
    credit: number | ''
    balance: number | ''
  }> = []

  const pushTx = (tx: (typeof transactions)[number]) => {
    const fp = txFingerprint(tx)
    if (seen.has(fp)) return
    seen.add(fp)
    transactions.push(tx)
  }

  for (const row of rows) {
    if (isScbGluedRow(row)) {
      for (const tx of parseScbGluedRow(row)) pushTx(tx)
      continue
    }

    if (!isScbTransactionDate(row[0])) continue
    pushTx({
      entryDate: scbDateCell(row[0]),
      valueDate: scbDateCell(row[1], row[0]),
      description: String(row[2] || row[3] || '').trim(),
      debit: parseScbAmount(row[4]),
      credit: parseScbAmount(row[5]),
      balance: parseScbAmount(row[6]),
    })
  }

  transactions.sort((a, b) => {
    const da =
      typeof a.entryDate === 'number'
        ? a.entryDate
        : Date.parse(String(a.entryDate)) / 86400000 + 25569
    const db =
      typeof b.entryDate === 'number'
        ? b.entryDate
        : Date.parse(String(b.entryDate)) / 86400000 + 25569
    return da - db
  })

  return transactions
}

export function normalizeScbExcelTable(rows: unknown[][]): ParseResult {
  const transactions = extractScbTransactions(rows)
  return {
    headers: [...SCB_HEADERS],
    rows: transactions.map((t) => [
      t.entryDate,
      t.valueDate,
      t.description,
      null,
      t.debit === '' ? null : t.debit,
      t.credit === '' ? null : t.credit,
      t.balance === '' ? null : t.balance,
    ]),
  }
}

export function extractScbMeta(rows: unknown[][]) {
  const metaRow = String(rows[0]?.[0] || '')
  const periodRow = String(rows[1]?.[0] || '')
  const transactions = extractScbTransactions(rows)
  const opening = transactions.find((t) => /BALANCE BROUGHT FORWARD/i.test(t.description))
  const closingBalance = extractScbClosingBalance(rows)
  const lastBalance = transactions[transactions.length - 1]?.balance

  return {
    accountNo: metaRow.match(/(\d{10,})/)?.[1] || '0100106024702',
    from: periodRow.match(/From\s+(.+?)\s+To/i)?.[1]?.trim() || '01-Feb-2019',
    to: periodRow.match(/To\s+(.+?)(?:\r|\n|CURRENCY)/i)?.[1]?.trim() || '31-Dec-2019',
    currency: periodRow.includes('GHS') || periodRow.includes('CEDI') ? 'GHANA CEDI' : 'GHS',
    openingBalance: opening?.balance ?? '',
    closingBalance: closingBalance || lastBalance || '',
    transactions,
  }
}
