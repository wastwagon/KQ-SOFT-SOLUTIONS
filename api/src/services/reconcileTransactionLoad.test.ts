import { describe, expect, it } from 'vitest'
import { toReconcileTx } from './reconcileTransactionLoad.js'
import { loadOrganisationMatchMemoriesBatch } from './organizationMatchMemory.js'

describe('reconcileTransactionLoad', () => {
  it('maps prisma rows to matcher Tx shape', () => {
    const tx = toReconcileTx({
      id: 't1',
      date: new Date('2023-09-01'),
      name: 'Kofi',
      details: 'Payment',
      docRef: 'R1',
      chqNo: '100',
      amount: '250.50' as unknown,
    })
    expect(tx).toEqual({
      id: 't1',
      date: new Date('2023-09-01'),
      name: 'Kofi',
      details: 'Payment',
      docRef: 'R1',
      chqNo: '100',
      amount: 250.5,
    })
  })
})

describe('loadOrganisationMatchMemoriesBatch', () => {
  it('skips the database when no amount minors are provided', async () => {
    const out = await loadOrganisationMatchMemoriesBatch({
      organizationId: 'org-test',
      bySide: { receipt: [], payment: [] },
    })
    expect(out).toEqual({ receipt: [], payment: [] })
  })
})
