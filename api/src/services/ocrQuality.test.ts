import { describe, expect, it } from 'vitest'
import { pickBetterParse, scoreParseQuality } from './ocrQuality.js'

describe('ocrQuality', () => {
  it('scores a clean bank-like table highly and does not retry', () => {
    const headers = ['Date', 'Description', 'Debit', 'Credit']
    const rows = [
      ['01/01/2026', 'Customer deposit', '', '100.00'],
      ['02/01/2026', 'Supplier payment', '40.00', ''],
      ['03/01/2026', 'Bank charge', '5.00', ''],
      ['04/01/2026', 'Transfer in', '', '250.00'],
      ['05/01/2026', 'Transfer out', '20.00', ''],
      ['06/01/2026', 'Salary credit', '', '1,200.00'],
      ['07/01/2026', 'Rent payment', '800.00', ''],
      ['08/01/2026', 'Cash deposit', '', '50.00'],
    ]
    const q = scoreParseQuality({ headers, rows, parseMethod: 'ocr' })
    expect(q.score).toBeGreaterThanOrEqual(70)
    expect(q.shouldRetry).toBe(false)
  })

  it('flags junk OCR with few usable rows for retry', () => {
    const headers = ['Col_0', 'Col_1']
    const rows = [
      ['###', '@@@'],
      ['???', '!!!'],
    ]
    const q = scoreParseQuality({
      headers,
      rows,
      sourceText: '@@@###???!!!~~~^^^***',
      parseMethod: 'ocr',
    })
    expect(q.score).toBeLessThan(55)
    expect(q.shouldRetry).toBe(true)
  })

  it('treats dedicated bank parsers as high quality', () => {
    const q = scoreParseQuality({
      headers: ['Transaction Date', 'Description', 'Debit', 'Credit'],
      rows: Array.from({ length: 12 }, (_, i) => [`0${i + 1}/01/2026`, `Txn ${i}`, '10', '']),
      parseMethod: 'ecobank_pdf',
    })
    expect(q.score).toBeGreaterThanOrEqual(90)
    expect(q.shouldRetry).toBe(false)
  })

  it('picks the higher-scoring parse when comparing attempts', () => {
    const weak = {
      headers: ['Col_0'],
      rows: [['junk']],
      sourceText: '@@@###',
      parseMethod: 'ocr',
    }
    const strong = {
      headers: ['Date', 'Description', 'Amount'],
      rows: [
        ['01/01/2026', 'Deposit', '100'],
        ['02/01/2026', 'Charge', '-5'],
        ['03/01/2026', 'Payment', '-40'],
        ['04/01/2026', 'Receipt', '250'],
        ['05/01/2026', 'Transfer', '80'],
        ['06/01/2026', 'Fee', '-2'],
        ['07/01/2026', 'Salary', '900'],
        ['08/01/2026', 'Rent', '-300'],
      ],
      parseMethod: 'ocr',
    }
    const picked = pickBetterParse(weak, strong)
    expect(picked.winner).toBe(strong)
    expect(picked.bScore.score).toBeGreaterThan(picked.aScore.score)
  })
})
