import { afterEach, describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { parseCsv } from './parser.js'

const tempFiles: string[] = []

function writeTempCsv(content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'parser-test-'))
  const file = path.join(dir, 'sample.csv')
  fs.writeFileSync(file, content, 'utf-8')
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
