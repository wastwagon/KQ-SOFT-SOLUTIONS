import { describe, expect, it } from 'vitest'
import {
  buildParsedExcelBuffer,
  buildParsedPdfBuffer,
  CLEAN_SAMPLE_ROW_LIMIT,
  CLEAN_SAMPLE_WATERMARK,
  prepareCleanExportRows,
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

  it('orders Excel data rows oldest date first', async () => {
    const parsed = {
      headers: ['Date', 'Description', 'Debit', 'Credit'],
      rows: [
        ['30/12/2026', 'Newest', 30, null],
        ['01/01/2026', 'Oldest', 10, null],
        ['15/06/2026', 'Mid', 20, null],
      ],
    }
    const { buffer } = buildParsedExcelBuffer(parsed, {
      kind: 'bank_statement',
      source: 'sample.xlsx',
      parseMethod: 'test',
    })
    const XLSX = await import('xlsx')
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const sheet = wb.Sheets[wb.SheetNames[0]!]!
    const aoa = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1 })
    const headerIdx = aoa.findIndex((r) => Array.isArray(r) && r[0] === 'Date')
    expect(headerIdx).toBeGreaterThanOrEqual(0)
    expect(aoa[headerIdx + 1]![1]).toBe('Oldest')
    expect(aoa[headerIdx + 2]![1]).toBe('Mid')
    expect(aoa[headerIdx + 3]![1]).toBe('Newest')
  })

  it('truncates sample exports and watermarks Excel', async () => {
    const rows = Array.from({ length: CLEAN_SAMPLE_ROW_LIMIT + 10 }, (_, i) => [
      `0${(i % 9) + 1}/01/2026`,
      `Row ${i}`,
      i + 1,
      null,
    ])
    const parsed = {
      headers: ['Date', 'Description', 'Debit', 'Credit'],
      rows,
    }
    const prepared = prepareCleanExportRows(parsed, 'sample')
    expect(prepared.truncated).toBe(true)
    expect(prepared.exportRows.rows).toHaveLength(CLEAN_SAMPLE_ROW_LIMIT)
    expect(prepared.totalRowCount).toBe(CLEAN_SAMPLE_ROW_LIMIT + 10)

    const { buffer, meta } = buildParsedExcelBuffer(
      parsed,
      { kind: 'bank_statement', source: 'big.pdf', parseMethod: 'test' },
      'sample'
    )
    expect(meta.mode).toBe('sample')
    expect(meta.watermark).toBe(CLEAN_SAMPLE_WATERMARK)
    expect(meta.truncated).toBe(true)
    expect(meta.rowCount).toBe(CLEAN_SAMPLE_ROW_LIMIT)

    const XLSX = await import('xlsx')
    const wb = XLSX.read(buffer, { type: 'buffer' })
    const sheet = wb.Sheets[wb.SheetNames[0]!]!
    const aoa = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1 })
    const flat = aoa.map((r) => (Array.isArray(r) ? r.join(' ') : '')).join('\n')
    expect(flat).toContain(CLEAN_SAMPLE_WATERMARK)
    expect(flat).toContain('SAMPLE')
  })

  it('builds a watermarked sample PDF', async () => {
    const parsed = {
      headers: ['Date', 'Description', 'Debit', 'Credit'],
      rows: [
        ['01/01/2026', 'A', 10, null],
        ['02/01/2026', 'B', null, 20],
      ],
    }
    const buffer = await buildParsedPdfBuffer(
      parsed,
      {
        kind: 'bank_statement',
        source: 'demo.pdf',
        parseMethod: 'test',
        sumDebit: 10,
        sumCredit: 20,
        rowCount: 2,
      },
      'sample'
    )
    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.byteLength).toBeGreaterThan(200)
    expect(buffer.subarray(0, 5).toString('utf8')).toBe('%PDF-')
  })
})
