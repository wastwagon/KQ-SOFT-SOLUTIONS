import { prisma } from '../lib/prisma.js'
import { getPlanBySlug } from './plan.js'
import { getLimits, isUnlimited } from '../config/subscription.js'

export interface PlanQuotaLimits {
  projectsPerMonth: number
  transactionsPerMonth: number
  bankAccountsPerProject: number
}

const CONFIG_BANK_ACCOUNTS: Record<string, number> = {
  basic: 2,
  standard: -1,
  premium: -1,
  firm: -1,
}

export async function getPlanQuotaLimits(planSlug: string): Promise<PlanQuotaLimits> {
  const planData = await getPlanBySlug(planSlug)
  const limits = planData
    ? {
        projectsPerMonth: planData.projectsPerMonth,
        transactionsPerMonth: planData.transactionsPerMonth,
        bankAccountsPerProject: CONFIG_BANK_ACCOUNTS[planSlug] ?? CONFIG_BANK_ACCOUNTS.basic,
      }
    : {
        ...getLimits(planSlug),
        bankAccountsPerProject: CONFIG_BANK_ACCOUNTS[planSlug] ?? CONFIG_BANK_ACCOUNTS.basic,
      }
  return limits
}

export async function canAddBankAccount(
  projectId: string,
  planSlug: string
): Promise<{ ok: boolean; message?: string }> {
  const limits = await getPlanQuotaLimits(planSlug)
  if (isUnlimited(limits.bankAccountsPerProject)) return { ok: true }
  const count = await prisma.bankAccount.count({ where: { projectId } })
  if (count >= limits.bankAccountsPerProject) {
    return {
      ok: false,
      message: `Your plan allows up to ${limits.bankAccountsPerProject} bank account(s) per project. Upgrade for more.`,
    }
  }
  return { ok: true }
}
