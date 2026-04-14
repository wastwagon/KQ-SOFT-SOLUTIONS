import { describe, it, expect } from 'vitest'
import { Prisma } from '@prisma/client'
import { getMatchConflictErrorBody, isUniqueConstraintError } from './reconcile.js'

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
})
