import { describe, expect, it, afterEach } from 'vitest'
import {
  parseWorkbookNettingQuery,
  resolveWorkbookNetting,
  workbookNettingEnabled,
  workbookNettingFromRequest,
  normalizeWorkbookNettingMode,
} from './brsQueryFlags.js'

describe('brsQueryFlags', () => {
  const prev = process.env.GHANA_BRS_WORKBOOK_NETTING

  afterEach(() => {
    if (prev === undefined) delete process.env.GHANA_BRS_WORKBOOK_NETTING
    else process.env.GHANA_BRS_WORKBOOK_NETTING = prev
  })

  it('parses workbook netting query values', () => {
    expect(parseWorkbookNettingQuery('1')).toBe(true)
    expect(parseWorkbookNettingQuery('true')).toBe(true)
    expect(parseWorkbookNettingQuery('yes')).toBe(true)
    expect(parseWorkbookNettingQuery('0')).toBe(false)
    expect(parseWorkbookNettingQuery('false')).toBe(false)
    expect(parseWorkbookNettingQuery('no')).toBe(false)
    expect(parseWorkbookNettingQuery(undefined)).toBeUndefined()
    expect(parseWorkbookNettingQuery('')).toBeUndefined()
  })

  it('normalizes project workbook netting mode', () => {
    expect(normalizeWorkbookNettingMode('on')).toBe('on')
    expect(normalizeWorkbookNettingMode('off')).toBe('off')
    expect(normalizeWorkbookNettingMode('inherit')).toBe('inherit')
    expect(normalizeWorkbookNettingMode(undefined)).toBe('inherit')
  })

  it('resolves hierarchy: query beats project/org/platform/env', () => {
    delete process.env.GHANA_BRS_WORKBOOK_NETTING
    expect(
      resolveWorkbookNetting({
        queryValue: '0',
        projectMode: 'on',
        orgDefault: true,
        platformDefault: true,
      })
    ).toEqual({ enabled: false, source: 'query', mode: 'on' })
    expect(
      resolveWorkbookNetting({
        queryValue: '1',
        projectMode: 'off',
      })
    ).toEqual({ enabled: true, source: 'query', mode: 'off' })
    expect(
      resolveWorkbookNetting({ projectMode: 'on' })
    ).toEqual({ enabled: true, source: 'project', mode: 'on' })
    expect(
      resolveWorkbookNetting({ projectMode: 'off', orgDefault: true })
    ).toEqual({ enabled: false, source: 'project', mode: 'off' })
  })

  it('falls back org → platform → env when project inherits', () => {
    delete process.env.GHANA_BRS_WORKBOOK_NETTING
    expect(resolveWorkbookNetting({ orgDefault: true })).toEqual({
      enabled: true,
      source: 'org',
      mode: 'inherit',
    })
    expect(resolveWorkbookNetting({ orgDefault: false })).toEqual({
      enabled: false,
      source: 'org',
      mode: 'inherit',
    })
    expect(resolveWorkbookNetting({ platformDefault: true })).toEqual({
      enabled: true,
      source: 'platform',
      mode: 'inherit',
    })
    process.env.GHANA_BRS_WORKBOOK_NETTING = '1'
    expect(resolveWorkbookNetting({})).toEqual({ enabled: true, source: 'env', mode: 'inherit' })
    expect(resolveWorkbookNetting({ orgDefault: false })).toEqual({
      enabled: false,
      source: 'org',
      mode: 'inherit',
    })
  })

  it('workbookNettingEnabled and workbookNettingFromRequest delegate to resolver', () => {
    delete process.env.GHANA_BRS_WORKBOOK_NETTING
    expect(workbookNettingEnabled({ projectMode: 'on' })).toBe(true)
    expect(workbookNettingFromRequest(undefined)).toBe(false)
    process.env.GHANA_BRS_WORKBOOK_NETTING = '1'
    expect(workbookNettingFromRequest(undefined)).toBe(true)
    expect(workbookNettingFromRequest('0')).toBe(false)
  })
})
