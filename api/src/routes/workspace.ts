import { Router } from 'express'
import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { requireOrgSubscriptionForApp } from '../middleware/requireOrgSubscriptionForApp.js'
import { orgHasPlanFeature } from '../lib/planGate.js'
import { isPlatformAdmin } from '../lib/platformAdmin.js'
import { runWorkspaceAgentSearch, isWorkspaceAgentConfigured } from '../services/workspaceAgentSearch.js'

const router = Router()
router.use(authMiddleware)
router.use(requireOrgSubscriptionForApp)

const agentSearchSchema = z.object({
  query: z.string().min(2).max(400),
})

const agentSearchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.WORKSPACE_AGENT_LIMIT_PER_MIN) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many assistant searches. Please wait a minute and try again.',
    code: 'RATE_LIMIT_AGENT',
  },
  keyGenerator: (req) => {
    const orgId = (req as AuthRequest).auth?.orgId
    return orgId ? `agent:${orgId}` : `agent:ip:${ipKeyGenerator(req.ip ?? '')}`
  },
})

router.post('/agent-search', agentSearchLimiter, async (req: AuthRequest, res) => {
  const orgId = req.auth!.orgId
  const { query } = agentSearchSchema.parse(req.body)

  const hasAi = await orgHasPlanFeature(orgId, 'ai_suggestions')
  if (!hasAi) {
    return res.status(403).json({
      error: 'Workspace assistant requires a plan with AI features.',
      code: 'PLAN_FEATURE',
      available: false,
      picks: [],
    })
  }

  if (!isWorkspaceAgentConfigured()) {
    return res.json({
      available: false,
      picks: [],
      answer: undefined,
    })
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true },
  })
  if (!org) return res.status(404).json({ error: 'Organization not found' })

  const [multiClient, apiAccess, bankRules, auditTrail] = await Promise.all([
    orgHasPlanFeature(orgId, 'multi_client'),
    orgHasPlanFeature(orgId, 'api_access'),
    orgHasPlanFeature(orgId, 'bank_rules'),
    orgHasPlanFeature(orgId, 'audit_trail'),
  ])

  const [projects, clients] = await Promise.all([
    prisma.project.findMany({
      where: { organizationId: orgId },
      select: {
        name: true,
        slug: true,
        status: true,
        client: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    }),
    multiClient
      ? prisma.client.findMany({
          where: { organizationId: orgId },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
          take: 40,
        })
      : Promise.resolve([]),
  ])

  const user = await prisma.user.findUnique({
    where: { id: req.auth!.userId },
    select: { email: true },
  })
  const userIsPlatformAdmin = user ? isPlatformAdmin(user.email) : false

  try {
    const result = await runWorkspaceAgentSearch(query, {
      role: req.auth!.role ?? 'viewer',
      isPlatformAdmin: userIsPlatformAdmin,
      features: {
        api_access: apiAccess,
        bank_rules: bankRules,
        audit_trail: auditTrail,
        multi_client: multiClient,
      },
      projects: projects.map((p) => ({
        slug: p.slug,
        name: p.name,
        status: p.status,
        clientName: p.client?.name,
      })),
      clients,
    })
    res.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Assistant unavailable'
    res.status(502).json({ error: message, available: true, picks: [] })
  }
})

export default router
