import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import {
  applyVerifiedPaystackCharge,
  verifyPaystackTransaction,
} from '../../services/paystackFulfillment.js'

const router = Router()

const verifySchema = z.object({
  reference: z.string().trim().min(3).max(200),
})

router.get('/', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20))
  const orgId = (req.query.orgId as string)?.trim() || undefined
  const skip = (page - 1) * limit

  const where = orgId ? { organizationId: orgId } : {}

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { organization: { select: { id: true, name: true, slug: true } } },
    }),
    prisma.payment.count({ where }),
  ])

  res.json({
    payments,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
})

/** Recover a Paystack-success payment that never updated the org (missed webhook / no callback). */
router.post('/verify', async (req, res) => {
  const parsed = verifySchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Payment reference is required.' })
  }
  const secret = (process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET || '').trim()
  if (!secret) {
    return res.status(503).json({ error: 'Billing not configured.' })
  }
  const { reference } = parsed.data
  const tx = await verifyPaystackTransaction(reference, secret)
  if (!tx) {
    return res.status(404).json({ error: 'Paystack could not find this transaction.' })
  }
  if (tx.status !== 'success') {
    return res.json({
      status: tx.status || 'pending',
      reference,
      message: 'Payment is not yet successful at Paystack.',
    })
  }
  try {
    const applied = await applyVerifiedPaystackCharge(tx)
    return res.json({
      status: 'success',
      reference,
      orgId: applied.orgId,
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

export default router
