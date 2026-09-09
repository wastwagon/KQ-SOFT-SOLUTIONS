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

  it('uses day-first for ambiguous dates by default (Ghana)', () => {
    const d = parseImportedDate('03/04/2026')
    expect(d).not.toBeNull()
    expect(d!.getDate()).toBe(3)
    expect(d!.getMonth()).toBe(3)
  })

  it('uses month-first when locale is mdy', () => {
    const d = parseImportedDate('03/04/2026', { dateOrder: 'mdy', decimalStyle: 'us' })
    expect(d).not.toBeNull()
    expect(d!.getDate()).toBe(4)
    expect(d!.getMonth()).toBe(2)
  })

  it('disambiguates 15/03 as 15 March even under mdy', () => {
    const d = parseImportedDate('15/03/2026', { dateOrder: 'mdy', decimalStyle: 'us' })
    expect(d).not.toBeNull()
    expect(d!.getDate()).toBe(15)
    expect(d!.getMonth()).toBe(2)
  })
})
