import express from 'express'
import { Router } from 'express'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { getUsageWithLimits } from '../services/usage.js'
import { getPlanBySlug, listSelfServePlans } from '../services/plan.js'
import { planAmountForPeriod, INTRO_OFFER_DISCOUNT, INTRO_OFFER_MONTHS } from '../config/subscription.js'
import { hasPlanFeature, PLAN_FEATURE_IDS } from '../config/planFeatures.js'
import { getSubscriptionSnapshot } from '../services/subscriptionState.js'
import { fetchSubscriptionOverrides } from '../services/subscriptionOverrides.js'
import { isSubscriptionPaywallEnabled } from '../services/orgSubscriptionAccess.js'
import { getPlanQuotaLimits } from '../services/planLimits.js'
import {
  isIntroOfferEnvEnabled,
  isOrgIntroOfferEligible,
  getIntroOfferPaymentsApplied,
} from '../services/introOffer.js'
import { logger } from '../middleware/logging.js'
import { pickOrgBillingEmail } from '../lib/orgBillingEmail.js'
import { isPlatformAdmin } from '../lib/platformAdmin.js'
import { canManageBilling } from '../lib/permissions.js'
import {
  PAYABLE_PLANS,
  applyVerifiedPaystackCharge,
  checkoutMetadataPayload,
  computeWebhookSignature,
  extractCheckoutMetadata,
  fulfillSuccessfulCharge,
  isPayablePlan,
  isUniqueConstraintError,
  isValidPaystackSignature,
  parseWebhookEvent,
  paystackCallbackUrl,
  publicAppOrigin,
  verifyPaystackTransaction,
} from '../services/paystackFulfillment.js'

export {
  computeWebhookSignature,
  isUniqueConstraintError,
  parseWebhookEvent,
}

/** Rank for upgrade/downgrade checks; `firm` is highest (custom billing, not self-service). */
const PLAN_SLUG_RANK: Record<string, number> = {
  basic: 1,
  standard: 2,
  premium: 3,
  firm: 4,
}
const initializeSchema = z.object({
  plan: z.enum(PAYABLE_PLANS),
  period: z.enum(['monthly', 'quarterly', 'yearly']),
})
const verifySchema = z.object({
  reference: z.string().trim().min(3).max(200),
})

const PLAN_FEATURES = PLAN_FEATURE_IDS

const router = Router()
router.use(authMiddleware)

function paystackSecret(): string {
  return (process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET || '').trim()
}

/**
 * Rate limit Paystack initialization.  Each call hits Paystack and creates a
 * pending payment row, so a runaway client (or a credential-stuffed account)
 * could otherwise exhaust our Paystack quota and pollute the payments table.
 *
 * Keyed by org id when authenticated so a noisy single user can't lock out
 * the rest of the firm.
 */
const initializeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  standardHeaders: true,
  message: { error: 'Too many payment attempts. Please wait a few minutes and try again.' },
  keyGenerator: (req) => {
    const orgId = (req as AuthRequest).auth?.orgId
    if (orgId) return `org:${orgId}`
    // Fall back to the library helper which correctly subnet-masks IPv6
    // addresses so a single client cannot bypass limits via random ::1234.
    return `ip:${ipKeyGenerator(req.ip || 'unknown')}`
  },
})

router.get('/usage', async (req: AuthRequest, res) => {
  const orgId = req.auth!.orgId
  const userId = req.auth!.userId
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
  })
  if (!org) return res.status(404).json({ error: 'Organization not found' })
  const usage = await getUsageWithLimits(orgId, org.plan)
  const latestPayment = await prisma.payment.findFirst({
    where: { organizationId: orgId, status: 'success' },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, period: true, amount: true },
  })
  const overrides = await fetchSubscriptionOverrides(orgId)
  const subscription = getSubscriptionSnapshot(org, latestPayment, overrides)
  const planData = await getPlanBySlug(org.plan)
  const quotaLimits = await getPlanQuotaLimits(org.plan)
  const limits = planData
    ? {
        projectsPerMonth: planData.projectsPerMonth,
        transactionsPerMonth: planData.transactionsPerMonth,
        bankAccounts: quotaLimits.bankAccounts,
        bankAccountsPerProject: quotaLimits.bankAccounts,
      }
    : quotaLimits
  const features = Object.fromEntries(
    PLAN_FEATURES.map((f) => [f, hasPlanFeature(org.plan, f)])
  ) as Record<string, boolean>

  let subscriptionBypass = false
  if (!String(userId).startsWith('apikey:')) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
    subscriptionBypass = !!(user?.email && isPlatformAdmin(user.email))
  }

  res.json({
    organization: { id: org.id, name: org.name, plan: org.plan },
    paywallEnabled: isSubscriptionPaywallEnabled(),
    /** Platform admins bypass org subscription gates for core product APIs. */
    subscriptionBypass,
    features,
    usage: {
      ...usage,
      projectsDisplay: usage.projectsUnlimited ? `${usage.projectsUsed} (unlimited)` : `${usage.projectsUsed} / ${usage.projectsLimit}`,
      transactionsDisplay: usage.transactionsUnlimited ? `${usage.transactionsUsed} (unlimited)` : `${usage.transactionsUsed} / ${usage.transactionsLimit}`,
      bankAccountsDisplay: usage.bankAccountsUnlimited
        ? `${usage.bankAccountsUsed} (unlimited)`
        : `${usage.bankAccountsUsed} / ${usage.bankAccountsLimit}`,
      cleanExportsDisplay: usage.cleanExportsUnlimited
        ? `${usage.cleanExportsUsed} (unlimited)`
        : `${usage.cleanExportsUsed} / ${usage.cleanExportsLimit}`,
    },
    limits: {
      projectsPerMonth: limits.projectsPerMonth,
      transactionsPerMonth: limits.transactionsPerMonth,
      bankAccounts: limits.bankAccounts,
      bankAccountsPerProject: limits.bankAccountsPerProject,
      cleanExportsPerMonth: quotaLimits.cleanExportsPerMonth,
    },
    subscription,
  })
})

router.get('/plans', async (req: AuthRequest, res) => {
  const orgId = req.auth?.orgId
  let introOfferEligible = false
  let introRemaining = 0
  if (orgId && isIntroOfferEnvEnabled()) {
    introOfferEligible = await isOrgIntroOfferEligible(orgId)
    if (introOfferEligible) {
      const applied = await getIntroOfferPaymentsApplied(orgId)
      introRemaining = Math.max(0, INTRO_OFFER_MONTHS - applied)
    }
  }
  const selfServe = await listSelfServePlans()
  const plans = await Promise.all(
    selfServe.map(async (p) => {
      const quota = await getPlanQuotaLimits(p.slug)
      return {
        id: p.slug,
        name: p.name,
        monthlyGhs: p.monthlyGhs,
        yearlyGhs: p.yearlyGhs,
        quarterlyGhs: p.quarterlyGhs,
        projectsPerMonth: p.projectsPerMonth,
        transactionsPerMonth: p.transactionsPerMonth,
        bankAccounts: quota.bankAccounts,
        cleanExportsPerMonth: quota.cleanExportsPerMonth,
        usersLimit: p.usersLimit,
        features: p.features,
        active: p.active,
      }
    })
  )
  res.json({
    plans,
    paystackConfigured: !!paystackSecret(),
    introOffer: isIntroOfferEnvEnabled()
      ? {
          discountPercent: 50,
          months: INTRO_OFFER_MONTHS,
          eligible: introOfferEligible,
          remainingPeriods: introRemaining,
          description: `50% off your first ${INTRO_OFFER_MONTHS} months`,
        }
      : undefined,
  })
})

router.post('/initialize', authMiddleware, initializeLimiter, async (req: AuthRequest, res) => {
  const orgId = req.auth!.orgId
  if (!canManageBilling(req.auth?.role)) {
    return res.status(403).json({ error: 'Only organisation admins can manage billing.' })
  }
  const secret = paystackSecret()
  if (!secret) {
    return res.status(503).json({ error: 'Billing not configured. Contact support to upgrade.' })
  }
  const parsed = initializeSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid plan or period.',
      details: parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    })
  }
  const { plan, period } = parsed.data
  const planData = await getPlanBySlug(plan)
  if (!planData) {
    return res.status(400).json({ error: 'Unknown plan.' })
  }
  if (!planData.active) {
    return res.status(400).json({ error: 'This plan is not available for checkout.' })
  }
  if (planData.monthlyGhs <= 0 && planData.yearlyGhs <= 0) {
    return res.status(400).json({
      error:
        'This plan has no online checkout amount (custom / contract plans). Choose a paid tier to upgrade, or contact support for firm billing.',
    })
  }
  let amountGhs = planAmountForPeriod(
    {
      monthlyGhs: planData.monthlyGhs,
      yearlyGhs: planData.yearlyGhs,
      quarterlyGhs: planData.quarterlyGhs,
    },
    period
  )
  if (amountGhs <= 0) return res.status(400).json({ error: 'Invalid billing period for this plan.' })

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: { members: { include: { user: true } } },
  })
  if (!org) return res.status(404).json({ error: 'Organization not found' })

  if (org.plan === 'firm') {
    return res.status(400).json({
      error: 'Firm and enterprise plans use custom billing. Contact support to change your subscription.',
    })
  }

  // Block downgrades through self-service billing — admins who need to switch
  // plans should contact support so we can prorate / reconcile entitlements.
  const currentRank = PLAN_SLUG_RANK[org.plan]
  const targetRank = PLAN_SLUG_RANK[plan]
  if (currentRank !== undefined && targetRank < currentRank) {
    return res.status(400).json({
      error: 'Plan downgrades are not supported via self-service. Contact support to switch to a lower tier.',
    })
  }

  const email = pickOrgBillingEmail(org.members)
  if (!email) {
    return res.status(400).json({ error: 'No billing email found for organization. Add a member email before upgrading.' })
  }

  const introOfferApplied = await isOrgIntroOfferEligible(orgId)
  if (introOfferApplied) amountGhs = amountGhs * INTRO_OFFER_DISCOUNT

  const amountPesewas = Math.round(amountGhs * 100) // GHS to pesewas
  const ref = `brs_${orgId}_${plan}_${period}_${Date.now()}`
  const callbackUrl = paystackCallbackUrl()
  const metadata = checkoutMetadataPayload({
    orgId,
    plan,
    period,
    introOffer: introOfferApplied || undefined,
  })

  try {
    const resp = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amountPesewas,
        currency: 'GHS',
        reference: ref,
        callback_url: callbackUrl,
        metadata,
      }),
    })
    const data = (await resp.json()) as { status?: boolean; data?: { authorization_url: string }; message?: string }
    if (!data.status || !data.data?.authorization_url) {
      return res.status(502).json({ error: data.message || 'Paystack initialization failed' })
    }
    try {
      await prisma.payment.create({
        data: {
          organizationId: orgId,
          amount: amountGhs,
          currency: 'GHS',
          plan,
          period,
          reference: ref,
          status: 'pending',
        },
      })
    } catch (err) {
      logger.warn({ err, reference: ref }, 'paystack: could not persist pending payment')
    }
    logger.info({ orgId, plan, period, reference: ref, callbackUrl }, 'paystack: checkout initialized')
    res.json({
      authorizationUrl: data.data.authorization_url,
      reference: ref,
      callbackUrl,
      introOfferApplied: introOfferApplied || undefined,
    })
  } catch (err) {
    logger.error({ err }, 'paystack: initialize failed')
    res.status(502).json({ error: 'Payment service unavailable' })
  }
})

router.post('/verify', async (req: AuthRequest, res) => {
  const orgId = req.auth!.orgId
  const secret = paystackSecret()
  if (!secret) {
    return res.status(503).json({ error: 'Billing not configured.' })
  }
  const parsed = verifySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payment reference is required.' })
  }
  const { reference } = parsed.data
  const owned = await prisma.payment.findFirst({
    where: { reference, organizationId: orgId },
    select: { id: true, status: true, plan: true, period: true, organizationId: true },
  })
  const fromRef = extractCheckoutMetadata(undefined, reference)
  if (!owned && fromRef.orgId && fromRef.orgId !== orgId) {
    return res.status(403).json({ error: 'This payment does not belong to your organisation.' })
  }
  if (!owned && !fromRef.orgId) {
    return res.status(404).json({ error: 'Unknown payment reference.' })
  }

  const tx = await verifyPaystackTransaction(reference, secret)
  if (!tx) {
    return res.status(404).json({ error: 'Paystack could not find this transaction.' })
  }
  const meta = extractCheckoutMetadata(tx.metadata, reference)
  const chargeOrgId = meta.orgId || owned?.organizationId
  if (chargeOrgId && chargeOrgId !== orgId) {
    return res.status(403).json({ error: 'This payment does not belong to your organisation.' })
  }
  if (tx.status !== 'success') {
    return res.json({
      status: tx.status || 'pending',
      reference,
      plan: owned?.plan ?? meta.plan ?? null,
      message: 'Payment is not yet successful at Paystack.',
    })
  }

  try {
    const applied = await applyVerifiedPaystackCharge(tx)
    return res.json({
      status: 'success',
      reference,
      plan: applied.plan,
      period: applied.period,
      alreadyApplied: applied.result === 'already_applied',
    })
  } catch (err) {
    const status = (err as { status?: number }).status
    if (status === 422) {
      return res.status(422).json({ error: err instanceof Error ? err.message : 'Could not map payment to a plan.' })
    }
    throw err
  }
})

/** Unauthenticated redirect so a dashboard-configured API callback still returns users to Billing. */
export function handlePaystackReturnRedirect(req: express.Request, res: express.Response) {
  const raw = String(req.query.reference || req.query.trxref || '').trim()
  const billing = `${publicAppOrigin()}/settings/billing`
  if (!raw) {
    return res.redirect(302, billing)
  }
  const url = new URL(billing)
  url.searchParams.set('reference', raw)
  return res.redirect(302, url.toString())
}

export async function handlePaystackWebhook(req: express.Request, res: express.Response) {
  const sig = req.headers['x-paystack-signature'] as string | undefined
  const rawBody = Buffer.isBuffer(req.body)
    ? req.body
    : typeof req.body === 'string'
      ? Buffer.from(req.body, 'utf8')
      : Buffer.from('')
  if (!isValidPaystackSignature(rawBody, sig)) {
    logger.warn('paystack: webhook signature rejected')
    return res.status(400).send('Invalid signature')
  }
  let event: ReturnType<typeof parseWebhookEvent>
  try {
    event = parseWebhookEvent(rawBody)
  } catch {
    return res.status(400).send('Invalid JSON payload')
  }
  if (event.event !== 'charge.success') {
    logger.info({ event: event.event }, 'paystack: webhook ignored')
    return res.status(200).send('OK')
  }

  const reference = event.data?.reference
  const meta = extractCheckoutMetadata(event.data?.metadata, reference)
  if (!meta.orgId || !isPayablePlan(meta.plan) || !reference) {
    logger.warn(
      { reference, orgId: meta.orgId, plan: meta.plan },
      'paystack: charge.success missing org/plan metadata'
    )
    return res.status(200).send('OK')
  }

  const amountRaw = event.data?.amount ?? 0
  try {
    await fulfillSuccessfulCharge({
      orgId: meta.orgId,
      plan: meta.plan,
      period: meta.period || 'monthly',
      reference,
      amountGhs: amountRaw / 100,
      currency: event.data?.currency ?? 'GHS',
      introOffer: meta.introOffer,
      paystackData: (event.data ?? {}) as object,
    })
  } catch (e) {
    if (!isUniqueConstraintError(e)) throw e
  }
  res.status(200).send('OK')
}

export default router
