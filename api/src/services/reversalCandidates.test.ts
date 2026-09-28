import { describe, expect, it } from 'vitest'
import {
  detectReversalCandidates,
  meaningfulReversalRef,
  withoutOffsettingReturnedChequePairs,
} from './reversalCandidates.js'

const tx = (
  id: string,
  amount: number,
  details: string,
  date: string,
  chqNo: string | null = null
) => ({ id, amount, details, name: null, date, chqNo, docRef: null })

describe('meaningfulReversalRef', () => {
  it('rejects blank and zero cheque numbers', () => {
    expect(meaningfulReversalRef('0')).toBe('')
    expect(meaningfulReversalRef('00')).toBe('')
    expect(meaningfulReversalRef('')).toBe('')
    expect(meaningfulReversalRef('327////')).toBe('327')
  })
})

describe('detectReversalCandidates', () => {
  it('does not pair unrelated bank lines that share cheque 0', () => {
    const credits = [
      tx('c1', 6246, 'CASH DEPOSIT MILLICENT TAMATEY', '2016-03-04', '0'),
      tx('c2', 1000, 'FUND TRANSFER - OWN ACCOUNTS TRF B/O ACCOUNT 1/1/1', '2016-09-22', '0'),
    ]
    const debits = [
      tx('d1', 6246, 'RECLASSIFICATIONS FROM ONE AC TO ANOTHER MILLICENT TAMATEY', '2016-03-08', '0'),
      tx('d2', 1000, 'FUND TRANSFER - OWN ACCOUNTS TGL PROPERTIES LTD', '2016-10-19', '0'),
    ]
    expect(detectReversalCandidates([], [], credits, debits)).toEqual([])
  })

  it('pairs a postdated returned cheque with the later clearing debit of the same amount', () => {
    const credits = [tx('c327', 50973.67, 'RETURNED CHECKS POSTDATED', '2016-09-26', '327////')]
    const debits = [
      tx('d327', 50973.67, 'CLEARING WITHDRAWAL CHQ#327', '2016-11-18', '00'),
      tx('dother', 100, 'SI TRANSACTION', '2016-11-01', '10'),
    ]
    const found = detectReversalCandidates([], [], credits, debits)
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({
      reference: 'chq:327',
      stream: 'bank',
      amount: 50973.67,
      incomingNarration: 'RETURNED CHECKS POSTDATED',
      outgoingNarration: 'CLEARING WITHDRAWAL CHQ#327',
    })
  })
})

describe('withoutOffsettingReturnedChequePairs', () => {
  it('drops both sides of a returned cheque that is still on both bank-only lists', () => {
    const credits = [
      tx('c327', 50973.67, 'RETURNED CHECKS POSTDATED', '2016-09-26', '327////'),
      tx('c271', 1112.4, 'RETURNED CHECKS OUTDATED', '2016-12-13', '271////'),
    ]
    const debits = [
      tx('d327', 50973.67, 'CLEARING WITHDRAWAL CHQ#327', '2016-11-18', '00'),
      tx('dother', 75, 'CLEARING WITHDRAWAL CHQ#223', '2016-01-08', '223'),
    ]
    const face = withoutOffsettingReturnedChequePairs(credits, debits)
    expect(face.credits.map((t) => t.id)).toEqual(['c271'])
    expect(face.debits.map((t) => t.id)).toEqual(['dother'])
  })

  it('keeps a returned cheque when its clearing debit is not on the bank-only list', () => {
    const credits = [tx('c271', 1112.4, 'RETURNED CHECKS OUTDATED', '2016-12-13', '271////')]
    const debits = [tx('d223', 75, 'CLEARING WITHDRAWAL CHQ#223', '2016-01-08', '223')]
    const face = withoutOffsettingReturnedChequePairs(credits, debits)
    expect(face.credits).toEqual(credits)
    expect(face.debits).toEqual(debits)
  })
})
