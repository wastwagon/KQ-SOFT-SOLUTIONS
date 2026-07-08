import { describe, expect, it } from 'vitest'
import path from 'path'
import fs from 'fs'
import {
  looksLikeUmbStatementText,
  parseUmbPdfText,
  shouldUseUmbPdfParser,
} from './umbStatement.js'
import { parseBankPdf } from './documentParse.js'
import { detectGhanaBankFormat } from './ghanaBankParsers.js'
import { buildSuggestedMappingForDocument, canAutoMap } from './autoMapDocument.js'

const UMB_PDF = path.resolve(
  import.meta.dirname,
  '../../../specimenbankstatementformats/UMB Cocoa Purchases  main(1110005147028)- Sept 23.pdf'
)

describe('umbStatement', () => {
  it('detects UMB PDF layout', () => {
    const sample = `Account :1110005147028UNIVERSAL MERCHANT BANK
Booking DateReference DescriptionValue DateDebitCreditClosing Balance
Balance at Period Start 50.00`
    expect(looksLikeUmbStatementText(sample)).toBe(true)
  })

  it('shouldUseUmbPdfParser flags generic junk headers', () => {
    expect(
      shouldUseUmbPdfParser({
        headers: ['Col_0', 'Col_1'],
        rows: [['06 SEP 23FT23249TFFFR\\BNK'], ['Inward Cheque - Dr']],
      })
    ).toBe(true)
  })

  it('parses real UMB Cocoa Purchases September 2023 specimen', async () => {
    if (!fs.existsSync(UMB_PDF)) return

    const result = await parseBankPdf(UMB_PDF)
    expect(result.parseMethod).toBe('umb_pdf')
    expect(result.headers).toContain('Debit')
    expect(result.headers).toContain('Credit')
    expect(result.rows.length).toBe(9)

    const format = detectGhanaBankFormat(result.headers, result.rows.slice(0, 3))
    expect(format).toBe('nib')

    const cr = buildSuggestedMappingForDocument('bank_credits', result.headers, format)
    const dr = buildSuggestedMappingForDocument('bank_debits', result.headers, format)
    expect(canAutoMap('bank_credits', result.headers, cr)).toBe(true)
    expect(canAutoMap('bank_debits', result.headers, dr)).toBe(true)

    const sumDebit = result.rows.reduce((s, r) => s + (Number(r[4]) || 0), 0)
    const sumCredit = result.rows.reduce((s, r) => s + (Number(r[5]) || 0), 0)
    expect(sumDebit).toBeCloseTo(61_965_360.36, 0)
    expect(sumCredit).toBeCloseTo(61_965_360.36, 0)

    const lastBalance = Number(result.rows[result.rows.length - 1]![6])
    expect(lastBalance).toBeCloseTo(50, 0)
  }, 30000)

  it('parses inward cheque and transfer credit pair from sample text', () => {
    const text = `Booking DateReference DescriptionValue DateDebitCreditClosing Balance
Balance at Period Start 50.00
06 SEP 23FT23249TFFFR\\BNK
Inward Cheque - Dr
06 SEP 2325,500.00
-25,450.00
06 SEP 231110005147028-202309-SW
Transfer Credit06 SEP 23
25,500.0050.00`
    const r = parseUmbPdfText(text)
    expect(r.rows.length).toBe(2)
    expect(r.rows[0]![4]).toBe(25_500)
    expect(r.rows[1]![5]).toBe(25_500)
    expect(r.rows[1]![6]).toBe(50)
  })
})
