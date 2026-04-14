import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { invalidatePlanCache } from '../../services/plan.js'

const router = Router()

const STANDARD_SLUGS = ['basic', 'standard', 'premium', 'firm'] as const
const createPlanSchema = z.object({
  slug: z.enum(STANDARD_SLUGS),
  name: z.string().min(1),
  projectsPerMonth: z.number().int(),
  transactionsPerMonth: z.number().int(),
  monthlyGhs: z.number().min(0),
  yearlyGhs: z.number().min(0),
  active: z.boolean().optional().default(true),
})

const updatePlanSchema = createPlanSchema.partial()

router.get('/', async (_req, res) => {
  const plans = await prisma.plan.findMany({
    orderBy: { slug: 'asc' },
  })
  res.json(plans)
})

router.post('/', async (req, res) => {
  const body = createPlanSchema.parse(req.body)
  const existing = await prisma.plan.findUnique({ where: { slug: body.slug } })
  if (existing) return res.status(400).json({ error: 'Plan slug already exists' })
  const plan = await prisma.plan.create({ data: body })
  invalidatePlanCache()
  res.status(201).json(plan)
})

router.get('/:id', async (req, res) => {
  const plan = await prisma.plan.findUnique({ where: { id: req.params.id } })
  if (!plan) return res.status(404).json({ error: 'Plan not found' })
  res.json(plan)
})

router.put('/:id', async (req, res) => {
  const body = updatePlanSchema.parse(req.body)
  if (body.slug) {
    const existing = await prisma.plan.findFirst({
      where: { slug: body.slug, NOT: { id: req.params.id } },
    })
    if (existing) return res.status(400).json({ error: 'Plan slug already exists' })
  }
  const plan = await prisma.plan.update({
    where: { id: req.params.id },
    data: body,
  })
  invalidatePlanCache()
  res.json(plan)
})

router.delete('/:id', async (req, res) => {
  const plan = await prisma.plan.findUnique({ where: { id: req.params.id } })
  if (!plan) return res.status(404).json({ error: 'Plan not found' })
  const orgsWithPlan = await prisma.organization.count({
    where: { plan: plan.slug },
  })
  if (orgsWithPlan > 0) {
    return res.status(400).json({ error: `Cannot delete plan: ${orgsWithPlan} organization(s) use it` })
  }
  await prisma.plan.delete({ where: { id: req.params.id } })
  invalidatePlanCache()
  res.status(204).send()
})

export default router
