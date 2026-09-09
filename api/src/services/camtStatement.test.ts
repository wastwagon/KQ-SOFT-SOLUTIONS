import { describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { parseCamtText, looksLikeCamt, parseCamtFile } from './camtStatement.js'
import { parseDocumentFile } from './documentParse.js'

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
  <BkToCstmrStmt>
    <Stmt>
      <Bal>
        <Tp><CdOrPrtry><Cd>OPBD</Cd></CdOrPrtry></Tp>
        <Amt Ccy="GHS">1000.00</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
      </Bal>
      <Ntry>
        <Amt Ccy="GHS">250.50</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <BookgDt><Dt>2026-01-15</Dt></BookgDt>
        <AcctSvcrRef>CR1</AcctSvcrRef>
        <NtryDtls><TxDtls><RmtInf><Ustrd>Salary</Ustrd><Ustrd>January</Ustrd></RmtInf></TxDtls></NtryDtls>
      </Ntry>
      <ns2:Ntry xmlns:ns2="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
        <ns2:Amt Ccy="GHS">40.00</ns2:Amt>
        <ns2:CdtDbtInd>DBIT</ns2:CdtDbtInd>
        <ns2:BookgDt><ns2:Dt>2026-01-16</ns2:Dt></ns2:BookgDt>
        <ns2:NtryRef>DR1</ns2:NtryRef>
        <ns2:AddtlNtryInf>Fee</ns2:AddtlNtryInf>
      </ns2:Ntry>
      <Bal>
        <Tp><CdOrPrtry><Cd>CLBD</Cd></CdOrPrtry></Tp>
        <Amt Ccy="GHS">1210.50</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
      </Bal>
    </Stmt>
  </BkToCstmrStmt>
</Document>
`

describe('parseCamtText', () => {
  it('detects CAMT.053 documents', () => {
    expect(looksLikeCamt(SAMPLE)).toBe(true)
    expect(looksLikeCamt('<note>hello</note>')).toBe(false)
    expect(looksLikeCamt('<?xml version="1.0"?><Document xmlns="pain.001.001.09"><CstmrCdtTrfInitn/>')).toBe(
      false
    )
  })

  it('reads namespaced Ntry blocks and OPBD/CLBD', () => {
    const parsed = parseCamtText(SAMPLE)
    expect(parsed.headers).toEqual(['Date', 'Description', 'Debit', 'Credit', 'Reference'])
    expect(parsed.rows).toHaveLength(2)
    expect(parsed.rows[0]).toEqual(['2026-01-15', 'Salary — January', '', 250.5, 'CR1'])
    expect(parsed.rows[1]).toEqual(['2026-01-16', 'Fee', 40, '', 'DR1'])
    expect(parsed.openingBalance).toBe(1000)
    expect(parsed.closingBalance).toBe(1210.5)
  })

  it('parseDocumentFile routes .xml CAMT and rejects other XML', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'camt-'))
    const file = path.join(dir, 'stmt.xml')
    fs.writeFileSync(file, SAMPLE)
    const parsed = await parseDocumentFile(file, 'bank_credits')
    expect(parsed.parseMethod).toBe('camt')
    expect(parsed.rows).toHaveLength(2)
    const other = path.join(dir, 'other.xml')
    fs.writeFileSync(other, '<note>not a statement</note>')
    expect(() => parseCamtFile(other)).toThrow(/not a CAMT/)
    fs.rmSync(dir, { recursive: true, force: true })
  })
})
