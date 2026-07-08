import { describe, expect, it } from 'vitest'
import path from 'path'
import fs from 'fs'
import { createRequire } from 'module'
import { parseBankPdf } from './documentParse.js'
import { parseExcel } from './parser.js'
import { parseEcobankPdfText } from './ecobankStatement.js'
import { detectGhanaBankFormat } from './ghanaBankParsers.js'
import { buildSuggestedMappingForDocument, canAutoMap } from './autoMapDocument.js'

const require = createRequire(import.meta.url)
const pdfParse = require('pdf-parse-new') as (b: Buffer) => Promise<{ text: string }>

const DIR = path.resolve(import.meta.dirname, '../../../ecobankstatementformats')
const PDF1 = path.join(DIR, '1778163944552 (acct1).pdf')
const PDF2 = path.join(DIR, '1778676142095 (acct 2).pdf')
const CASH1 = path.join(DIR, 'Lordship cash bk 1.xlsx')
const CASH2 = path.join(DIR, 'Lordship cash bk 2.xlsx')
const BRS1 = path.join(DIR, '2025 final brs for acct 901 (acct 1).xlsx')
const BRS2 = path.join(DIR, '2025 final brs for acct 902 (acct 2).xlsx')

describe('ecobankstatementformats specimens', () => {
  it('parses acct1 PDF with ecobank_pdf', async () => {
    if (!fs.existsSync(PDF1)) return

    const result = await parseBankPdf(PDF1)
    expect(result.parseMethod).toBe('ecobank_pdf')
    expect(result.rows.length).toBeGreaterThan(50)
    expect(result.headers).toContain('Debit')
    expect(result.headers).toContain('Credit')

    const format = detectGhanaBankFormat(result.headers, result.rows.slice(0, 3))
    expect(format).toBe('ecobank')

    const cr = buildSuggestedMappingForDocument('bank_credits', result.headers, 'ecobank')
    const dr = buildSuggestedMappingForDocument('bank_debits', result.headers, 'ecobank')
    expect(canAutoMap('bank_credits', result.headers, cr)).toBe(true)
    expect(canAutoMap('bank_debits', result.headers, dr)).toBe(true)

    const sumDebit = result.rows.reduce((s, r) => s + (Number(r[4]) || 0), 0)
    const sumCredit = result.rows.reduce((s, r) => s + (Number(r[5]) || 0), 0)
    expect(sumDebit).toBeCloseTo(509_114.29, 0)
    expect(sumCredit).toBeCloseTo(508_127.77, 0)

    const deposit = result.rows.find(
      (r) => String(r[1]).includes('CHEQUE DEPOSIT') && Number(r[4]) === 3700
    )
    expect(deposit).toBeTruthy()
  }, 30000)

  it('parses acct2 PDF with ecobank_pdf', async () => {
    if (!fs.existsSync(PDF2)) return

    const result = await parseBankPdf(PDF2)
    expect(result.parseMethod).toBe('ecobank_pdf')
    expect(result.rows.length).toBeGreaterThan(50)

    const sumDebit = result.rows.reduce((s, r) => s + (Number(r[4]) || 0), 0)
    const sumCredit = result.rows.reduce((s, r) => s + (Number(r[5]) || 0), 0)
    expect(sumDebit).toBeCloseTo(653_066.76, 0)
    expect(sumCredit).toBeCloseTo(623_843.99, 0)
  }, 30000)

  it('counts unparsed Ecobank PDF transaction blocks', async () => {
    if (!fs.existsSync(PDF1)) return
    const text = (await pdfParse(fs.readFileSync(PDF1))).text
    const r = parseEcobankPdfText(text)
    expect(r.rows.length).toBeGreaterThan(80)
  }, 30000)

  it('reports direct PDF parser row count vs parseBankPdf', async () => {
    if (!fs.existsSync(PDF1)) return
    const text = (await pdfParse(fs.readFileSync(PDF1))).text
    const direct = parseEcobankPdfText(text)
    const viaEntry = await parseBankPdf(PDF1)
    expect(direct.rows.length).toBe(viaEntry.rows.length)
  }, 30000)

  it('Lordship cashbooks support cash book auto-map', () => {
    if (!fs.existsSync(CASH1)) return
    const raw = parseExcel(CASH1)
    const cr = buildSuggestedMappingForDocument('cash_book_receipts', raw.headers, null)
    const dr = buildSuggestedMappingForDocument('cash_book_payments', raw.headers, null)
    expect(canAutoMap('cash_book_receipts', raw.headers, cr)).toBe(true)
    expect(canAutoMap('cash_book_payments', raw.headers, dr)).toBe(true)
  })

  it('parses Lordship cashbook 2', () => {
    if (!fs.existsSync(CASH2)) return
    const raw = parseExcel(CASH2)
    expect(raw.rows.length).toBeGreaterThan(0)
  })

  it('inspects BRS workbooks', () => {
    for (const fp of [BRS1, BRS2]) {
      if (!fs.existsSync(fp)) continue
      const raw = parseExcel(fp)
      expect(raw.rows.length).toBeGreaterThan(0)
    }
  })
})
