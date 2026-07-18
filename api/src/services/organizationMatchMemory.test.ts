import { describe, expect, it } from 'vitest'
import {
  amountToMinor,
  applyOrganisationMatchMemoryBoost,
  applyOrganisationSplitMatchMemoryBoost,
  buildMultiSideFingerprint,
  buildSideFingerprint,
  fingerprintsMatch,
  memoryEligibleForBoost,
  multiFingerprintsMatch,
  type MatchMemoryRecord,
} from './organizationMatchMemory.js'
import type { Tx } from './matching.js'

function tx(partial: Partial<Tx> & { id: string; amount: number }): Tx {
  return {
    date: null,
    name: null,
    details: null,
    docRef: null,
    chqNo: null,
    ...partial,
  }
}

describe('organizationMatchMemory', () => {
  it('prefers cheque fingerprints over narration', () => {
    const fp = buildSideFingerprint({
      amount: 100,
      chqNo: '002038',
      name: 'Payment to Kofi Mensah',
      details: 'CHQ 002038',
    })
    expect(fp.learnable).toBe(true)
    expect(fp.fingerprint).toBe('chq:2038')
  })

  it('rejects amount-only / weak narration as not learnable', () => {
    const weak = buildSideFingerprint({ amount: 50, name: 'TRF', details: 'PAY' })
    expect(weak.learnable).toBe(false)
  })

  it('soft-matches narration fingerprints with shared tokens', () => {
    const a = buildSideFingerprint({
      amount: 100,
      name: 'Kofi Mensah',
      details: 'Supplier invoice 44',
    })
    const b = buildSideFingerprint({
      amount: 100,
      name: 'KOFI MENSAH',
      details: 'Invoice 44 payment',
    })
    expect(a.learnable).toBe(true)
    expect(b.learnable).toBe(true)
    expect(fingerprintsMatch(a.fingerprint, b.fingerprint)).toBe(true)
  })

  it('boosts suggestions that match org memory without creating amount-only hits', () => {
    const suggestions: {
      cashBookTx: Tx
      bankTx: Tx
      confidence: number
      reason: string
      orgMemoryBoosted?: boolean
      orgMemoryId?: string
      orgMemoryConfirmations?: number
    }[] = [
      {
        cashBookTx: tx({
          id: 'cb1',
          amount: 25500,
          chqNo: '199056',
          details: 'Inward cheque',
        }),
        bankTx: tx({
          id: 'bk1',
          amount: 25500,
          details: 'Inward Cheque - Dr CHQ 199056',
        }),
        confidence: 0.7,
        reason: 'amount+date',
      },
      {
        cashBookTx: tx({ id: 'cb2', amount: 25500, name: 'Other' }),
        bankTx: tx({ id: 'bk2', amount: 25500, name: 'Unrelated' }),
        confidence: 0.55,
        reason: 'amount',
      },
    ]
    const memories: MatchMemoryRecord[] = [
      {
        id: 'mem1',
        amountMinor: amountToMinor(25500),
        cashBookFingerprint: 'chq:199056',
        bankFingerprint: 'chq:199056',
        confirmationCount: 3,
      },
    ]
    const boosted = applyOrganisationMatchMemoryBoost(suggestions, memories)
    expect(boosted).toBe(1)
    expect(suggestions[0]!.orgMemoryBoosted).toBe(true)
    expect(suggestions[0]!.orgMemoryId).toBe('mem1')
    expect(suggestions[0]!.orgMemoryConfirmations).toBe(3)
    expect(suggestions[0]!.confidence).toBeCloseTo(0.8)
    expect(suggestions[1]!.confidence).toBe(0.55)
    expect(suggestions[1]!.orgMemoryBoosted).toBeUndefined()
  })

  it('gates soft fingerprint boosts behind confirmationCount ≥ 2', () => {
    expect(memoryEligibleForBoost(1, true)).toBe(true)
    expect(memoryEligibleForBoost(1, false)).toBe(false)
    expect(memoryEligibleForBoost(2, false)).toBe(true)

    const suggestions = [
      {
        cashBookTx: tx({
          id: 'cb1',
          amount: 100,
          name: 'Kofi Mensah',
          details: 'Supplier invoice 44',
        }),
        bankTx: tx({
          id: 'bk1',
          amount: 100,
          name: 'KOFI MENSAH',
          details: 'Invoice 44 payment',
        }),
        confidence: 0.7,
        reason: 'amount+date',
      },
    ]
    const liveCb = buildSideFingerprint(suggestions[0]!.cashBookTx).fingerprint
    const liveBk = buildSideFingerprint(suggestions[0]!.bankTx).fingerprint
    // Soft (non-identical) narr fingerprints that still Jaccard-match live sides
    const softStored: MatchMemoryRecord[] = [
      {
        id: 'soft1',
        amountMinor: amountToMinor(100),
        cashBookFingerprint: 'narr:invoice|kofi|mensah|vendor',
        bankFingerprint: 'narr:invoice|kofi|mensah|transfer',
        confirmationCount: 1,
      },
    ]
    expect(softStored[0]!.cashBookFingerprint).not.toBe(liveCb)
    expect(softStored[0]!.bankFingerprint).not.toBe(liveBk)
    expect(fingerprintsMatch(softStored[0]!.cashBookFingerprint, liveCb)).toBe(true)
    expect(fingerprintsMatch(softStored[0]!.bankFingerprint, liveBk)).toBe(true)
    expect(applyOrganisationMatchMemoryBoost([...suggestions], softStored)).toBe(0)

    softStored[0]!.confirmationCount = 2
    const again = [
      {
        ...suggestions[0]!,
        confidence: 0.7,
        reason: 'amount+date',
        orgMemoryBoosted: undefined as boolean | undefined,
      },
    ]
    expect(applyOrganisationMatchMemoryBoost(again, softStored)).toBe(1)
    expect(again[0]!.orgMemoryBoosted).toBe(true)

    // Exact fingerprint still boosts at confirmationCount 1
    const exact: MatchMemoryRecord[] = [
      {
        id: 'exact1',
        amountMinor: amountToMinor(25500),
        cashBookFingerprint: 'chq:199056',
        bankFingerprint: 'chq:199056',
        confirmationCount: 1,
      },
    ]
    const exactSug = [
      {
        cashBookTx: tx({ id: 'cb1', amount: 25500, chqNo: '199056' }),
        bankTx: tx({ id: 'bk1', amount: 25500, chqNo: '199056' }),
        confidence: 0.7,
        reason: 'amount',
      },
    ]
    expect(applyOrganisationMatchMemoryBoost(exactSug, exact)).toBe(1)
  })

  it('builds and soft-matches multi-side fingerprints for splits', () => {
    const multi = buildMultiSideFingerprint([
      { amount: 400, chqNo: '1001' },
      { amount: 250, chqNo: '1002' },
    ])
    expect(multi.learnable).toBe(true)
    expect(multi.fingerprint).toBe('mset:chq:1001+chq:1002')
    expect(multiFingerprintsMatch(multi.fingerprint, 'mset:chq:1002+chq:1001')).toBe(true)
  })

  it('boosts split suggestions from mset memories only', () => {
    const suggestions = [
      {
        cashBookTxs: [tx({ id: 'cb1', amount: 650, chqNo: '1001' })],
        bankTxs: [
          tx({ id: 'bk1', amount: 400, chqNo: '1001' }),
          tx({ id: 'bk2', amount: 250, chqNo: '1002' }),
        ],
        confidence: 0.7,
        reason: 'One-to-many: 2 bank items',
        orgMemoryBoosted: undefined as boolean | undefined,
      },
    ]
    // Wrong shape (N:1 memory) must not boost a 1:N suggestion
    const wrongStructure: MatchMemoryRecord[] = [
      {
        id: 'wrong1',
        amountMinor: amountToMinor(650),
        cashBookFingerprint: 'mset:chq:1001+chq:1002',
        bankFingerprint: 'chq:6500',
        confirmationCount: 1,
      },
    ]
    expect(applyOrganisationSplitMatchMemoryBoost(suggestions, wrongStructure)).toBe(0)

    const memories: MatchMemoryRecord[] = [
      {
        id: 'split1',
        amountMinor: amountToMinor(650),
        cashBookFingerprint: 'chq:1001',
        bankFingerprint: 'mset:chq:1001+chq:1002',
        confirmationCount: 2,
      },
    ]
    const boosted = applyOrganisationSplitMatchMemoryBoost(suggestions, memories)
    expect(boosted).toBe(1)
    expect(suggestions[0]!.orgMemoryBoosted).toBe(true)
    expect(suggestions[0]!.confidence).toBeCloseTo(0.8)
  })
})
