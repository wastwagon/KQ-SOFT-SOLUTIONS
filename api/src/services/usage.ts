import { prisma } from '../lib/prisma.js'
import { getPlanBySlug } from './plan.js'
import { getLimits, isUnlimited } from '../config/subscription.js'
import { countOrgBankAccounts, getPlanQuotaLimits } from './planLimits.js'
import { currentPeriod, usagePeriodBounds } from './usagePeriod.js'
import { getOrgSubscriptionStatus } from './orgSubscriptionAccess.js'

export { currentPeriod, usagePeriodBounds }

/**
 * Admin complimentary trials (paid plan slug + trial end, no payment) use Free-tier
 * project/transaction caps from the Plans CMS until the org pays or trial ends.
 */
export async function resolveUsageQuotaPlanSlug(
  organizationId: string,
  planSlug: string
): Promise<string> {
  if (planSlug === 'free') return 'free'
  const status = await getOrgSubscriptionStatus(organizationId)
  if (status === 'trial') return 'free'
  return planSlug
}

/** Upsert monthly usage row — safe under concurrent create/increment. */
export async function getOrCreateUsage(organizationId: string, period: string) {
  return prisma.usageLog.upsert({
    where: {
      organizationId_period: { organizationId, period },
    },
    create: {
      organizationId,
      period,
      projectsCount: 0,
      transactionsCount: 0,
      cleanExportsCount: 0,
    },
    update: {},
  })
}

export async function getUsageWithLimits(organizationId: string, planSlug: string) {
  const period = currentPeriod()
  const log = await getOrCreateUsage(organizationId, period)
  const quotaPlanSlug = await resolveUsageQuotaPlanSlug(organizationId, planSlug)
  const planData = await getPlanBySlug(quotaPlanSlug)
  const quota = await getPlanQuotaLimits(planSlug)
  const limits = planData
    ? {
        projectsPerMonth: planData.projectsPerMonth,
        transactionsPerMonth: planData.transactionsPerMonth,
      }
    : getLimits(quotaPlanSlug)
  const bankAccountsUsed = await countOrgBankAccounts(organizationId)
  const bankAccountsLimit = quota.bankAccounts
  const bankAccountsUnlimited = isUnlimited(bankAccountsLimit)
  const cleanExportsLimit = quota.cleanExportsPerMonth
  const cleanExportsUnlimited = isUnlimited(cleanExportsLimit)
  const { startsAt, endsAt } = usagePeriodBounds(period)
  return {
    period,
    periodStartsAt: startsAt.toISOString(),
    periodEndsAt: endsAt.toISOString(),
    /** Plan slug used for monthly project/transaction caps (may be `free` during admin trial). */
    quotaPlanSlug,
    assignedPlanSlug: planSlug,
    projectsUsed: log.projectsCount,
    projectsLimit: limits.projectsPerMonth,
    projectsUnlimited: isUnlimited(limits.projectsPerMonth),
    transactionsUsed: log.transactionsCount,
    transactionsLimit: limits.transactionsPerMonth,
    transactionsUnlimited: isUnlimited(limits.transactionsPerMonth),
    bankAccountsUsed,
    bankAccountsLimit,
    bankAccountsUnlimited,
    cleanExportsUsed: log.cleanExportsCount,
    cleanExportsLimit,
    cleanExportsUnlimited,
  }
}

export async function canCreateProject(organizationId: string, plan: string): Promise<{ ok: boolean; message?: string }> {
  const usage = await getUsageWithLimits(organizationId, plan)
  if (usage.projectsUnlimited) return { ok: true }
  if (usage.projectsUsed >= usage.projectsLimit) {
    return { ok: false, message: `Project limit reached (${usage.projectsLimit}/month). Upgrade to create more.` }
  }
  return { ok: true }
}

export async function canAddTransactions(
  organizationId: string,
  plan: string,
  count: number
): Promise<{ ok: boolean; message?: string }> {
  const usage = await getUsageWithLimits(organizationId, plan)
  if (usage.transactionsUnlimited) return { ok: true }
  if (usage.transactionsUsed + count > usage.transactionsLimit) {
    return {
      ok: false,
      message: `Monthly transaction volume would be exceeded (${usage.transactionsUsed + count} > ${usage.transactionsLimit} this calendar month). Upgrade, or wait until ${usage.periodEndsAt.slice(0, 10)} when usage resets.`,
    }
  }
  return { ok: true }
}

export async function incrementProjects(organizationId: string): Promise<void> {
  const period = currentPeriod()
  await getOrCreateUsage(organizationId, period)
  await prisma.usageLog.update({
    where: { organizationId_period: { organizationId, period } },
    data: { projectsCount: { increment: 1 } },
  })
}

export async function incrementTransactions(organizationId: string, count: number): Promise<void> {
  if (count === 0) return
  await adjustTransactions(organizationId, count)
}

export async function canExportFullClean(
  organizationId: string,
  plan: string
): Promise<{ ok: boolean; message?: string; used?: number; limit?: number }> {
  const usage = await getUsageWithLimits(organizationId, plan)
  if (usage.cleanExportsUnlimited) return { ok: true, used: usage.cleanExportsUsed, limit: -1 }
  if (usage.cleanExportsUsed >= usage.cleanExportsLimit) {
    return {
      ok: false,
      used: usage.cleanExportsUsed,
      limit: usage.cleanExportsLimit,
      message: `Full clean export limit reached (${usage.cleanExportsLimit}/month). Download a sample file, or upgrade for more full exports.`,
    }
  }
  return { ok: true, used: usage.cleanExportsUsed, limit: usage.cleanExportsLimit }
}

export async function incrementCleanExports(organizationId: string): Promise<void> {
  const period = currentPeriod()
  await getOrCreateUsage(organizationId, period)
  await prisma.usageLog.update({
    where: { organizationId_period: { organizationId, period } },
    data: { cleanExportsCount: { increment: 1 } },
  })
}

/** Apply delta to monthly transaction meter (re-map safe; never below zero). */
export async function adjustTransactions(organizationId: string, delta: number): Promise<void> {
  if (delta === 0) return
  const period = currentPeriod()
  const log = await getOrCreateUsage(organizationId, period)
  if (delta > 0) {
    await prisma.usageLog.update({
      where: { organizationId_period: { organizationId, period } },
      data: { transactionsCount: { increment: delta } },
    })
    return
  }
  await prisma.usageLog.update({
    where: { organizationId_period: { organizationId, period } },
    data: { transactionsCount: Math.max(0, log.transactionsCount + delta) },
  })
}
