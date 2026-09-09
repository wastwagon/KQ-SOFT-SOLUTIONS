import { prisma } from './prisma.js'
import { getUserLimit, hasPlanFeature, type PlanFeature } from '../config/planFeatures.js'
import { getPlanBySlug } from '../services/plan.js'

/** Load CMS entitlements for `plan`, then evaluate a feature flag. */
export async function planHasFeature(plan: string, feature: PlanFeature): Promise<boolean> {
  await getPlanBySlug(plan)
  return hasPlanFeature(plan, feature)
}

export async function planUserLimit(plan: string): Promise<number> {
  await getPlanBySlug(plan)
  return getUserLimit(plan)
}

export async function orgHasPlanFeature(orgId: string, feature: PlanFeature): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true },
  })
  if (!org) return false
  return planHasFeature(org.plan, feature)
}
