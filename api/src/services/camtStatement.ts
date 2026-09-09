/**
 * ISO 20022 CAMT.053 (and CAMT.052 Ntry) bank-to-customer statement XML.
 * Namespace-tolerant: banks wrap tags in prefixes.
 */
import fs from 'fs'
import type { StructuredParseResult } from './mt940Statement.js'

function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim()
}

function xmlBlocks(text: string, localName: string): string[] {
  const re = new RegExp(`<(?:[\\w.]+:)?${localName}\\b[\\s\\S]*?<\\/(?:[\\w.]+:)?${localName}>`, 'gi')
  return text.match(re) || []
}

function xmlText(block: string, localName: string): string {
  const re = new RegExp(`<(?:[\\w.]+:)?${localName}\\b[^>]*>([^<]*)`, 'i')
  const m = block.match(re)
  return m ? decodeXml(m[1]!) : ''
}

function xmlTexts(block: string, localName: string): string[] {
  const re = new RegExp(`<(?:[\\w.]+:)?${localName}\\b[^>]*>([^<]*)`, 'gi')
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(block))) {
    const v = decodeXml(m[1]!)
    if (v) out.push(v)
  }
  return out
}

function parseCamtAmount(raw: string): number {
  const n = parseFloat(raw.replace(/\s/g, '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

function ntryDate(block: string): string {
  const dtBlock =
    block.match(/<(?:[\w.]+:)?(?:BookgDt|ValDt)\b[\s\S]*?<\/(?:[\w.]+:)?(?:BookgDt|ValDt)>/i)?.[0] ||
    block
  const raw = xmlText(dtBlock, 'Dt') || xmlText(dtBlock, 'DtTm')
  return raw.slice(0, 10)
}

function signedBalance(bal: string): number | null {
  const amt = parseCamtAmount(xmlText(bal, 'Amt'))
  if (!xmlText(bal, 'Amt')) return null
  const ind = xmlText(bal, 'CdtDbtInd').toUpperCase()
  return ind === 'DBIT' ? -amt : amt
}

export function looksLikeCamt(text: string): boolean {
  const t = text.slice(0, 12000)
  return (
    /camt\.053/i.test(t) ||
    /camt\.052/i.test(t) ||
    /BkToCstmrStmt/i.test(t) ||
    /BkToCstmrAcctRpt/i.test(t)
  )
}

/** Normalize CAMT.053 XML into Date / Description / Debit / Credit / Reference. */
export function parseCamtText(text: string): StructuredParseResult {
  const rows: unknown[][] = []
  let openingBalance: number | null = null
  let closingBalance: number | null = null

  for (const bal of xmlBlocks(text, 'Bal')) {
    if (/<(?:[\w.]+:)?Cd>\s*OPBD\s*</i.test(bal)) {
      const n = signedBalance(bal)
      if (n != null && openingBalance == null) openingBalance = n
    }
    if (/<(?:[\w.]+:)?Cd>\s*CLBD\s*</i.test(bal)) {
      const n = signedBalance(bal)
      if (n != null) closingBalance = n
    }
  }

  for (const ntry of xmlBlocks(text, 'Ntry')) {
    const amt = parseCamtAmount(xmlText(ntry, 'Amt'))
    if (!xmlText(ntry, 'Amt') && amt === 0) continue
    const ind = xmlText(ntry, 'CdtDbtInd').toUpperCase()
    const credit = ind !== 'DBIT' ? amt : ''
    const debit = ind === 'DBIT' ? amt : ''
    const desc =
      xmlTexts(ntry, 'Ustrd').join(' — ') ||
      xmlText(ntry, 'AddtlNtryInf') ||
      xmlText(ntry, 'Nm') ||
      ind
    const ref =
      xmlText(ntry, 'AcctSvcrRef') ||
      xmlText(ntry, 'NtryRef') ||
      xmlText(ntry, 'TxId') ||
      xmlText(ntry, 'EndToEndId')
    rows.push([ntryDate(ntry), desc, debit, credit, ref])
  }

  return {
    headers: ['Date', 'Description', 'Debit', 'Credit', 'Reference'],
    rows,
    openingBalance,
    closingBalance,
  }
}

export function parseCamtFile(filepath: string): StructuredParseResult {
  const text = fs.readFileSync(filepath, 'utf8')
  if (!looksLikeCamt(text)) {
    throw new Error(
      'This XML file is not a CAMT.053 bank statement. Export OFX, MT940, CSV, or Excel from internet banking.'
    )
  }
  const result = parseCamtText(text)
  if (result.rows.length === 0) {
    throw new Error('CAMT file contains no statement entries (Ntry)')
  }
  return result
}
