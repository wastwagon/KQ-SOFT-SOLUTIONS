import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { invalidatePlanCache, refreshPlanCache } from '../../services/plan.js'
import {
  PLAN_FEATURE_CATALOG,
  PLAN_FEATURE_IDS,
  mergePlanFeatures,
} from '../../config/planFeatures.js'

const router = Router()

const STANDARD_SLUGS = ['basic', 'standard', 'premium', 'firm'] as const
const featuresSchema = z
  .record(z.string(), z.boolean())
  .refine((obj) => Object.keys(obj).every((k) => (PLAN_FEATURE_IDS as string[]).includes(k)), {
    message: 'Unknown plan feature flag',
  })
  .optional()

const createPlanSchema = z.object({
  slug: z.enum(STANDARD_SLUGS),
  name: z.string().min(1),
  projectsPerMonth: z.number().int(),
  transactionsPerMonth: z.number().int(),
  monthlyGhs: z.number().min(0),
  yearlyGhs: z.number().min(0),
  quarterlyGhs: z.number().min(0).optional(),
  bankAccounts: z.number().int().optional(),
  cleanExportsPerMonth: z.number().int().optional(),
  usersLimit: z.number().int().optional(),
  features: featuresSchema,
  active: z.boolean().optional().default(true),
})

const updatePlanSchema = createPlanSchema.partial()

function serializePlan(p: {
  slug: string
  features: unknown
  [key: string]: unknown
}) {
  return {
    ...p,
    features: mergePlanFeatures(p.slug, p.features),
  }
}

router.get('/', async (_req, res) => {
  const plans = await prisma.plan.findMany({
    orderBy: { slug: 'asc' },
  })
  res.json({
    plans: plans.map(serializePlan),
    featureCatalog: PLAN_FEATURE_CATALOG,
  })
})

router.post('/', async (req, res) => {
  const body = createPlanSchema.parse(req.body)
  const existing = await prisma.plan.findUnique({ where: { slug: body.slug } })
  if (existing) return res.status(400).json({ error: 'Plan slug already exists' })
  const quarterlyGhs =
    body.quarterlyGhs && body.quarterlyGhs > 0
      ? body.quarterlyGhs
      : Math.round(body.monthlyGhs * 2.85)
  const plan = await prisma.plan.create({
    data: {
      ...body,
      quarterlyGhs,
      features: body.features ?? mergePlanFeatures(body.slug, null),
    },
  })
  invalidatePlanCache()
  await refreshPlanCache()
  res.status(201).json(serializePlan(plan))
})

router.get('/:id', async (req, res) => {
  const plan = await prisma.plan.findUnique({ where: { id: req.params.id } })
  if (!plan) return res.status(404).json({ error: 'Not found' })
  res.json(serializePlan(plan))
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
    data: {
      ...body,
      ...(body.features ? { features: body.features } : {}),
    },
  })
  invalidatePlanCache()
  await refreshPlanCache()
  res.json(serializePlan(plan))
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
  await refreshPlanCache()
  res.status(204).send()
})

export default router
