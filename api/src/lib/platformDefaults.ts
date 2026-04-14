/** Cached platform generation defaults — used when org branding is empty or for API rate limit */
import { prisma } from './prisma.js'

const KEY = 'generation'
const CACHE_TTL_MS = 60_000 // 1 minute

let cache: { value: PlatformDefaults; expiresAt: number } | null = null

export interface PlatformDefaults {
  defaultReportTitle: string
  defaultFooter: string
  defaultPrimaryColor: string
  defaultSecondaryColor: string
  apiRateLimitPerMin: number
  defaultCurrency: string
  manualRates?: { GHS_USD?: number | null; GHS_EUR?: number | null }
  useManualRatesOnly?: boolean
  /** Matching: amount tolerance (±) for amount match. Default 0.01 */
  amountTolerance?: number
  /** Matching: date window in days for date match. Default 3 */
  dateWindowDays?: number
  /** Data retention: years to keep audit/data (documentation only; deletion not implemented). Default 7 */
  dataRetentionYears?: number
}

const DEFAULTS: PlatformDefaults = {
  defaultReportTitle: 'Bank Reconciliation Statement',
  defaultFooter: 'Prepared by your organisation',
  defaultPrimaryColor: '#16a34a',
  defaultSecondaryColor: '#15803d',
  apiRateLimitPerMin: 100,
  defaultCurrency: 'GHS',
  amountTolerance: 0.01,
  dateWindowDays: 3,
  dataRetentionYears: 7,
}

export async function getPlatformDefaults(): Promise<PlatformDefaults> {
  const now = Date.now()
  if (cache && now < cache.expiresAt) return cache.value
  const row = await prisma.platformSettings.findUnique({ where: { key: KEY } })
  const value = (row?.value as Record<string, unknown>) ?? {}
  const manualRates = value.manualRates as Record<string, number> | undefined
  const amountTolerance = typeof value.amountTolerance === 'number' && value.amountTolerance >= 0 ? value.amountTolerance : DEFAULTS.amountTolerance!
  const dateWindowDays = typeof value.dateWindowDays === 'number' && value.dateWindowDays >= 0 ? value.dateWindowDays : DEFAULTS.dateWindowDays!
  const result: PlatformDefaults = {
    defaultReportTitle: (value.defaultReportTitle as string) ?? DEFAULTS.defaultReportTitle,
    defaultFooter: (value.defaultFooter as string) ?? DEFAULTS.defaultFooter,
    defaultPrimaryColor: (value.defaultPrimaryColor as string) ?? DEFAULTS.defaultPrimaryColor,
    defaultSecondaryColor: (value.defaultSecondaryColor as string) ?? DEFAULTS.defaultSecondaryColor,
    apiRateLimitPerMin: typeof value.apiRateLimitPerMin === 'number' ? value.apiRateLimitPerMin : DEFAULTS.apiRateLimitPerMin,
    defaultCurrency: (value.defaultCurrency as string) ?? DEFAULTS.defaultCurrency,
    manualRates: manualRates ? { GHS_USD: manualRates.GHS_USD ?? null, GHS_EUR: manualRates.GHS_EUR ?? null } : undefined,
    useManualRatesOnly: value.useManualRatesOnly === true,
    amountTolerance,
    dateWindowDays,
    dataRetentionYears: typeof value.dataRetentionYears === 'number' && value.dataRetentionYears > 0 ? value.dataRetentionYears : DEFAULTS.dataRetentionYears!,
  }
  cache = { value: result, expiresAt: now + CACHE_TTL_MS }
  return result
}

/** Invalidate cache so next getPlatformDefaults() fetches fresh data (call after admin saves) */
export function invalidatePlatformDefaultsCache(): void {
  cache = null
}
