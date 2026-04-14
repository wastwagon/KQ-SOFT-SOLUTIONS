import { Router } from 'express'
import { prisma } from '../../lib/prisma.js'

const router = Router()

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
      include: { organization: { select: { id: true, name: true } } },
    }),
    prisma.payment.count({ where }),
  ])

  res.json({
    payments,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
})

export default router
