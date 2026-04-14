import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { canEditBankRules } from '../lib/permissions.js'
import { hasPlanFeature } from '../config/planFeatures.js'

const router = Router()
router.use(authMiddleware)

async function requireBankRulesPlan(req: AuthRequest, res: import('express').Response): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: req.auth!.orgId },
    select: { plan: true },
  })
  if (!org || !hasPlanFeature(org.plan, 'bank_rules')) {
    res.status(403).json({ error: 'Bank rules require Standard plan or higher. Upgrade to unlock.' })
    return false
  }
  return true
}

const conditionSchema = z.object({
  field: z.enum(['description', 'details', 'amount', 'name']),
  operator: z.enum(['equals', 'contains', 'starts_with', 'gt', 'gte', 'lt', 'lte']),
  value: z.union([z.string(), z.number()]),
})

const createSchema = z.object({
  name: z.string().min(1),
  priority: z.number().int().default(100),
  conditions: z.array(conditionSchema).min(1),
  action: z.enum(['suggest_match', 'flag_for_review']).default('suggest_match'),
})

const updateSchema = createSchema.partial()

router.get('/', async (req: AuthRequest, res) => {
  if (!(await requireBankRulesPlan(req, res))) return
  const orgId = req.auth!.orgId
  const rules = await prisma.bankRule.findMany({
    where: { organizationId: orgId },
    orderBy: { priority: 'asc' },
  })
  res.json({ rules })
})

router.post('/', async (req: AuthRequest, res) => {
  try {
    if (!(await requireBankRulesPlan(req, res))) return
    const role = req.auth!.role
    if (!canEditBankRules(role)) {
      return res.status(403).json({ error: 'Insufficient permission to manage bank rules' })
    }
    const orgId = req.auth!.orgId
    const body = createSchema.parse(req.body)
    const rule = await prisma.bankRule.create({
      data: {
        organizationId: orgId,
        name: body.name,
        priority: body.priority,
        conditions: body.conditions as object[],
        action: body.action,
      },
    })
    res.status(201).json(rule)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: e.errors[0]?.message })
    }
    res.status(500).json({ error: 'Failed to create rule' })
  }
})

router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    if (!(await requireBankRulesPlan(req, res))) return
    const role = req.auth!.role
    if (!canEditBankRules(role)) {
      return res.status(403).json({ error: 'Insufficient permission to manage bank rules' })
    }
    const { id } = req.params
    const orgId = req.auth!.orgId
    const body = updateSchema.parse(req.body)
    const existing = await prisma.bankRule.findFirst({
      where: { id, organizationId: orgId },
    })
    if (!existing) return res.status(404).json({ error: 'Rule not found' })
    const rule = await prisma.bankRule.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.priority !== undefined && { priority: body.priority }),
        ...(body.conditions !== undefined && { conditions: body.conditions as object[] }),
        ...(body.action !== undefined && { action: body.action }),
      },
    })
    res.json(rule)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: e.errors[0]?.message })
    }
    res.status(500).json({ error: 'Failed to update rule' })
  }
})

router.delete('/:id', async (req: AuthRequest, res) => {
  if (!(await requireBankRulesPlan(req, res))) return
  const role = req.auth!.role
  if (!canEditBankRules(role)) {
    return res.status(403).json({ error: 'Insufficient permission to manage bank rules' })
  }
  const { id } = req.params
  const orgId = req.auth!.orgId
  const existing = await prisma.bankRule.findFirst({
    where: { id, organizationId: orgId },
  })
  if (!existing) return res.status(404).json({ error: 'Rule not found' })
  await prisma.bankRule.delete({ where: { id } })
  res.json({ deleted: true })
})

export default router
