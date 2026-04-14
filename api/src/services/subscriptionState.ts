import type { Organization, Payment } from '@prisma/client'

export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'free'

export interface SubscriptionSnapshot {
  status: SubscriptionStatus
  trialEndsAt: string | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  latestPaymentAt: string | null
  latestPaymentPeriod: 'monthly' | 'yearly' | null
  latestPaymentAmount: number | null
}

export interface SubscriptionOverrides {
  trialEndsAt?: Date | null
  status?: SubscriptionStatus | null
}

export function getSubscriptionSnapshot(
  org: Pick<Organization, 'createdAt'>,
  latestPayment: Pick<Payment, 'createdAt' | 'period' | 'amount'> | null,
  overrides?: SubscriptionOverrides
): SubscriptionSnapshot {
  const now = new Date()
  const trialDays = Math.max(parseInt(process.env.TRIAL_DAYS || '14', 10) || 14, 1)
  const defaultTrialEnds = new Date(org.createdAt.getTime() + trialDays * 24 * 60 * 60 * 1000)
  const trialEnds = overrides?.trialEndsAt ?? defaultTrialEnds
  const forcedStatus = overrides?.status ?? null

  if (!latestPayment) {
    const status: SubscriptionStatus = forcedStatus || (now <= trialEnds ? 'trial' : 'free')
    return {
      status,
      trialEndsAt: trialEnds.toISOString(),
      currentPeriodStart: null,
      currentPeriodEnd: null,
      latestPaymentAt: null,
      latestPaymentPeriod: null,
      latestPaymentAmount: null,
    }
  }

  const periodDays = latestPayment.period === 'yearly' ? 365 : 30
  const periodStart = latestPayment.createdAt
  const periodEnd = new Date(periodStart.getTime() + periodDays * 24 * 60 * 60 * 1000)
  const status: SubscriptionStatus = forcedStatus || (now <= periodEnd ? 'active' : 'expired')

  return {
    status,
    trialEndsAt: trialEnds.toISOString(),
    currentPeriodStart: periodStart.toISOString(),
    currentPeriodEnd: periodEnd.toISOString(),
    latestPaymentAt: latestPayment.createdAt.toISOString(),
    latestPaymentPeriod: latestPayment.period === 'yearly' ? 'yearly' : 'monthly',
    latestPaymentAmount: Number(latestPayment.amount),
  }
}
