import { Router } from 'express'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { canManageBilling } from '../lib/permissions.js'
import { hasPlanFeature } from '../config/planFeatures.js'
import { generateApiKey, hashApiKey, getKeyPrefix } from '../lib/apiKey.js'
import { requireOrgSubscriptionForApp } from '../middleware/requireOrgSubscriptionForApp.js'

const router = Router()
router.use(authMiddleware)
router.use(requireOrgSubscriptionForApp)

/**
 * Rate-limit API key creation per org.  A stolen admin JWT could otherwise
 * mint hundreds of long-lived API keys in seconds; capping creation gives
 * the audit log + admin a chance to react.
 */
const createApiKeyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  message: { error: 'Too many API keys created recently. Try again in an hour.' },
  keyGenerator: (req) => {
    const orgId = (req as AuthRequest).auth?.orgId
    if (orgId) return `org:${orgId}`
    return `ip:${ipKeyGenerator(req.ip || 'unknown')}`
  },
})

async function requireApiAccessPlan(req: AuthRequest, res: import('express').Response): Promise<boolean> {
  const org = await prisma.organization.findUnique({
    where: { id: req.auth!.orgId },
    select: { plan: true },
  })
  if (!org || !hasPlanFeature(org.plan, 'api_access')) {
    res.status(403).json({ error: 'API keys require Firm plan. Contact sales to upgrade.' })
    return false
  }
  return true
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  expiresAt: z.string().datetime().optional(),
})

router.get('/', async (req: AuthRequest, res) => {
  if (!(await requireApiAccessPlan(req, res))) return
  const role = req.auth!.role
  if (!canManageBilling(role)) {
    return res.status(403).json({ error: 'Admin only' })
  }
  const orgId = req.auth!.orgId
  const keys = await prisma.apiKey.findMany({
    where: { organizationId: orgId },
    select: { id: true, name: true, keyPrefix: true, lastUsedAt: true, expiresAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  res.json(keys)
})

router.post('/', createApiKeyLimiter, async (req: AuthRequest, res) => {
  if (!(await requireApiAccessPlan(req, res))) return
  const role = req.auth!.role
  if (!canManageBilling(role)) {
    return res.status(403).json({ error: 'Admin only' })
  }
  try {
    const body = createSchema.parse(req.body)
    const orgId = req.auth!.orgId
    const plainKey = generateApiKey()
    const keyHash = hashApiKey(plainKey)
    const keyPrefix = getKeyPrefix(plainKey)
    const record = await prisma.apiKey.create({
      data: {
        organizationId: orgId,
        name: body.name,
        keyHash,
        keyPrefix,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
      },
    })
    res.status(201).json({
      id: record.id,
      name: record.name,
      keyPrefix: record.keyPrefix,
      key: plainKey,
      expiresAt: record.expiresAt?.toISOString() ?? null,
      createdAt: record.createdAt.toISOString(),
    })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: e.errors[0]?.message })
    }
    res.status(500).json({ error: 'Failed to create API key' })
  }
})

router.delete('/:id', async (req: AuthRequest, res) => {
  if (!(await requireApiAccessPlan(req, res))) return
  const role = req.auth!.role
  if (!canManageBilling(role)) {
    return res.status(403).json({ error: 'Admin only' })
  }
  const orgId = req.auth!.orgId
  const record = await prisma.apiKey.findFirst({
    where: { id: req.params.id, organizationId: orgId },
  })
  if (!record) return res.status(404).json({ error: 'API key not found' })
  await prisma.apiKey.delete({ where: { id: record.id } })
  res.json({ deleted: true })
})

export default router
