import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { invalidatePlanCache, refreshPlanCache } from '../../services/plan.js'
import { PLAN_FEATURE_CATALOG, mergePlanFeatures } from '../../config/planFeatures.js'
import { parseStoredMarketing, type PlanMarketing } from '../../lib/planMarketing.js'
import {
  getMergedFeatureCatalog,
  getPricingPageConfig,
} from '../../services/pricingPageSettings.js'

const router = Router()

const planSlugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_-]*$/, 'Slug must start with a letter and use lowercase letters, numbers, _ or -')

const featuresSchema = z.record(z.string().max(64), z.boolean()).optional()

const marketingSchema = z
  .object({
    tagline: z.string().max(500).optional(),
    audience: z.string().max(200).optional(),
    badge: z.string().max(80).nullable().optional(),
    highlight: z.boolean().optional(),
    bullets: z.array(z.string().max(500)).max(32).optional(),
    inheritsFromLabel: z.string().max(200).nullable().optional(),
    ctaLabel: z.string().max(80).optional(),
    ctaHref: z.string().max(500).optional(),
    featureMatrix: z.record(z.union([z.boolean(), z.string()])).optional(),
  })
  .optional()

const planFieldsSchema = z.object({
  slug: planSlugSchema,
  name: z.string().min(1).max(120),
  projectsPerMonth: z.number().int(),
  transactionsPerMonth: z.number().int(),
  monthlyGhs: z.number().min(0),
  yearlyGhs: z.number().min(0),
  quarterlyGhs: z.number().min(0).optional(),
  bankAccounts: z.number().int().optional(),
  cleanExportsPerMonth: z.number().int().optional(),
  usersLimit: z.number().int().optional(),
  sortOrder: z.number().int().min(-1000).max(10000).optional(),
  showOnPublic: z.boolean().optional(),
  features: featuresSchema,
  marketing: marketingSchema,
  active: z.boolean().optional().default(true),
})

const createPlanSchema = planFieldsSchema
const updatePlanSchema = planFieldsSchema.partial()

function serializePlan(p: {
  slug: string
  features: unknown
  marketing?: unknown
  [key: string]: unknown
}) {
  const marketing = parseStoredMarketing(p.marketing, p.slug) as PlanMarketing
  return {
    ...p,
    features: mergePlanFeatures(p.slug, p.features),
    marketing,
  }
}

router.get('/', async (_req, res) => {
  const [plans, featureCatalog, pricingPage] = await Promise.all([
    prisma.plan.findMany({ orderBy: [{ sortOrder: 'asc' }, { slug: 'asc' }] }),
    getMergedFeatureCatalog(),
    getPricingPageConfig(),
  ])
  res.json({
    plans: plans.map(serializePlan),
    featureCatalog,
    comparisonGroups: pricingPage.featureGroups,
    extraFeatureCatalog: pricingPage.extraFeatureCatalog,
    builtInFeatureCatalog: PLAN_FEATURE_CATALOG,
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
      marketing: body.marketing ?? undefined,
      sortOrder: body.sortOrder ?? 0,
      showOnPublic: body.showOnPublic !== false,
    },
  })
  invalidatePlanCache()
  await refreshPlanCache()
  res.status(201).json(serializePlan(plan))
})

const reorderSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1),
})

/** Persist landing-page plan order (sortOrder = index × 10). */
router.put('/reorder', async (req, res) => {
  const { orderedIds } = reorderSchema.parse(req.body)
  const existing = await prisma.plan.findMany({ select: { id: true } })
  const valid = new Set(existing.map((p) => p.id))
  for (const id of orderedIds) {
    if (!valid.has(id)) return res.status(400).json({ error: `Unknown plan id: ${id}` })
  }
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.plan.update({ where: { id }, data: { sortOrder: index * 10 } })
    )
  )
  invalidatePlanCache()
  await refreshPlanCache()
  res.json({ ok: true, count: orderedIds.length })
})

router.get('/:id', async (req, res) => {
  const plan = await prisma.plan.findUnique({ where: { id: req.params.id } })
  if (!plan) return res.status(404).json({ error: 'Not found' })
  res.json(serializePlan(plan))
})

router.put('/:id', async (req, res) => {
  const body = updatePlanSchema.parse(req.body)
  const current = await prisma.plan.findUnique({ where: { id: req.params.id } })
  if (!current) return res.status(404).json({ error: 'Not found' })

  if (body.slug && body.slug !== current.slug) {
    const clash = await prisma.plan.findFirst({
      where: { slug: body.slug, NOT: { id: req.params.id } },
    })
    if (clash) return res.status(400).json({ error: 'Plan slug already exists' })
  }

  const plan = await prisma.$transaction(async (tx) => {
    if (body.slug && body.slug !== current.slug) {
      await tx.organization.updateMany({
        where: { plan: current.slug },
        data: { plan: body.slug },
      })
    }
    return tx.plan.update({
      where: { id: req.params.id },
      data: {
        ...body,
        ...(body.features ? { features: body.features } : {}),
        ...(body.marketing ? { marketing: body.marketing } : {}),
      },
    })
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
