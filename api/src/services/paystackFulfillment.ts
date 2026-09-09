import crypto from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { logger } from '../middleware/logging.js'
import { invalidateOrgSubscriptionCache } from './orgSubscriptionAccess.js'
import { recordIntroOfferPayment } from './introOffer.js'

export const PAYABLE_PLANS = ['basic', 'standard', 'premium'] as const
export type PayablePlan = (typeof PAYABLE_PLANS)[number]
export const BILLING_PERIODS = ['monthly', 'quarterly', 'yearly'] as const
export type BillingPeriod = (typeof BILLING_PERIODS)[number]

export type CheckoutMetadata = {
  orgId?: string
  plan?: string
  period?: string
  introOffer?: boolean
}

export type ChargeFulfillment = {
  orgId: string
  plan: string
  period: string
  reference: string
  amountGhs: number
  currency: string
  introOffer?: boolean
  paystackData: object
}

export type PaystackVerifyData = {
  status?: string
  reference?: string
  amount?: number
  currency?: string
  metadata?: unknown
}

const CHECKOUT_REF_RE =
  /^brs_([a-z0-9]+)_((?:basic|standard|premium))_((?:monthly|quarterly|yearly))_(\d+)$/i

export function isPayablePlan(plan: string | undefined): plan is PayablePlan {
  return !!plan && (PAYABLE_PLANS as readonly string[]).includes(plan)
}

export function isBillingPeriod(period: string | undefined): period is BillingPeriod {
  return !!period && (BILLING_PERIODS as readonly string[]).includes(period)
}

export function isUniqueConstraintError(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
}

export function computeWebhookSignature(rawBody: Buffer, secret: string): string {
  return crypto.createHmac('sha512', secret).update(rawBody).digest('hex')
}

function signaturesMatch(expectedHex: string, provided: string): boolean {
  const a = Buffer.from(expectedHex, 'utf8')
  const b = Buffer.from(provided, 'utf8')
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

/** Paystack signs webhooks with the API secret key (not a Stripe-style whsec). */
export function paystackWebhookSecrets(): string[] {
  const secrets = [
    process.env.PAYSTACK_SECRET_KEY,
    process.env.PAYSTACK_SECRET,
    process.env.PAYSTACK_WEBHOOK_SECRET,
  ]
  return [...new Set(secrets.map((s) => (s || '').trim()).filter(Boolean))]
}

export function isValidPaystackSignature(rawBody: Buffer, signature: string | undefined): boolean {
  if (!signature) return false
  const secrets = paystackWebhookSecrets()
  if (secrets.length === 0) return false
  return secrets.some((secret) => signaturesMatch(computeWebhookSignature(rawBody, secret), signature))
}

export function parseWebhookEvent(rawBody: Buffer) {
  return JSON.parse(rawBody.toString('utf8')) as {
    event?: string
    data?: {
      reference?: string
      amount?: number
      currency?: string
      metadata?: unknown
    }
  }
}

/**
 * Checkout references are `brs_{orgId}_{plan}_{period}_{timestamp}`.
 * Org CUIDs have no underscores, so this round-trips even if Paystack drops metadata.
 */
export function parseCheckoutReference(reference: string | undefined): CheckoutMetadata | null {
  if (!reference) return null
  const m = CHECKOUT_REF_RE.exec(reference.trim())
  if (!m) return null
  return { orgId: m[1], plan: m[2]!.toLowerCase(), period: m[3]!.toLowerCase() }
}

function readCustomField(
  fields: unknown,
  names: string[]
): string | undefined {
  if (!Array.isArray(fields)) return undefined
  const want = new Set(names.map((n) => n.toLowerCase()))
  for (const field of fields) {
    if (!field || typeof field !== 'object') continue
    const rec = field as { variable_name?: unknown; display_name?: unknown; value?: unknown }
    const key = String(rec.variable_name || rec.display_name || '').toLowerCase()
    if (want.has(key) && rec.value != null && String(rec.value).trim()) {
      return String(rec.value).trim()
    }
  }
  return undefined
}

function coerceMetadataObject(metadata: unknown): Record<string, unknown> | null {
  if (metadata == null) return null
  if (typeof metadata === 'string') {
    const trimmed = metadata.trim()
    if (!trimmed) return null
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>
      }
    } catch {
      return null
    }
    return null
  }
  if (typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata as Record<string, unknown>
  }
  return null
}

export function extractCheckoutMetadata(metadata: unknown, reference?: string): CheckoutMetadata {
  const fromRef = parseCheckoutReference(reference) ?? {}
  const obj = coerceMetadataObject(metadata)
  if (!obj) return { ...fromRef }

  const custom = obj.custom_fields
  const orgId =
    (typeof obj.orgId === 'string' && obj.orgId) ||
    readCustomField(custom, ['orgid', 'org_id', 'organisation', 'organization']) ||
    fromRef.orgId
  const plan =
    (typeof obj.plan === 'string' && obj.plan) ||
    readCustomField(custom, ['plan']) ||
    fromRef.plan
  const period =
    (typeof obj.period === 'string' && obj.period) ||
    readCustomField(custom, ['period']) ||
    fromRef.period
  const introRaw = obj.introOffer ?? readCustomField(custom, ['introoffer', 'intro_offer'])
  const introOffer =
    introRaw === true ||
    introRaw === 'true' ||
    introRaw === '1' ||
    introRaw === 1

  return {
    orgId,
    plan: plan?.toLowerCase(),
    period: period?.toLowerCase(),
    introOffer: introOffer || undefined,
  }
}

export function publicAppOrigin(): string {
  const explicit = (process.env.PAYSTACK_CALLBACK_ORIGIN || '').trim()
  if (explicit) return explicit.replace(/\/+$/, '')
  const app = (process.env.APP_URL || '').trim()
  if (app) return app.replace(/\/+$/, '')
  const corsFirst = (process.env.CORS_ORIGIN || '').split(',')[0]?.trim()
  if (corsFirst) return corsFirst.replace(/\/+$/, '')
  return 'https://kqsoftwaresolutions.com'
}

/** SPA billing page Paystack redirects to after checkout. */
export function paystackCallbackUrl(): string {
  const override = (process.env.PAYSTACK_CALLBACK_URL || '').trim()
  if (override) return override
  return `${publicAppOrigin()}/settings/billing`
}

export function checkoutMetadataPayload(meta: {
  orgId: string
  plan: string
  period: string
  introOffer?: boolean
}) {
  const custom_fields = [
    { display_name: 'Organisation', variable_name: 'orgId', value: meta.orgId },
    { display_name: 'Plan', variable_name: 'plan', value: meta.plan },
    { display_name: 'Period', variable_name: 'period', value: meta.period },
  ]
  if (meta.introOffer) {
    custom_fields.push({ display_name: 'Intro offer', variable_name: 'introOffer', value: 'true' })
  }
  return {
    orgId: meta.orgId,
    plan: meta.plan,
    period: meta.period,
    ...(meta.introOffer ? { introOffer: true } : {}),
    custom_fields,
  }
}

export async function fulfillSuccessfulCharge(
  input: ChargeFulfillment
): Promise<'applied' | 'already_applied'> {
  const plan = input.plan.toLowerCase()
  const period = (input.period || 'monthly').toLowerCase()
  if (!isPayablePlan(plan)) {
    throw new Error(`Cannot fulfill unpaid / unknown plan "${input.plan}"`)
  }
  const safePeriod: BillingPeriod = isBillingPeriod(period) ? period : 'monthly'
  const reference = input.reference.trim()
  if (!reference) throw new Error('Missing payment reference')

  const existing = await prisma.payment.findUnique({ where: { reference } })
  const alreadySuccess = existing?.status === 'success'

  try {
    await prisma.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: input.orgId },
        data: { plan },
      })
      if (existing) {
        await tx.payment.update({
          where: { id: existing.id },
          data: {
            status: 'success',
            amount: input.amountGhs,
            currency: input.currency || 'GHS',
            plan,
            period: safePeriod,
            paystackData: input.paystackData as Prisma.InputJsonValue,
          },
        })
      } else {
        await tx.payment.create({
          data: {
            organizationId: input.orgId,
            amount: input.amountGhs,
            currency: input.currency || 'GHS',
            plan,
            period: safePeriod,
            reference,
            status: 'success',
            paystackData: input.paystackData as Prisma.InputJsonValue,
          },
        })
      }
    })
  } catch (e) {
    if (isUniqueConstraintError(e)) {
      await prisma.organization.update({
        where: { id: input.orgId },
        data: { plan },
      })
      invalidateOrgSubscriptionCache(input.orgId)
      return 'already_applied'
    }
    throw e
  }

  if (input.introOffer && !alreadySuccess) {
    await recordIntroOfferPayment(input.orgId)
  }
  invalidateOrgSubscriptionCache(input.orgId)
  logger.info(
    { orgId: input.orgId, plan, period: safePeriod, reference, result: alreadySuccess ? 'already_applied' : 'applied' },
    'paystack: subscription fulfilled'
  )
  return alreadySuccess ? 'already_applied' : 'applied'
}

export async function verifyPaystackTransaction(
  reference: string,
  secret: string
): Promise<PaystackVerifyData | null> {
  const resp = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${secret}` } }
  )
  const data = (await resp.json()) as {
    status?: boolean
    message?: string
    data?: PaystackVerifyData
  }
  if (!resp.ok || !data.status || !data.data) {
    logger.warn(
      { reference, status: resp.status, message: data.message },
      'paystack: verify failed'
    )
    return null
  }
  return data.data
}

export async function applyVerifiedPaystackCharge(
  tx: PaystackVerifyData
): Promise<{ orgId: string; plan: string; period: string; result: 'applied' | 'already_applied' }> {
  const reference = (tx.reference || '').trim()
  const meta = extractCheckoutMetadata(tx.metadata, reference)
  if (!meta.orgId || !isPayablePlan(meta.plan)) {
    throw Object.assign(new Error('Payment metadata is missing organisation or plan'), { status: 422 })
  }
  const amountRaw = tx.amount ?? 0
  const result = await fulfillSuccessfulCharge({
    orgId: meta.orgId,
    plan: meta.plan,
    period: meta.period || 'monthly',
    reference,
    amountGhs: amountRaw / 100,
    currency: tx.currency || 'GHS',
    introOffer: meta.introOffer,
    paystackData: tx as object,
  })
  return {
    orgId: meta.orgId,
    plan: meta.plan,
    period: meta.period || 'monthly',
    result,
  }
}
