import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/platformDefaults.js', () => ({
  getPlatformDefaults: vi.fn(async () => ({
    useManualRatesOnly: false,
    manualRates: {},
  })),
}))

import { getMarketingFxRates } from './currencyConversion.js'

describe('getMarketingFxRates', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns live USD/EUR/GBP when the provider responds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          rates: { USD: 0.07, EUR: 0.065, GBP: 0.055 },
        }),
      })),
    )

    const fx = await getMarketingFxRates()
    expect(fx.source).toBe('live')
    expect(fx.perGhs).toEqual({ USD: 0.07, EUR: 0.065, GBP: 0.055 })
  })

  it('falls back when the provider fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })))

    const fx = await getMarketingFxRates()
    expect(['fallback', 'manual']).toContain(fx.source)
    expect(fx.perGhs.USD).toBeGreaterThan(0)
    expect(fx.perGhs.GBP).toBeGreaterThan(0)
  })
})
