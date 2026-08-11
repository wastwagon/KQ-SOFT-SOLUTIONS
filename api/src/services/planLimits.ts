import { prisma } from '../lib/prisma.js'
import { getPlanBySlug } from './plan.js'
import { getLimits, isUnlimited, TIER_LIMITS } from '../config/subscription.js'

export interface PlanQuotaLimits {
  projectsPerMonth: number
  transactionsPerMonth: number
  /** Org-wide bank account seats (-1 = unlimited). */
  bankAccounts: number
  /**
   * @deprecated Alias of {@link bankAccounts} for older clients.
   * Limits are org-wide, not per project.
   */
  bankAccountsPerProject: number
  /** Full Tools clean Excel/PDF exports per month (-1 = unlimited). */
  cleanExportsPerMonth: number
}

export async function getPlanQuotaLimits(planSlug: string): Promise<PlanQuotaLimits> {
  const planData = await getPlanBySlug(planSlug)
  const bankAccounts = TIER_LIMITS[planSlug]?.bankAccounts ?? TIER_LIMITS.basic.bankAccounts
  const cleanExportsPerMonth =
    TIER_LIMITS[planSlug]?.cleanExportsPerMonth ?? TIER_LIMITS.basic.cleanExportsPerMonth
  const limits = planData
    ? {
        projectsPerMonth: planData.projectsPerMonth,
        transactionsPerMonth: planData.transactionsPerMonth,
        bankAccounts,
        bankAccountsPerProject: bankAccounts,
        cleanExportsPerMonth,
      }
    : {
        ...getLimits(planSlug),
        bankAccounts,
        bankAccountsPerProject: bankAccounts,
        cleanExportsPerMonth,
      }
  return limits
}

/** Count bank accounts across all projects in the organisation. */
export async function countOrgBankAccounts(organizationId: string): Promise<number> {
  return prisma.bankAccount.count({
    where: { project: { organizationId } },
  })
}

export async function canAddBankAccount(
  projectId: string,
  planSlug: string
): Promise<{ ok: boolean; message?: string }> {
  const limits = await getPlanQuotaLimits(planSlug)
  if (isUnlimited(limits.bankAccounts)) return { ok: true }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { organizationId: true },
  })
  if (!project) return { ok: false, message: 'Project not found' }

  const count = await countOrgBankAccounts(project.organizationId)
  if (count >= limits.bankAccounts) {
    return {
      ok: false,
      message: `Your plan allows up to ${limits.bankAccounts} bank account(s) across the workspace. Upgrade for more.`,
    }
  }
  return { ok: true }
}
