import { describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { parseMt940Text, looksLikeMt940, parseMt940File } from './mt940Statement.js'
import { parseDocumentFile } from './documentParse.js'

const SAMPLE = `{1:F01BANKGHACXXXX0000000000}{2:I940BANKGHACXXXXN}{4:
:20:STMT202601
:25:001234567890
:28C:1/1
:60F:C260101GHS1000,00
:61:2601020102C200,00NTRFNONREF//SALJAN
:86:Salary January
:61:2601030103D40,00NCHK123456
:86:Cheque 123456
:61:2601040104RD15,50NTRFREV
:86:Reversal of debit
:62F:C260131GHS1175,50
-}`

describe('parseMt940Text', () => {
  it('detects MT940 tags', () => {
    expect(looksLikeMt940(SAMPLE)).toBe(true)
    expect(looksLikeMt940('<OFX><STMTTRN>')).toBe(false)
    expect(looksLikeMt940('Date,Description,Amount')).toBe(false)
  })

  it('splits credits, debits, and RD reversal; reads opening/closing', () => {
    const parsed = parseMt940Text(SAMPLE)
    expect(parsed.headers).toEqual(['Date', 'Description', 'Debit', 'Credit', 'Reference'])
    expect(parsed.rows).toHaveLength(3)
    expect(parsed.rows[0]).toEqual(['2026-01-02', 'Salary January', '', 200, 'SALJAN'])
    expect(parsed.rows[1]).toEqual(['2026-01-03', 'Cheque 123456', 40, '', '123456'])
    expect(parsed.rows[2]).toEqual(['2026-01-04', 'Reversal of debit', '', 15.5, 'REV'])
    expect(parsed.openingBalance).toBe(1000)
    expect(parsed.closingBalance).toBe(1175.5)
  })

  it('parseDocumentFile routes .mt940 and .sta', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt940-'))
    const file = path.join(dir, 'stmt.mt940')
    fs.writeFileSync(file, SAMPLE)
    const parsed = await parseDocumentFile(file, 'bank_credits')
    expect(parsed.parseMethod).toBe('mt940')
    expect(parsed.rows).toHaveLength(3)
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('rejects non-MT940 content', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt940-bad-'))
    const file = path.join(dir, 'stmt.sta')
    fs.writeFileSync(file, 'Date,Amount\n01/01/2026,10\n')
    expect(() => parseMt940File(file)).toThrow(/not a SWIFT MT940/)
    fs.rmSync(dir, { recursive: true, force: true })
  })
})
