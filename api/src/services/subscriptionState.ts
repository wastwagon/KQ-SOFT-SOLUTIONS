import type { Organization, Payment } from '@prisma/client'

export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'free'

export interface SubscriptionSnapshot {
  status: SubscriptionStatus
  trialEndsAt: string | null
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  latestPaymentAt: string | null
  latestPaymentPeriod: 'monthly' | 'quarterly' | 'yearly' | null
  latestPaymentAmount: number | null
}

export interface SubscriptionOverrides {
  trialEndsAt?: Date | null
  status?: SubscriptionStatus | null
}

export function getSubscriptionSnapshot(
  org: Pick<Organization, 'createdAt'> & { plan?: string },
  latestPayment: Pick<Payment, 'createdAt' | 'period' | 'amount'> | null,
  overrides?: SubscriptionOverrides
): SubscriptionSnapshot {
  const now = new Date()
  const trialEnds = overrides?.trialEndsAt ?? null
  const forcedStatus = overrides?.status ?? null

  /**
   * Firm / enterprise uses custom billing (no Paystack). Without a payment those orgs
   * would otherwise become `free`/`expired` and hit the paywall even though they
   * cannot self-serve renew. Keep them `active` unless an explicit status override
   * was set by platform admin.
   * Paid plans have no trial. The Free plan stays active with its own limits.
   * A trial end date applies only when platform admin sets one.
   */
  const applyFirmCustomBilling = (status: SubscriptionStatus): SubscriptionStatus => {
    if (
      org.plan === 'firm' &&
      forcedStatus == null &&
      (status === 'free' || status === 'expired')
    ) {
      return 'active'
    }
    return status
  }

  if (!latestPayment) {
    const status = applyFirmCustomBilling(
      forcedStatus ||
        (org.plan === 'free'
          ? 'active'
          : trialEnds && now <= trialEnds
            ? 'trial'
            : 'free')
    )
    return {
      status,
      trialEndsAt: trialEnds ? trialEnds.toISOString() : null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      latestPaymentAt: null,
      latestPaymentPeriod: null,
      latestPaymentAmount: null,
    }
  }

  const periodDays =
    latestPayment.period === 'yearly' ? 365 : latestPayment.period === 'quarterly' ? 90 : 30
  const periodStart = latestPayment.createdAt
  const periodEnd = new Date(periodStart.getTime() + periodDays * 24 * 60 * 60 * 1000)
  const status = applyFirmCustomBilling(
    forcedStatus || (now <= periodEnd ? 'active' : 'expired')
  )

  return {
    status,
    trialEndsAt: trialEnds ? trialEnds.toISOString() : null,
    currentPeriodStart: periodStart.toISOString(),
    currentPeriodEnd: periodEnd.toISOString(),
    latestPaymentAt: latestPayment.createdAt.toISOString(),
    latestPaymentPeriod:
      latestPayment.period === 'yearly'
        ? 'yearly'
        : latestPayment.period === 'quarterly'
          ? 'quarterly'
          : 'monthly',
    latestPaymentAmount: Number(latestPayment.amount),
  }
}
