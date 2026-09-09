import { describe, expect, it } from 'vitest'
import { parseOfxText, looksLikeOfx } from './ofxStatement.js'

const SAMPLE = `OFXHEADER:100
DATA:OFXSGML
<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<CURDEF>GHS
<BANKTRANLIST>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260115
<TRNAMT>250.50
<FITID>CR1
<NAME>Salary
<MEMO>January
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260116
<TRNAMT>-40.00
<FITID>DR1
<NAME>Fee
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>
`

describe('parseOfxText', () => {
  it('detects OFX headers', () => {
    expect(looksLikeOfx(SAMPLE)).toBe(true)
    expect(looksLikeOfx('Date,Description,Amount')).toBe(false)
  })

  it('splits credits and debits from signed TRNAMT', () => {
    const parsed = parseOfxText(SAMPLE)
    expect(parsed.headers).toEqual(['Date', 'Description', 'Debit', 'Credit', 'Reference'])
    expect(parsed.rows).toHaveLength(2)
    expect(parsed.rows[0]).toEqual(['2026-01-15', 'Salary — January', '', 250.5, 'CR1'])
    expect(parsed.rows[1]).toEqual(['2026-01-16', 'Fee', 40, '', 'DR1'])
  })
})
