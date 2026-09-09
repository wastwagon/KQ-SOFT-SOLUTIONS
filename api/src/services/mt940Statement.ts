/**
 * SWIFT MT940 customer statement — structured export used across Africa and Europe.
 * One parser covers any bank that already mapped its columns into :61: / :86:.
 */
import fs from 'fs'
import type { ParseResult } from './parser.js'

export type StructuredParseResult = ParseResult & {
  openingBalance?: number | null
  closingBalance?: number | null
}

function parseSwiftAmount(raw: string): number {
  const s = raw.replace(/\s/g, '').trim()
  if (!s) return 0
  let n: number
  if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s)) {
    n = parseFloat(s.replace(/\./g, '').replace(',', '.'))
  } else if (/^\d+,\d{1,2}$/.test(s) || /^\d+,$/.test(s)) {
    n = parseFloat(s.replace(',', '.'))
  } else {
    n = parseFloat(s.replace(/,/g, ''))
  }
  return Number.isFinite(n) ? n : 0
}

function parseSwiftDate(yymmdd: string): string {
  if (!/^\d{6}$/.test(yymmdd)) return yymmdd
  const yy = Number(yymmdd.slice(0, 2))
  const year = yy >= 80 ? 1900 + yy : 2000 + yy
  return `${year}-${yymmdd.slice(2, 4)}-${yymmdd.slice(4, 6)}`
}

function parseBalanceField(value: string): number | null {
  const m = value.trim().match(/^([CD])(\d{6})([A-Z]{3})([\d.,]+)/i)
  if (!m) return null
  const amt = parseSwiftAmount(m[4]!)
  return m[1]!.toUpperCase() === 'D' ? -amt : amt
}

/** Split MT940 body into :tag: / value pairs (SWIFT envelope stripped). */
export function mt940Fields(text: string): Array<{ tag: string; value: string }> {
  let body = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const env = body.match(/\{4:\s*([\s\S]*?)(?:-\}|$)/)
  if (env) body = env[1]!
  const fields: Array<{ tag: string; value: string }> = []
  const re = /:(\d{2}[A-Z]?):/g
  const matches = [...body.matchAll(re)]
  for (let i = 0; i < matches.length; i++) {
    const tag = matches[i]![1]!
    const start = matches[i]!.index! + matches[i]![0].length
    const end = i + 1 < matches.length ? matches[i + 1]!.index! : body.length
    fields.push({ tag, value: body.slice(start, end).replace(/\n+/g, ' ').trim() })
  }
  return fields
}

export function looksLikeMt940(text: string): boolean {
  const t = text.slice(0, 8000)
  const has61 = /:61:/.test(t) || /:61:/.test(text)
  const hasHeader = /:20:/.test(t) || /:25:/.test(t) || /:60[FM]:/.test(t)
  return has61 && hasHeader
}

function parse61(value: string): {
  date: string
  debit: number | ''
  credit: number | ''
  ref: string
} | null {
  const m = value.match(
    /^(\d{6})(\d{4})?(R?C|R?D)([A-Z])?(\d[\d.,]*)([NFS])?([A-Z0-9]{3})?(.*)$/i
  )
  if (!m) return null
  const mark = m[3]!.toUpperCase()
  const amount = parseSwiftAmount(m[5]!)
  const isCredit = mark === 'C' || mark === 'RD'
  const rest = (m[8] || '').trim()
  const parts = rest.split('//')
  let ref = (parts.length > 1 ? parts[1] : parts[0] || '').trim().split(/\s+/)[0] || ''
  if (ref.toUpperCase() === 'NONREF') ref = ''
  return {
    date: parseSwiftDate(m[1]!),
    debit: isCredit ? '' : amount,
    credit: isCredit ? amount : '',
    ref: ref.slice(0, 64),
  }
}

/** Normalize MT940 text into Date / Description / Debit / Credit / Reference. */
export function parseMt940Text(text: string): StructuredParseResult {
  const fields = mt940Fields(text)
  const rows: unknown[][] = []
  let openingBalance: number | null = null
  let closingBalance: number | null = null
  let pending61: ReturnType<typeof parse61> = null

  const flush = (desc: string) => {
    if (!pending61) return
    rows.push([pending61.date, desc, pending61.debit, pending61.credit, pending61.ref])
    pending61 = null
  }

  for (const { tag, value } of fields) {
    if (tag === '60F' || tag === '60M') {
      const n = parseBalanceField(value)
      if (n != null && openingBalance == null) openingBalance = n
      continue
    }
    if (tag === '62F' || tag === '62M') {
      const n = parseBalanceField(value)
      if (n != null) closingBalance = n
      continue
    }
    if (tag === '61') {
      flush('')
      pending61 = parse61(value)
      continue
    }
    if (tag === '86') {
      flush(value.replace(/\s+/g, ' ').trim())
    }
  }
  flush('')

  return {
    headers: ['Date', 'Description', 'Debit', 'Credit', 'Reference'],
    rows,
    openingBalance,
    closingBalance,
  }
}

export function parseMt940File(filepath: string): StructuredParseResult {
  const text = fs.readFileSync(filepath, 'utf8')
  if (!looksLikeMt940(text)) {
    throw new Error(
      'This file is not a SWIFT MT940 statement. Export OFX, CAMT.053, CSV, or Excel from internet banking.'
    )
  }
  const result = parseMt940Text(text)
  if (result.rows.length === 0) {
    throw new Error('MT940 file contains no statement transactions (:61:)')
  }
  return result
}
