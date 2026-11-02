import { prisma } from '../lib/prisma.js'
import {
  DEFAULT_PRICING_PAGE,
  type PricingFeatureGroup,
  type PricingPageConfig,
} from '../config/pricingPageDefaults.js'
import { PLAN_FEATURE_CATALOG } from '../config/planFeatures.js'

const KEY = 'pricing_page'

let cache: PricingPageConfig | null = null

function parseFeatureRow(raw: unknown): { id: string; label: string; hint?: string } | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string' || !o.id.trim()) return null
  if (typeof o.label !== 'string' || !o.label.trim()) return null
  return {
    id: o.id.trim(),
    label: o.label.trim(),
    hint: typeof o.hint === 'string' ? o.hint.trim() : undefined,
  }
}

function parseGroups(raw: unknown): PricingFeatureGroup[] {
  if (!Array.isArray(raw)) return DEFAULT_PRICING_PAGE.featureGroups
  const groups: PricingFeatureGroup[] = []
  for (const g of raw) {
    if (!g || typeof g !== 'object') continue
    const o = g as Record<string, unknown>
    const title = typeof o.title === 'string' ? o.title.trim() : ''
    const featuresRaw = o.features
    if (!title || !Array.isArray(featuresRaw)) continue
    const features = featuresRaw.map(parseFeatureRow).filter(Boolean) as PricingFeatureGroup['features']
    if (features.length === 0) continue
    groups.push({ title, features })
  }
  return groups.length > 0 ? groups : DEFAULT_PRICING_PAGE.featureGroups
}

function parseExtraCatalog(raw: unknown): PricingPageConfig['extraFeatureCatalog'] {
  if (!Array.isArray(raw)) return []
  const out: PricingPageConfig['extraFeatureCatalog'] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    if (typeof o.id !== 'string' || !o.id.trim()) continue
    out.push({
      id: o.id.trim(),
      label: typeof o.label === 'string' && o.label.trim() ? o.label.trim() : o.id.trim(),
      hint: typeof o.hint === 'string' ? o.hint : '',
    })
  }
  return out
}

export function parsePricingPageConfig(raw: unknown): PricingPageConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PRICING_PAGE, extraFeatureCatalog: [] }
  const o = raw as Record<string, unknown>
  return {
    featureGroups: parseGroups(o.featureGroups),
    extraFeatureCatalog: parseExtraCatalog(o.extraFeatureCatalog),
  }
}

export async function getPricingPageConfig(): Promise<PricingPageConfig> {
  if (cache) return cache
  const row = await prisma.platformSettings.findUnique({ where: { key: KEY } })
  cache = parsePricingPageConfig(row?.value)
  return cache
}

export function invalidatePricingPageConfigCache(): void {
  cache = null
}

export async function savePricingPageConfig(config: PricingPageConfig): Promise<void> {
  await prisma.platformSettings.upsert({
    where: { key: KEY },
    create: { key: KEY, value: config },
    update: { value: config },
  })
  invalidatePricingPageConfigCache()
}

export async function getMergedFeatureCatalog(): Promise<
  { id: string; label: string; hint: string }[]
> {
  const page = await getPricingPageConfig()
  const byId = new Map<string, { id: string; label: string; hint: string }>()
  for (const f of PLAN_FEATURE_CATALOG) {
    byId.set(f.id, { id: f.id, label: f.label, hint: f.hint })
  }
  for (const f of page.extraFeatureCatalog) {
    byId.set(f.id, f)
  }
  return [...byId.values()]
}

export function allComparisonRowIds(groups: PricingFeatureGroup[]): string[] {
  return groups.flatMap((g) => g.features.map((f) => f.id))
}
