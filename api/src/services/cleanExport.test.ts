import { describe, expect, it } from 'vitest'
import {
  buildParsedExcelBuffer,
  summarizeParsed,
} from './cleanExport.js'

describe('cleanExport', () => {
  it('summarises debit and credit columns', () => {
    const parsed = {
      headers: ['Date', 'Description', 'Debit', 'Credit'],
      rows: [
        ['01/09/2023', 'A', 100, null],
        ['02/09/2023', 'B', null, 250.5],
      ],
    }
    expect(summarizeParsed(parsed)).toEqual({
      sumDebit: 100,
      sumCredit: 250.5,
      rowCount: 2,
    })
  })

  it('builds an Excel buffer with meta rows', () => {
    const parsed = {
      headers: ['Date', 'Debit', 'Credit'],
      rows: [['01/09/2023', 10, null]],
    }
    const { buffer, meta } = buildParsedExcelBuffer(parsed, {
      kind: 'bank_statement',
      source: 'sample.pdf',
      parseMethod: 'prudential_pdf',
    })
    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.byteLength).toBeGreaterThan(100)
    expect(meta.rowCount).toBe(1)
    expect(meta.sumDebit).toBe(10)
  })
})
