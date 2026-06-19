import { describe, it, expect } from 'vitest'
import { Prisma } from '@prisma/client'
import { getMatchConflictErrorBody, isUniqueConstraintError, resolveReconcileFetchLimit, resolveSuggestionCap } from './reconcile.js'

describe('reconcile helpers', () => {
  it('identifies prisma unique constraint errors', () => {
    const err = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
      code: 'P2002',
      clientVersion: 'test',
    })
    expect(isUniqueConstraintError(err)).toBe(true)
  })

  it('returns false for non-unique errors', () => {
    const err = new Prisma.PrismaClientKnownRequestError('Not found', {
      code: 'P2025',
      clientVersion: 'test',
    })
    expect(isUniqueConstraintError(err)).toBe(false)
    expect(isUniqueConstraintError(new Error('boom'))).toBe(false)
  })

  it('maps unique constraint errors to consistent conflict body', () => {
    const err = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
      code: 'P2002',
      clientVersion: 'test',
    })
    expect(getMatchConflictErrorBody(err)).toEqual({
      error: 'One or more transactions are already matched',
    })
    expect(getMatchConflictErrorBody(new Error('nope'))).toBeNull()
  })

  it('auto-raises reconcile fetch limit when a lane exceeds default per-category cap', () => {
    expect(resolveReconcileFetchLimit(undefined, [175, 604, 175, 604])).toBe(16_000)
    expect(resolveReconcileFetchLimit(undefined, [100, 200, 100, 200])).toBe(16_000)
    expect(resolveReconcileFetchLimit(undefined, [5000, 5000, 5000, 5000])).toBe(40_000)
    expect(resolveReconcileFetchLimit(2000, [604, 604, 604, 604])).toBe(2000)
  })

  it('defaults suggestion cap to platform max (40_000)', () => {
    expect(resolveSuggestionCap(undefined, [175, 604, 175, 604])).toBe(40_000)
    expect(resolveSuggestionCap(undefined, [100, 200, 100, 200])).toBe(40_000)
    expect(resolveSuggestionCap(200, [604, 604, 604, 604])).toBe(200)
    expect(resolveSuggestionCap(80_000, [100, 100, 100, 100])).toBe(40_000)
  })
})
