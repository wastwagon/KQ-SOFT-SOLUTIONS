/**
 * OFX / QFX (Open Financial Exchange) — structured bank export used by Xero, Sage, QBO.
 * One parser covers any bank that already mapped its columns.
 */
import fs from 'fs'
import type { ParseResult } from './parser.js'

function ofxTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i')
  const m = block.match(re)
  return m ? m[1]!.trim() : ''
}

function parseOfxDate(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '').slice(0, 8)
  if (digits.length !== 8) return raw
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
}

function parseOfxAmount(raw: string): number {
  const n = parseFloat(raw.replace(/,/g, '').trim())
  return Number.isFinite(n) ? n : 0
}

export function looksLikeOfx(text: string): boolean {
  const t = text.slice(0, 4000).toUpperCase()
  return t.includes('<OFX') || t.includes('OFXHEADER:') || t.includes('<STMTTRN')
}

/** Normalize OFX/QFX text into Date / Description / Debit / Credit / Reference. */
export function parseOfxText(text: string): ParseResult {
  const blocks = text.split(/<STMTTRN>/i).slice(1)
  const rows: unknown[][] = []
  for (const rawBlock of blocks) {
    const block = rawBlock.split(/<\/STMTTRN>/i)[0] || rawBlock
    const amount = parseOfxAmount(ofxTag(block, 'TRNAMT'))
    if (amount === 0 && !ofxTag(block, 'TRNAMT')) continue
    const date = parseOfxDate(ofxTag(block, 'DTPOSTED') || ofxTag(block, 'DTUSER'))
    const name = ofxTag(block, 'NAME')
    const memo = ofxTag(block, 'MEMO')
    const desc = [name, memo].filter(Boolean).join(' — ') || ofxTag(block, 'TRNTYPE')
    const ref = ofxTag(block, 'FITID') || ofxTag(block, 'CHECKNUM') || ofxTag(block, 'REFNUM')
    const credit = amount > 0 ? amount : ''
    const debit = amount < 0 ? Math.abs(amount) : ''
    rows.push([date, desc, debit, credit, ref])
  }
  return {
    headers: ['Date', 'Description', 'Debit', 'Credit', 'Reference'],
    rows,
  }
}

export function parseOfxFile(filepath: string): ParseResult {
  const text = fs.readFileSync(filepath, 'utf8')
  if (!looksLikeOfx(text)) {
    throw new Error('File is not a valid OFX/QFX bank statement')
  }
  const result = parseOfxText(text)
  if (result.rows.length === 0) {
    throw new Error('OFX file contains no statement transactions (STMTTRN)')
  }
  return result
}
