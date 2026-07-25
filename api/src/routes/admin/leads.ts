import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'

const router = Router()

router.get('/', async (req, res) => {
  const source = typeof req.query.source === 'string' ? req.query.source : undefined
  const contacted =
    req.query.contacted === 'true' ? true : req.query.contacted === 'false' ? false : undefined
  const limit = Math.min(parseInt(String(req.query.limit || '100'), 10) || 100, 500)

  const leads = await prisma.lead.findMany({
    where: {
      ...(source ? { source } : {}),
      ...(contacted === true
        ? { contactedAt: { not: null } }
        : contacted === false
          ? { contactedAt: null }
          : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
  res.json({ leads })
})

router.patch('/:id', async (req, res) => {
  const id = req.params.id
  const body = z
    .object({
      contacted: z.boolean(),
    })
    .safeParse(req.body ?? {})
  if (!body.success) {
    return res.status(400).json({ error: 'Invalid body' })
  }
  try {
    const lead = await prisma.lead.update({
      where: { id },
      data: { contactedAt: body.data.contacted ? new Date() : null },
    })
    res.json({ lead })
  } catch {
    res.status(404).json({ error: 'Lead not found' })
  }
})

export default router
