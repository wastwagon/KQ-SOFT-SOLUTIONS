import { describe, expect, it } from 'vitest'
import { parseImportedDate } from './dateParser.js'

describe('parseImportedDate', () => {
  it('parses Excel serial', () => {
    const d = parseImportedDate('46023')
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2026)
  })

  it('parses DD-Mon-YYYY', () => {
    const d = parseImportedDate('31-Mar-2026')
    expect(d).not.toBeNull()
    expect(d!.getDate()).toBe(31)
  })
})
