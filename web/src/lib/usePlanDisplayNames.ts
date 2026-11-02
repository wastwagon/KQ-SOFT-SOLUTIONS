import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import { publicPlanName } from './plans'

export type AdminPlanNameRow = { slug: string; name: string; sortOrder?: number }

async function fetchAdminPlansPayload() {
  const raw = await api('/admin/plans')
  if (Array.isArray(raw)) return { plans: raw as AdminPlanNameRow[] }
  return raw as { plans: AdminPlanNameRow[] }
}

export { fetchAdminPlansPayload }

/** CMS plan names for platform-admin screens (dedicated cache — full plans payload stays on `['admin', 'plans']`). */
export function usePlanDisplayNames(options?: { enabled?: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'plan-names'],
    queryFn: fetchAdminPlansPayload,
    staleTime: 60_000,
    enabled: options?.enabled !== false,
  })

  const bySlug = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of data?.plans ?? []) m.set(p.slug, p.name)
    return m
  }, [data?.plans])

  const planLabel = (slug: string | null | undefined) =>
    publicPlanName(slug, slug ? bySlug.get(slug) : undefined)

  return { planLabel, bySlug, plans: data?.plans ?? [], isLoading }
}

export function planLabelFromCatalog(
  slug: string | null | undefined,
  catalog: AdminPlanNameRow[] | undefined
): string {
  const row = catalog?.find((p) => p.slug === slug)
  return publicPlanName(slug, row?.name)
}

/** Highest self-serve paid tier slug (before `firm`) for platform-admin complimentary grants. */
export function complimentaryPlanSlug(
  catalog: (AdminPlanNameRow & { sortOrder?: number })[] | undefined
): string {
  if (!catalog?.length) return 'premium'
  const sorted = [...catalog].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.slug.localeCompare(b.slug)
  )
  const candidates = sorted.filter((p) => p.slug !== 'free' && p.slug !== 'firm')
  return candidates[candidates.length - 1]?.slug ?? 'premium'
}
