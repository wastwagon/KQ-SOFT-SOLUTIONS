import { describe, expect, it } from 'vitest'
import path from 'path'
import fs from 'fs'
import { parseBankPdf, parseDocumentFile } from './documentParse.js'

const ASDISCUSSED = path.resolve(
  import.meta.dirname,
  '../../../asdiscussed'
)

describe('documentParse', () => {
  it('parses Ecobank bank PDF with Debit/Credit headers (native, not OCR junk)', async () => {
    const pdf = path.join(ASDISCUSSED, '1778163944552.pdf')
    if (!fs.existsSync(pdf)) {
      return
    }
    const t0 = Date.now()
    const result = await parseBankPdf(pdf)
    const ms = Date.now() - t0
    expect(result.parseMethod).toBe('ecobank_pdf')
    expect(result.headers).toContain('Debit')
    expect(result.headers).toContain('Credit')
    expect(result.rows.length).toBeGreaterThan(30)
    expect(result.rows.length).toBeLessThan(120)
    expect(ms).toBeLessThan(15000)
  }, 20000)

  it('parseDocumentFile uses same path for bank_debits', async () => {
    const pdf = path.join(ASDISCUSSED, '1778163944552.pdf')
    if (!fs.existsSync(pdf)) {
      return
    }
    const result = await parseDocumentFile(pdf, 'bank_debits', 0)
    expect(result.headers).toContain('Debit')
    expect(result.rows.length).toBeGreaterThan(30)
  }, 20000)
})
