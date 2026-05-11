import { afterEach, describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import * as XLSX from 'xlsx'
import { parseCsv, parseExcel } from './parser.js'

const tempFiles: string[] = []

function writeTempCsv(content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-test-'))
  const file = path.join(dir, 'sample.csv')
  fs.writeFileSync(file, content, 'utf-8')
  tempFiles.push(file)
  return file
}

function writeTempMultiSheetXlsx(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-xlsx-'))
  const file = path.join(dir, 'two-sheets.xlsx')
  const wb = XLSX.utils.book_new()
  const ws0 = XLSX.utils.aoa_to_sheet([
    ['Date', 'Amount'],
    ['2026-01-01', '100'],
  ])
  const ws1 = XLSX.utils.aoa_to_sheet([
    ['Ref', 'Note'],
    ['R1', 'Second tab'],
  ])
  XLSX.utils.book_append_sheet(wb, ws0, 'January')
  XLSX.utils.book_append_sheet(wb, ws1, 'February')
  XLSX.writeFile(wb, file)
  tempFiles.push(file)
  return file
}

afterEach(() => {
  for (const file of tempFiles.splice(0)) {
    const dir = path.dirname(file)
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('parseCsv', () => {
  it('parses quoted commas correctly', () => {
    const file = writeTempCsv('Date,Description,Amount\n2026-01-01,"Transfer, Salary",1200\n')
    const parsed = parseCsv(file)
    expect(parsed.headers).toEqual(['Date', 'Description', 'Amount'])
    expect(parsed.rows[0]).toEqual(['2026-01-01', 'Transfer, Salary', '1200'])
  })

  it('parses escaped quotes in values', () => {
    const file = writeTempCsv('Date,Description,Amount\n2026-01-01,"Payment ""Invoice 12""",450\n')
    const parsed = parseCsv(file)
    expect(parsed.rows[0]).toEqual(['2026-01-01', 'Payment "Invoice 12"', '450'])
  })

  it('parses newline inside quoted cell', () => {
    const file = writeTempCsv('Date,Description,Amount\n2026-01-01,"Narration line 1\nline 2",300\n')
    const parsed = parseCsv(file)
    expect(parsed.rows[0][1]).toBe('Narration line 1\nline 2')
  })

  it('parses semicolon-separated CSV', () => {
    const file = writeTempCsv('Date;Description;Amount\n2026-01-01;Salary;1200\n')
    const parsed = parseCsv(file)
    expect(parsed.headers).toEqual(['Date', 'Description', 'Amount'])
    expect(parsed.rows[0]).toEqual(['2026-01-01', 'Salary', '1200'])
  })

  it('strips UTF-8 BOM from header', () => {
    const file = writeTempCsv('\uFEFFDate,Amount\n2026-01-01,99\n')
    const parsed = parseCsv(file)
    expect(parsed.headers[0]).toBe('Date')
  })
})

describe('parseExcel', () => {
  it('reads first sheet by default and exposes sheetNames', () => {
    const file = writeTempMultiSheetXlsx()
    const r = parseExcel(file, 0)
    expect(r.sheetNames).toEqual(['January', 'February'])
    expect(r.activeSheet).toBe('January')
    expect(r.headers).toContain('Date')
    expect(r.rows[0]).toEqual(['2026-01-01', '100'])
  })

  it('reads second sheet when sheetIndex is 1', () => {
    const file = writeTempMultiSheetXlsx()
    const r = parseExcel(file, 1)
    expect(r.activeSheet).toBe('February')
    expect(r.headers).toContain('Ref')
    expect(r.rows[0]).toEqual(['R1', 'Second tab'])
  })

  it('falls back to first sheet when index is out of range', () => {
    const file = writeTempMultiSheetXlsx()
    const r = parseExcel(file, 99)
    expect(r.activeSheet).toBe('January')
    expect(r.headers).toContain('Date')
  })
})
