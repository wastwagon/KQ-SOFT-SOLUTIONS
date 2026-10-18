import { prisma } from '../lib/prisma.js'
import { planRank } from '../config/planFeatures.js'
import { invalidateOrgSubscriptionCache } from './orgSubscriptionAccess.js'
import { logAudit } from './audit.js'

const SCHEDULE_PREFIX = 'org_scheduled_plan:'

export type ScheduledPlan = {
  plan: string
  effectiveAt: string
  requestedAt: string
}

export function scheduleKey(orgId: string): string {
  return `${SCHEDULE_PREFIX}${orgId}`
}

/** Unused portion of the last charge, in GHS, while that plan is still the current one. */
export function prorationCreditGhs(input: {
  now: Date
  paymentAt: Date
  period: string
  amount: number
  paymentPlan: string
  currentPlan: string
}): number {
  if (input.paymentPlan !== input.currentPlan) return 0
  if (!Number.isFinite(input.amount) || input.amount <= 0) return 0
  const days = input.period === 'yearly' ? 365 : input.period === 'quarterly' ? 90 : 30
  const start = input.paymentAt.getTime()
  const end = start + days * 24 * 60 * 60 * 1000
  const now = input.now.getTime()
  if (now >= end || end <= start) return 0
  const credit = input.amount * ((end - now) / (end - start))
  return Math.round(credit * 100) / 100
}

export function checkoutAmountAfterCredit(
  listAmount: number,
  credit: number
): { charge: number; creditApplied: number; covered: boolean } {
  const safeList = Math.max(0, listAmount)
  const creditApplied = Math.min(Math.max(0, credit), safeList)
  const charge = Math.round((safeList - creditApplied) * 100) / 100
  if (charge <= 0) return { charge: 0, creditApplied: safeList, covered: true }
  return { charge, creditApplied, covered: false }
}

/**
 * Seats fill with the oldest admins first, then the oldest other members.
 * limit < 0 means every member stays seated.
 */
export function seatedUserIds(
  members: { userId: string; role: string; createdAt: Date }[],
  limit: number
): Set<string> {
  if (limit < 0) return new Set(members.map((m) => m.userId))
  const sorted = [...members].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  const admins = sorted.filter((m) => m.role === 'admin')
  const others = sorted.filter((m) => m.role !== 'admin')
  const picked: string[] = []
  for (const member of [...admins, ...others]) {
    if (picked.length >= limit) break
    picked.push(member.userId)
  }
  return new Set(picked)
}

/** null means the plan has no bank-account cap. */
export function seatedBankAccountIds(
  accounts: { id: string; createdAt: Date }[],
  limit: number
): Set<string> | null {
  if (limit < 0) return null
  const sorted = [...accounts].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
  return new Set(sorted.slice(0, Math.max(0, limit)).map((a) => a.id))
}

export function rulesWithinCap<T>(rules: T[], cap: number): T[] {
  if (cap < 0) return rules
  return rules.slice(0, Math.max(0, cap))
}

export function isSelfServeDowngrade(currentPlan: string, targetPlan: string): boolean {
  const current = planRank(currentPlan)
  const target = planRank(targetPlan)
  if (current < 0 || target < 0) return false
  if (currentPlan === 'firm') return false
  return target < current
}

function parseScheduled(value: unknown): ScheduledPlan | null {
  if (!value || typeof value !== 'object') return null
  const rec = value as { plan?: unknown; effectiveAt?: unknown; requestedAt?: unknown }
  if (typeof rec.plan !== 'string' || typeof rec.effectiveAt !== 'string') return null
  const effective = new Date(rec.effectiveAt)
  if (Number.isNaN(effective.getTime())) return null
  return {
    plan: rec.plan,
    effectiveAt: effective.toISOString(),
    requestedAt: typeof rec.requestedAt === 'string' ? rec.requestedAt : effective.toISOString(),
  }
}

export async function readScheduledPlan(orgId: string): Promise<ScheduledPlan | null> {
  const row = await prisma.platformSettings.findUnique({
    where: { key: scheduleKey(orgId) },
    select: { value: true },
  })
  return parseScheduled(row?.value)
}

export async function clearScheduledPlan(orgId: string): Promise<void> {
  await prisma.platformSettings.deleteMany({ where: { key: scheduleKey(orgId) } })
}

export async function writeScheduledPlan(orgId: string, plan: string, effectiveAt: Date): Promise<ScheduledPlan> {
  const value: ScheduledPlan = {
    plan,
    effectiveAt: effectiveAt.toISOString(),
    requestedAt: new Date().toISOString(),
  }
  await prisma.platformSettings.upsert({
    where: { key: scheduleKey(orgId) },
    create: { key: scheduleKey(orgId), value },
    update: { value },
  })
  return value
}

/** Applies a due scheduled plan. Returns the new slug when it changes. */
export async function applyDueScheduledPlan(orgId: string, now = new Date()): Promise<string | null> {
  const scheduled = await readScheduledPlan(orgId)
  if (!scheduled) return null
  if (new Date(scheduled.effectiveAt).getTime() > now.getTime()) return null
  if (planRank(scheduled.plan) < 0) {
    await clearScheduledPlan(orgId)
    return null
  }
  await prisma.organization.update({
    where: { id: orgId },
    data: { plan: scheduled.plan },
  })
  await clearScheduledPlan(orgId)
  invalidateOrgSubscriptionCache(orgId)
  await logAudit({
    organizationId: orgId,
    action: 'plan_scheduled_applied',
    details: { plan: scheduled.plan, effectiveAt: scheduled.effectiveAt },
  })
  return scheduled.plan
}
