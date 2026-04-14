import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'

const router = Router()

const updateUserSchema = z.object({
  name: z.string().optional(),
  suspendedAt: z.string().datetime().nullable().optional(),
})

router.get('/', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20))
  const search = (req.query.search as string)?.trim().toLowerCase() || ''
  const skip = (page - 1) * limit

  const where = search
    ? {
        OR: [
          { email: { contains: search, mode: 'insensitive' as const } },
          { name: { contains: search, mode: 'insensitive' as const } },
        ],
      }
    : {}

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        suspendedAt: true,
        createdAt: true,
        memberships: {
          select: { organizationId: true, role: true, organization: { select: { name: true } } },
        },
      },
    }),
    prisma.user.count({ where }),
  ])

  res.json({
    users,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
})

router.get('/:id', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      email: true,
      name: true,
      suspendedAt: true,
      createdAt: true,
      updatedAt: true,
      memberships: {
        include: { organization: { select: { id: true, name: true, slug: true, plan: true } } },
      },
    },
  })
  if (!user) return res.status(404).json({ error: 'User not found' })
  res.json(user)
})

router.patch('/:id', async (req, res) => {
  const existing = await prisma.user.findUnique({ where: { id: req.params.id } })
  if (!existing) return res.status(404).json({ error: 'User not found' })
  const body = updateUserSchema.parse(req.body)
  const data: { name?: string; suspendedAt?: Date | null } = {}
  if (body.name !== undefined) data.name = body.name
  if (body.suspendedAt !== undefined) data.suspendedAt = body.suspendedAt === null ? null : new Date(body.suspendedAt)
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data,
    select: { id: true, email: true, name: true, suspendedAt: true },
  })
  res.json(user)
})

export default router
