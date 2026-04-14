import { describe, expect, it } from 'vitest'
import { splitOcrTableLine, textToTableFromOcrText } from './ocrLineSplit.js'

describe('splitOcrTableLine', () => {
  it('splits tab-separated lines', () => {
    expect(splitOcrTableLine('A\tB\tC')).toEqual(['A', 'B', 'C'])
  })

  it('splits pipe-separated lines', () => {
    expect(splitOcrTableLine('A | B | C')).toEqual(['A', 'B', 'C'])
  })

  it('splits 2+ space separated lines', () => {
    expect(splitOcrTableLine('A  B  C')).toEqual(['A', 'B', 'C'])
  })

  it('splits bank-like DD/MM/YYYY lines with single spaces', () => {
    expect(splitOcrTableLine('14/04/2026 Transfer to supplier 1,234.56')).toEqual([
      '14/04/2026',
      'Transfer to supplier',
      '1,234.56',
    ])
  })

  it('includes optional time in date cell', () => {
    expect(splitOcrTableLine('14/04/2026 10:05 Transfer to supplier 500')).toEqual([
      '14/04/2026 10:05',
      'Transfer to supplier',
      '500',
    ])
  })

  it('splits dual trailing amounts (debit/credit style)', () => {
    expect(splitOcrTableLine('14/04/2026 POS purchase Accra 500.00 1,250.50')).toEqual([
      '14/04/2026',
      'POS purchase Accra',
      '500.00',
      '1,250.50',
    ])
  })
})

describe('textToTableFromOcrText', () => {
  it('detects a header row when present', () => {
    const text = ['Date Description Amount', '14/04/2026 Foo 10', '15/04/2026 Bar 20'].join('\n')
    const t = textToTableFromOcrText(text)
    expect(t.headers.join(' ')).toContain('Date')
    expect(t.rows).toHaveLength(2)
  })

  it('synthesizes Col_N headers when no header row is detected', () => {
    const text = ['14/04/2026 Foo 10', '15/04/2026 Bar 20'].join('\n')
    const t = textToTableFromOcrText(text)
    expect(t.headers).toEqual(['Col_0', 'Col_1', 'Col_2'])
    expect(t.rows).toHaveLength(2)
  })

  it('synthesizes four columns when dual amounts appear', () => {
    const text = ['14/04/2026 X 10 20', '15/04/2026 Y 5 15'].join('\n')
    const t = textToTableFromOcrText(text)
    expect(t.headers).toEqual(['Col_0', 'Col_1', 'Col_2', 'Col_3'])
    expect(t.rows[0]).toEqual(['14/04/2026', 'X', '10', '20'])
  })
})
