import crypto from 'node:crypto'
import express from 'express'
import { Router } from 'express'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { getUsageWithLimits } from '../services/usage.js'
import { getPlanBySlug } from '../services/plan.js'
import { PLAN_PRICES } from '../config/subscription.js'
import { hasPlanFeature, type PlanFeature } from '../config/planFeatures.js'
import { getSubscriptionSnapshot } from '../services/subscriptionState.js'
import { fetchSubscriptionOverrides } from '../services/subscriptionOverrides.js'
import { isSubscriptionPaywallEnabled } from '../services/orgSubscriptionAccess.js'
import { logger } from '../middleware/logging.js'
import { pickOrgBillingEmail } from '../lib/orgBillingEmail.js'

const PAYABLE_PLANS = ['basic', 'standard', 'premium'] as const
/** Rank for upgrade/downgrade checks; `firm` is highest (custom billing, not self-service). */
const PLAN_SLUG_RANK: Record<string, number> = {
  basic: 1,
  standard: 2,
  premium: 3,
  firm: 4,
}
const initializeSchema = z.object({
  plan: z.enum(PAYABLE_PLANS),
  period: z.enum(['monthly', 'yearly']),
})

const PLAN_FEATURES: PlanFeature[] = [
  'bank_rules', 'bulk_match', 'ai_suggestions', 'audit_trail',
  'discrepancy_report', 'missing_cheques_report',
  'one_to_many', 'many_to_many', 'roll_forward', 'threshold_approval',
  'full_branding', 'firm_dashboard', 'api_access', 'multi_client',
]

const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET || ''
const INTRO_OFFER_ENABLED = process.env.INTRO_OFFER_ENABLED === 'true' || process.env.INTRO_OFFER_50_PCT === 'true'
const INTRO_OFFER_DISCOUNT = 0.5 // 50% off first payment
const router = Router()
router.use(authMiddleware)

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

export function computeWebhookSignature(rawBody: Buffer, secret: string): string {
  return crypto.createHmac('sha512', secret).update(rawBody).digest('hex')
}

export function parseWebhookEvent(rawBody: Buffer) {
  return JSON.parse(rawBody.toString('utf8')) as {
    event?: string
    data?: {
      reference?: string
      amount?: number
      currency?: string
      metadata?: { orgId?: string; plan?: string; period?: string; introOffer?: boolean }
    }
  }
}

export function isUniqueConstraintError(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
}

router.get('/usage', async (req: AuthRequest, res) => {
  const orgId = req.auth!.orgId
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
  const limits = planData
    ? { projectsPerMonth: planData.projectsPerMonth, transactionsPerMonth: planData.transactionsPerMonth }
    : { projectsPerMonth: 5, transactionsPerMonth: 500 }
  const features = Object.fromEntries(
    PLAN_FEATURES.map((f) => [f, hasPlanFeature(org.plan, f)])
  ) as Record<string, boolean>
  res.json({
    organization: { id: org.id, name: org.name, plan: org.plan },
    paywallEnabled: isSubscriptionPaywallEnabled(),
    features,
    usage: {
      ...usage,
      projectsDisplay: usage.projectsUnlimited ? `${usage.projectsUsed} (unlimited)` : `${usage.projectsUsed} / ${usage.projectsLimit}`,
      transactionsDisplay: usage.transactionsUnlimited ? `${usage.transactionsUsed} (unlimited)` : `${usage.transactionsUsed} / ${usage.transactionsLimit}`,
    },
    limits: {
      projectsPerMonth: limits.projectsPerMonth,
      transactionsPerMonth: limits.transactionsPerMonth,
    },
    subscription,
  })
})

router.get('/plans', async (req: AuthRequest, res) => {
  const orgId = req.auth?.orgId
  let introOfferEligible = false
  if (orgId && INTRO_OFFER_ENABLED) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { plan: true, introOfferUsedAt: true },
    })
    introOfferEligible = !!org && org.plan === 'basic' && !org.introOfferUsedAt
  }
  const planEntries = Object.entries(PLAN_PRICES).filter(([k]) => k !== 'firm')
  const plans = await Promise.all(
    planEntries.map(async ([planId]) => {
      const p = await getPlanBySlug(planId)
      if (p) {
        return {
          id: p.slug,
          name: p.name,
          monthlyGhs: p.monthlyGhs,
          yearlyGhs: p.yearlyGhs,
          projectsPerMonth: p.projectsPerMonth,
          transactionsPerMonth: p.transactionsPerMonth,
        }
      }
      const prices = PLAN_PRICES[planId]
      const { getLimits } = await import('../config/subscription.js')
      const limits = getLimits(planId)
      return {
        id: planId,
        name: planId.charAt(0).toUpperCase() + planId.slice(1),
        monthlyGhs: prices?.monthlyGhs ?? 0,
        yearlyGhs: prices?.yearlyGhs ?? 0,
        ...limits,
      }
    })
  )
  res.json({
    plans,
    paystackConfigured: !!PAYSTACK_SECRET,
    introOffer: INTRO_OFFER_ENABLED ? { discountPercent: 50, eligible: introOfferEligible, description: '50% off first payment' } : undefined,
  })
})

router.post('/initialize', authMiddleware, initializeLimiter, async (req: AuthRequest, res) => {
  const orgId = req.auth!.orgId
  if (!PAYSTACK_SECRET) {
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
  if (planData.monthlyGhs <= 0 && planData.yearlyGhs <= 0) {
    return res.status(400).json({
      error:
        'This plan has no online checkout amount (e.g. free Basic or custom Firm). Choose a paid tier to upgrade, or contact support for firm billing.',
    })
  }
  let amountGhs = period === 'yearly' ? planData.yearlyGhs : planData.monthlyGhs
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

  const introOfferApplied = INTRO_OFFER_ENABLED && org.plan === 'basic' && !org.introOfferUsedAt
  if (introOfferApplied) amountGhs = amountGhs * INTRO_OFFER_DISCOUNT

  const amountPesewas = Math.round(amountGhs * 100) // GHS to pesewas
  const ref = `brs_${orgId}_${plan}_${period}_${Date.now()}`
  const metadata: { orgId: string; plan: string; period: string; introOffer?: boolean } = { orgId, plan, period }
  if (introOfferApplied) metadata.introOffer = true

  try {
    const resp = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amountPesewas,
        currency: 'GHS',
        reference: ref,
        metadata,
      }),
    })
    const data = (await resp.json()) as { status?: boolean; data?: { authorization_url: string }; message?: string }
    if (!data.status || !data.data?.authorization_url) {
      return res.status(502).json({ error: data.message || 'Paystack initialization failed' })
    }
    res.json({
      authorizationUrl: data.data.authorization_url,
      reference: ref,
      introOfferApplied: introOfferApplied || undefined,
    })
  } catch (err) {
    logger.error({ err }, 'paystack: initialize failed')
    res.status(502).json({ error: 'Payment service unavailable' })
  }
})

export async function handlePaystackWebhook(req: express.Request, res: express.Response) {
  const secret = process.env.PAYSTACK_WEBHOOK_SECRET || PAYSTACK_SECRET
  const sig = req.headers['x-paystack-signature'] as string
  if (!sig || !secret) {
    return res.status(400).send('Missing signature or webhook secret')
  }
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from('')
  const hash = computeWebhookSignature(rawBody, secret)
  if (hash !== sig) {
    return res.status(400).send('Invalid signature')
  }
  let event: ReturnType<typeof parseWebhookEvent>
  try {
    event = parseWebhookEvent(rawBody)
  } catch {
    return res.status(400).send('Invalid JSON payload')
  }
  if (event.event === 'charge.success' && event.data?.metadata?.orgId) {
    const { orgId, plan, period, introOffer } = event.data.metadata
    if (orgId && plan && ['basic', 'standard', 'premium'].includes(plan)) {
      const amountRaw = event.data.amount ?? 0
      const amountGhs = amountRaw / 100 // pesewas -> GHS
      try {
        await prisma.$transaction([
          prisma.organization.update({
            where: { id: orgId },
            data: {
              plan,
              ...(introOffer && { introOfferUsedAt: new Date() }),
            },
          }),
          prisma.payment.create({
            data: {
              organizationId: orgId,
              amount: amountGhs,
              currency: event.data.currency ?? 'GHS',
              plan,
              period: period ?? 'monthly',
              reference: event.data.reference ?? null,
              status: 'success',
              paystackData: event.data as object,
            },
          }),
        ])
      } catch (e) {
        // Webhooks are retried; duplicate reference should be treated as idempotent success.
        if (!isUniqueConstraintError(e)) {
          throw e
        }
      }
    }
  }
  res.status(200).send('OK')
}

export default router
