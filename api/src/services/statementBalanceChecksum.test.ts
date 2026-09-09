import { describe, expect, it } from 'vitest'
import { evaluateStatementChecksum, checksumBlocksReconcile } from './statementBalanceChecksum.js'

describe('evaluateStatementChecksum', () => {
  it('skips when opening or closing is missing', () => {
    const r = evaluateStatementChecksum({
      headers: ['Date', 'Description', 'Debit', 'Credit'],
      rows: [['01/01/2026', 'Transfer', '10', '0']],
    })
    expect(r.status).toBe('not_applicable')
    expect(r.blocksReconcile).toBe(false)
  })

  it('passes when opening + credits − debits equals closing', () => {
    const r = evaluateStatementChecksum({
      headers: ['Date', 'Description', 'Debit', 'Credit'],
      rows: [
        ['', 'Opening balance', '', '1000.00'],
        ['02/01/2026', 'Deposit', '', '200.00'],
        ['03/01/2026', 'Charge', '50.00', ''],
        ['', 'Closing balance', '', '1150.00'],
      ],
      blockOnFailure: true,
    })
    expect(r.status).toBe('passed')
    expect(r.blocksReconcile).toBe(false)
    expect(r.opening).toBe(1000)
    expect(r.closing).toBe(1150)
  })

  it('fails and blocks unknown layouts when arithmetic does not tie', () => {
    const r = evaluateStatementChecksum({
      headers: ['Date', 'Description', 'Debit', 'Credit'],
      rows: [
        ['', 'Opening Balance', '500', ''],
        ['02/01/2026', 'Deposit', '', '100.00'],
        ['', 'Closing Balance', '900', ''],
      ],
      blockOnFailure: true,
    })
    expect(r.status).toBe('failed')
    expect(r.blocksReconcile).toBe(true)
    expect(checksumBlocksReconcile({ checksum: r })).toBe(true)
  })

  it('warns but does not block known Ghana banks', () => {
    const r = evaluateStatementChecksum({
      headers: ['Date', 'Description', 'Debit', 'Credit'],
      rows: [
        ['', 'Opening Balance', '500', ''],
        ['02/01/2026', 'Deposit', '', '100.00'],
        ['', 'Closing Balance', '900', ''],
      ],
      blockOnFailure: false,
    })
    expect(r.status).toBe('failed')
    expect(r.blocksReconcile).toBe(false)
    expect(checksumBlocksReconcile({ checksum: r })).toBe(false)
  })

  it('does not block after the user acknowledges', () => {
    const r = evaluateStatementChecksum({
      headers: ['Date', 'Description', 'Debit', 'Credit'],
      rows: [
        ['', 'Opening Balance', '1', ''],
        ['', 'Closing Balance', '99', ''],
      ],
      blockOnFailure: true,
    })
    expect(checksumBlocksReconcile({ checksum: r, checksumAcknowledged: true })).toBe(false)
  })
})
