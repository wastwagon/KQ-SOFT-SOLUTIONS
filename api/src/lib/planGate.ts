import { prisma } from './prisma.js'
import { hasPlanFeature, type PlanFeature } from '../config/planFeatures.js'

export async function orgHasPlanFeature(orgId: string, feature: PlanFeature): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true },
  })
  return org ? hasPlanFeature(org.plan, feature) : false
}
