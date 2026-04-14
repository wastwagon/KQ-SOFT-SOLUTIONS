/**
 * Currency conversion — ExchangeRate-API (free) with manual rate fallback.
 * Attribution: Rates by ExchangeRate-API (https://www.exchangerate-api.com)
 */
import { getPlatformDefaults } from '../lib/platformDefaults.js'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours
const EXCHANGE_RATE_API = 'https://api.exchangerate-api.com/v4/latest/GHS'

type Currency = 'GHS' | 'USD' | 'EUR'

let cache: { rates: Record<Currency, number>; expiresAt: number } | null = null

function buildRatesFromManual(manual: { GHS_USD?: number | null; GHS_EUR?: number | null }): Record<Currency, number> | null {
  const ghsUsd = manual?.GHS_USD
  const ghsEur = manual?.GHS_EUR
  if (ghsUsd == null || ghsEur == null || ghsUsd <= 0 || ghsEur <= 0) return null
  return {
    GHS: 1,
    USD: ghsUsd,
    EUR: ghsEur,
  }
}

async function fetchApiRates(): Promise<Record<Currency, number> | null> {
  try {
    const res = await fetch(EXCHANGE_RATE_API, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const data = (await res.json()) as { rates?: Record<string, number> }
    const r = data?.rates
    if (!r || typeof r.USD !== 'number' || typeof r.EUR !== 'number') return null
    return {
      GHS: 1,
      USD: r.USD,
      EUR: r.EUR,
    }
  } catch {
    return null
  }
}

/** Get rates (1 GHS = X USD, 1 GHS = X EUR). Uses manual rates when useManualRatesOnly or API fails. */
export async function getRates(): Promise<{ GHS: number; USD: number; EUR: number }> {
  const now = Date.now()
  if (cache && now < cache.expiresAt) return cache.rates

  const platformDefaults = await getPlatformDefaults()
  const manualRates = platformDefaults.manualRates
  const useManualOnly = platformDefaults.useManualRatesOnly ?? false

  const manualBuilt = buildRatesFromManual(manualRates ?? {})

  if (useManualOnly && manualBuilt) {
    cache = { rates: manualBuilt, expiresAt: now + CACHE_TTL_MS }
    return manualBuilt
  }

  const apiRates = await fetchApiRates()
  if (apiRates) {
    cache = { rates: apiRates, expiresAt: now + CACHE_TTL_MS }
    return apiRates
  }

  if (manualBuilt) {
    cache = { rates: manualBuilt, expiresAt: now + CACHE_TTL_MS }
    return manualBuilt
  }

  // Fallback: approximate rates (GHS as base)
  const fallback: Record<Currency, number> = { GHS: 1, USD: 0.0925, EUR: 0.0796 }
  cache = { rates: fallback, expiresAt: now + 60_000 }
  return fallback
}

/** Convert amount from one currency to another. */
export function convert(
  amount: number,
  from: string,
  to: string,
  rates?: { GHS: number; USD: number; EUR: number }
): number {
  const f = (from?.toUpperCase() || 'GHS') as Currency
  const t = (to?.toUpperCase() || 'GHS') as Currency
  if (f === t) return amount
  const r = rates ?? { GHS: 1, USD: 0.0925, EUR: 0.0796 }
  const fromRate = r[f] ?? 1
  const toRate = r[t] ?? 1
  return (amount * toRate) / fromRate
}
