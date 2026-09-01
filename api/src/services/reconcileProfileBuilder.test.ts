import { describe, expect, it } from 'vitest'
import { buildReconcileProfile } from './reconcileProfileBuilder.js'

describe('buildReconcileProfile', () => {
  it('returns schedule_first profile for GT Bank EUR', () => {
    const profile = buildReconcileProfile({
      project: { currency: 'EUR', name: 'GT Bank EUR 430' },
      bankAccounts: [{ bankName: 'GT Bank', accountNo: '201/105646/430' }],
      ecobankActive: false,
      ghanaBankFormat: null,
    })
    expect(profile?.bankFormat).toBe('gt_bank_eur')
    expect(profile?.brsStyle).toBe('schedule_first')
    expect(profile?.showCountMatch).toBe(false)
    expect(profile?.encourageAutoMatch).toBe(false)
    expect(profile?.scheduleBrs).toBe(true)
  })

  it('prefers ecobank over gt when both active flags supplied', () => {
    const profile = buildReconcileProfile({
      project: { currency: 'GHS', name: 'Ecobank' },
      bankAccounts: [{ bankName: 'Ecobank' }],
      ecobankActive: true,
      ghanaBankFormat: 'ecobank',
    })
    expect(profile?.bankFormat).toBe('ecobank')
    expect(profile?.showCountMatch).toBe(true)
  })
})
