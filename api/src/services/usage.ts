import { prisma } from '../lib/prisma.js'
import { getPlanBySlug } from './plan.js'
import { getLimits, isUnlimited } from '../config/subscription.js'

function currentPeriod(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

export async function getOrCreateUsage(organizationId: string, period: string) {
  let log = await prisma.usageLog.findFirst({
    where: { organizationId, period },
  })
  if (!log) {
    log = await prisma.usageLog.create({
      data: { organizationId, period, projectsCount: 0, transactionsCount: 0 },
    })
  }
  return log
}

export async function getUsageWithLimits(organizationId: string, planSlug: string) {
  const period = currentPeriod()
  const log = await getOrCreateUsage(organizationId, period)
  const planData = await getPlanBySlug(planSlug)
  const limits = planData
    ? { projectsPerMonth: planData.projectsPerMonth, transactionsPerMonth: planData.transactionsPerMonth }
    : getLimits(planSlug)
  return {
    period,
    projectsUsed: log.projectsCount,
    projectsLimit: limits.projectsPerMonth,
    projectsUnlimited: isUnlimited(limits.projectsPerMonth),
    transactionsUsed: log.transactionsCount,
    transactionsLimit: limits.transactionsPerMonth,
    transactionsUnlimited: isUnlimited(limits.transactionsPerMonth),
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
      message: `Transaction limit would be exceeded (${usage.transactionsUsed + count} > ${usage.transactionsLimit}/month). Upgrade for more.`,
    }
  }
  return { ok: true }
}

export async function incrementProjects(organizationId: string): Promise<void> {
  const period = currentPeriod()
  const log = await getOrCreateUsage(organizationId, period)
  await prisma.usageLog.update({
    where: { id: log.id },
    data: { projectsCount: log.projectsCount + 1 },
  })
}

export async function incrementTransactions(organizationId: string, count: number): Promise<void> {
  const period = currentPeriod()
  const log = await getOrCreateUsage(organizationId, period)
  await prisma.usageLog.update({
    where: { id: log.id },
    data: { transactionsCount: log.transactionsCount + count },
  })
}
