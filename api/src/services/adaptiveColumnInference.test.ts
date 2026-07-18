import { describe, expect, it } from 'vitest'
import { inferAdaptiveMapping } from './adaptiveColumnInference.js'
import { canAutoMap, buildSuggestedMappingForDocument } from './autoMapDocument.js'

describe('adaptiveColumnInference', () => {
  it('infers generic date, narration, and signed amount columns', () => {
    const headers = ['Column A', 'Column B', 'Column C']
    const rows = [
      ['01/01/2026', 'Opening transfer from customer', '100.00'],
      ['02/01/2026', 'Bank charge for transfer', '-5.00'],
      ['03/01/2026', 'Supplier payment invoice 44', '-40.00'],
      ['04/01/2026', 'Customer deposit reference 92', '250.00'],
    ]
    const inferred = inferAdaptiveMapping('bank_credits', headers, rows)
    expect(inferred.mapping.transaction_date).toBe(0)
    expect(inferred.mapping.description).toBe(1)
    expect(inferred.mapping.credit).toBe(2)
    expect(inferred.mapping.debit).toBe(2)
    expect(inferred.confidence.transaction_date).toBe('high')
  })

  it('uses running-balance movement to infer debit and credit sides', () => {
    const headers = ['Col 1', 'Col 2', 'Col 3', 'Balance']
    const rows = [
      ['01/01/2026', 'Opening', null, '1000.00'],
      ['02/01/2026', 'Deposit A', '200.00', '1200.00'],
      ['03/01/2026', 'Deposit B', '50.00', '1250.00'],
      ['04/01/2026', 'Charge A', '10.00', '1240.00'],
      ['05/01/2026', 'Charge B', '20.00', '1220.00'],
    ]
    // One generic amount column cannot represent separate sides without signs;
    // balance evidence should not assign it to both contradictory orientations.
    const inferred = inferAdaptiveMapping('bank_credits', headers, rows)
    expect(inferred.mapping.transaction_date).toBe(0)
    expect(inferred.mapping.description).toBe(1)
    expect(inferred.mapping.credit).toBeUndefined()
    expect(inferred.mapping.debit).toBeUndefined()
  })

  it('orients two unknown amount columns from the running balance', () => {
    const headers = ['Col 1', 'Col 2', 'Col 3', 'Col 4', 'Balance']
    const rows = [
      ['01/01/2026', 'Opening row', null, null, '1000.00'],
      ['02/01/2026', 'Deposit A', null, '200.00', '1200.00'],
      ['03/01/2026', 'Deposit B', null, '50.00', '1250.00'],
      ['03/01/2026', 'Deposit C', null, '25.00', '1275.00'],
      ['04/01/2026', 'Charge A', '10.00', null, '1265.00'],
      ['05/01/2026', 'Charge B', '20.00', null, '1245.00'],
      ['06/01/2026', 'Charge C', '5.00', null, '1240.00'],
    ]
    const inferred = inferAdaptiveMapping('bank_credits', headers, rows)
    expect(inferred.mapping.debit).toBe(2)
    expect(inferred.mapping.credit).toBe(3)
  })

  it('allows safe auto-map when values strongly support generic headers', () => {
    const headers = ['Column A', 'Column B', 'Column C']
    const rows = [
      ['01/01/2026', 'Customer transfer alpha', '100.00'],
      ['02/01/2026', 'Bank charge beta', '-5.00'],
      ['03/01/2026', 'Supplier payment gamma', '-40.00'],
      ['04/01/2026', 'Customer deposit delta', '250.00'],
    ]
    const mapping = buildSuggestedMappingForDocument('bank_credits', headers, null, {
      sampleRows: rows,
    })
    expect(canAutoMap('bank_credits', headers, mapping, rows)).toBe(true)
  })
})
