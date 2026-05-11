import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { getUsageWithLimits } from '../../services/usage.js'
import { getSubscriptionSnapshot } from '../../services/subscriptionState.js'
import { fetchSubscriptionOverrides } from '../../services/subscriptionOverrides.js'
import { normalizeOrgMemberRole } from '../../lib/orgMemberRole.js'
import type { AuthRequest } from '../../middleware/auth.js'

const router = Router()

const updateOrgSchema = z.object({
  plan: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  suspendedAt: z.union([z.string(), z.null()]).optional(),
})

const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'reviewer', 'preparer', 'viewer', 'member']),
})

const setTrialSchema = z.object({
  trialEndsAt: z.string(),
  reason: z.string().min(3).max(500),
})

const setStatusSchema = z.object({
  status: z.enum(['trial', 'active', 'expired', 'free']),
  reason: z.string().min(3).max(500),
})

const clearOverrideSchema = z.object({
  reason: z.string().min(3).max(500),
})

/** Resolve org id from slug or id. CUIDs are 25 chars, alphanumeric; slugs contain hyphens. */
async function resolveOrgId(slugOrId: string): Promise<string | null> {
  const isSlug = slugOrId.includes('-') || slugOrId.length !== 25 || !/^[a-z0-9]+$/i.test(slugOrId)
  const org = await prisma.organization.findUnique({
    where: isSlug ? { slug: slugOrId } : { id: slugOrId },
    select: { id: true },
  })
  return org?.id ?? null
}

router.get('/', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20))
  const search = (req.query.search as string)?.trim() || ''
  const planFilter = (req.query.plan as string)?.trim() || ''
  const skip = (page - 1) * limit

  const where: Record<string, unknown> = {}
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' as const } },
      { slug: { contains: search, mode: 'insensitive' as const } },
    ]
  }
  if (planFilter === 'paid') {
    where.plan = { in: ['basic', 'standard', 'premium'] }
  } else if (planFilter && ['basic', 'standard', 'premium', 'firm'].includes(planFilter)) {
    where.plan = planFilter
  }

  const [orgs, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        suspendedAt: true,
        createdAt: true,
        introOfferUsedAt: true,
        _count: { select: { members: true, projects: true, clients: true } },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { amount: true, createdAt: true, plan: true, period: true },
        },
      },
    }),
    prisma.organization.count({ where }),
  ])

  const organizations = orgs.map((o) => {
    const lastPayment = o.payments[0]
    const totalPaid = { sum: 0 } // will be computed below
    return {
      id: o.id,
      name: o.name,
      slug: o.slug,
      plan: o.plan,
      suspendedAt: o.suspendedAt,
      createdAt: o.createdAt,
      introOfferUsedAt: o.introOfferUsedAt,
      lastPayment: lastPayment ? { amount: Number(lastPayment.amount), createdAt: lastPayment.createdAt, plan: lastPayment.plan, period: lastPayment.period } : null,
      _count: o._count,
    }
  })

  // Fetch total paid per org for displayed page
  const orgIds = organizations.map((o) => o.id)
  const totals = await prisma.payment.groupBy({
    by: ['organizationId'],
    where: { organizationId: { in: orgIds }, status: 'success' },
    _sum: { amount: true },
  })
  const totalByOrg = new Map(totals.map((t) => [t.organizationId, Number(t._sum.amount ?? 0)]))
  organizations.forEach((o) => { (o as Record<string, unknown>).totalPaid = totalByOrg.get(o.id) ?? 0 })

  res.json({
    organizations,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  })
})

// Export must be before /:id (so "export" doesn't match :id)
router.get('/export/csv', async (req, res) => {
  const planFilter = (req.query.plan as string)?.trim() || ''
  const where: Record<string, unknown> = {}
  if (planFilter === 'paid') where.plan = { in: ['basic', 'standard', 'premium'] }
  else if (planFilter && ['basic', 'standard', 'premium', 'firm'].includes(planFilter)) where.plan = planFilter

  const orgs = await prisma.organization.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      slug: true,
      plan: true,
      createdAt: true,
      _count: { select: { members: true, projects: true } },
      payments: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { amount: true, createdAt: true },
      },
    },
  })

  const totals = await prisma.payment.groupBy({
    by: ['organizationId'],
    where: { organizationId: { in: orgs.map((o) => o.id) }, status: 'success' },
    _sum: { amount: true },
  })
  const totalByOrg = new Map(totals.map((t) => [t.organizationId, Number(t._sum.amount ?? 0)]))

  const header = 'Name,Slug,Plan,Members,Projects,Last Payment,Total Paid (GHS),Joined'
  const rows = orgs.map((o) => {
    const last = o.payments[0]
    const total = totalByOrg.get(o.id) ?? 0
    return [
      `"${(o.name || '').replace(/"/g, '""')}"`,
      o.slug,
      o.plan,
      o._count.members,
      o._count.projects,
      last ? new Date(last.createdAt).toISOString().slice(0, 10) : '',
      total.toFixed(2),
      new Date(o.createdAt).toISOString().slice(0, 10),
    ].join(',')
  })
  const csv = [header, ...rows].join('\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', 'attachment; filename=subscribers.csv')
  return res.send('\ufeff' + csv)
})

router.get('/:id', async (req, res) => {
  const orgId = await resolveOrgId(req.params.id)
  if (!orgId) return res.status(404).json({ error: 'Organization not found' })
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      members: { include: { user: { select: { id: true, email: true, name: true } } } },
      _count: { select: { projects: true, clients: true } },
      payments: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: { id: true, amount: true, currency: true, plan: true, period: true, reference: true, status: true, createdAt: true },
      },
    },
  })
  if (!org) return res.status(404).json({ error: 'Organization not found' })
  const usage = await getUsageWithLimits(org.id, org.plan)
  const latestPayment = org.payments[0]
  const overrides = await fetchSubscriptionOverrides(org.id)
  const subscription = getSubscriptionSnapshot(
    { createdAt: org.createdAt },
    latestPayment
      ? { createdAt: latestPayment.createdAt, period: latestPayment.period as 'monthly' | 'yearly', amount: latestPayment.amount }
      : null,
    overrides
  )
  const totalPaid = await prisma.payment.aggregate({
    where: { organizationId: org.id, status: 'success' },
    _sum: { amount: true },
  })
  res.json({
    ...org,
    usage,
    subscription,
    totalPaid: Number(totalPaid._sum.amount ?? 0),
  })
})

router.get('/:id/subscription', async (req, res) => {
  const orgId = await resolveOrgId(req.params.id)
  if (!orgId) return res.status(404).json({ error: 'Organization not found' })
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      name: true,
      plan: true,
      createdAt: true,
      payments: {
        where: { status: 'success' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { createdAt: true, period: true, amount: true, reference: true },
      },
    },
  })
  if (!org) return res.status(404).json({ error: 'Organization not found' })
  const overrides = await fetchSubscriptionOverrides(org.id)
  const latestPayment = org.payments[0] ?? null
  const snapshot = getSubscriptionSnapshot(org, latestPayment, overrides)
  res.json({ organization: { id: org.id, name: org.name, plan: org.plan }, subscription: snapshot, latestPayment, overrides })
})

router.post('/:id/subscription/trial', async (req: AuthRequest, res) => {
  const orgId = await resolveOrgId(req.params.id)
  if (!orgId) return res.status(404).json({ error: 'Organization not found' })
  const body = setTrialSchema.parse(req.body)
  const trialEndsAt = new Date(body.trialEndsAt)
  if (Number.isNaN(trialEndsAt.getTime())) return res.status(400).json({ error: 'Invalid trial end date' })
  await prisma.platformSettings.upsert({
    where: { key: `org_trial_override:${orgId}` },
    create: {
      key: `org_trial_override:${orgId}`,
      value: {
        trialEndsAt: trialEndsAt.toISOString(),
        reason: body.reason,
        updatedBy: req.auth?.userId,
        updatedAt: new Date().toISOString(),
      },
    },
    update: {
      value: {
        trialEndsAt: trialEndsAt.toISOString(),
        reason: body.reason,
        updatedBy: req.auth?.userId,
        updatedAt: new Date().toISOString(),
      },
    },
  })
  await prisma.auditLog.create({
    data: {
      organizationId: orgId,
      userId: req.auth?.userId,
      action: 'subscription_trial_updated',
      details: { trialEndsAt: trialEndsAt.toISOString(), reason: body.reason },
    },
  })
  res.json({ updated: true, trialEndsAt: trialEndsAt.toISOString() })
})

router.post('/:id/subscription/status', async (req: AuthRequest, res) => {
  const orgId = await resolveOrgId(req.params.id)
  if (!orgId) return res.status(404).json({ error: 'Organization not found' })
  const body = setStatusSchema.parse(req.body)
  await prisma.platformSettings.upsert({
    where: { key: `org_subscription_status_override:${orgId}` },
    create: {
      key: `org_subscription_status_override:${orgId}`,
      value: {
        status: body.status,
        reason: body.reason,
        updatedBy: req.auth?.userId,
        updatedAt: new Date().toISOString(),
      },
    },
    update: {
      value: {
        status: body.status,
        reason: body.reason,
        updatedBy: req.auth?.userId,
        updatedAt: new Date().toISOString(),
      },
    },
  })
  await prisma.auditLog.create({
    data: {
      organizationId: orgId,
      userId: req.auth?.userId,
      action: 'subscription_status_updated',
      details: { status: body.status, reason: body.reason },
    },
  })
  res.json({ updated: true, status: body.status })
})

router.delete('/:id/subscription/trial', async (req: AuthRequest, res) => {
  const orgId = await resolveOrgId(req.params.id)
  if (!orgId) return res.status(404).json({ error: 'Organization not found' })
  const body = clearOverrideSchema.parse(req.body)
  await prisma.platformSettings.deleteMany({ where: { key: `org_trial_override:${orgId}` } })
  await prisma.auditLog.create({
    data: {
      organizationId: orgId,
      userId: req.auth?.userId,
      action: 'subscription_trial_override_cleared',
      details: { reason: body.reason },
    },
  })
  res.json({ cleared: true })
})

router.delete('/:id/subscription/status', async (req: AuthRequest, res) => {
  const orgId = await resolveOrgId(req.params.id)
  if (!orgId) return res.status(404).json({ error: 'Organization not found' })
  const body = clearOverrideSchema.parse(req.body)
  await prisma.platformSettings.deleteMany({ where: { key: `org_subscription_status_override:${orgId}` } })
  await prisma.auditLog.create({
    data: {
      organizationId: orgId,
      userId: req.auth?.userId,
      action: 'subscription_status_override_cleared',
      details: { reason: body.reason },
    },
  })
  res.json({ cleared: true })
})

const bulkUpdateSchema = z.object({
  organizationIds: z.array(z.string()).min(1).max(100),
  plan: z.string().min(1),
})

router.post('/bulk-plan', async (req, res) => {
  const body = bulkUpdateSchema.parse(req.body)
  const planExists = await prisma.plan.findUnique({ where: { slug: body.plan } })
  if (!planExists) return res.status(400).json({ error: `Plan "${body.plan}" not found` })
  const result = await prisma.organization.updateMany({
    where: { id: { in: body.organizationIds } },
    data: { plan: body.plan },
  })
  res.json({ updated: result.count })
})

router.patch('/:orgId/members/:userId', async (req, res) => {
  const resolvedOrgId = await resolveOrgId(req.params.orgId)
  if (!resolvedOrgId) return res.status(404).json({ error: 'Organization not found' })
  const { userId } = req.params
  const body = updateMemberRoleSchema.parse(req.body)
  const mem = await prisma.organizationMember.findFirst({
    where: { organizationId: resolvedOrgId, userId },
  })
  if (!mem) return res.status(404).json({ error: 'Membership not found' })
  const roleToPersist = normalizeOrgMemberRole(body.role)
  const updated = await prisma.organizationMember.update({
    where: { id: mem.id },
    data: { role: roleToPersist },
    include: { user: { select: { id: true, email: true, name: true } } },
  })
  res.json(updated)
})

router.delete('/:orgId/members/:userId', async (req, res) => {
  const resolvedOrgId = await resolveOrgId(req.params.orgId)
  if (!resolvedOrgId) return res.status(404).json({ error: 'Organization not found' })
  const { userId } = req.params
  const mem = await prisma.organizationMember.findFirst({
    where: { organizationId: resolvedOrgId, userId },
  })
  if (!mem) return res.status(404).json({ error: 'Membership not found' })
  const memberCount = await prisma.organizationMember.count({ where: { organizationId: resolvedOrgId } })
  if (memberCount <= 1) return res.status(400).json({ error: 'Cannot remove last member' })
  await prisma.organizationMember.delete({ where: { id: mem.id } })
  res.json({ removed: true })
})

router.patch('/:id', async (req, res) => {
  const orgId = await resolveOrgId(req.params.id)
  if (!orgId) return res.status(404).json({ error: 'Organization not found' })
  const body = updateOrgSchema.parse(req.body)
  const existing = await prisma.organization.findUnique({ where: { id: orgId } })
  if (!existing) return res.status(404).json({ error: 'Organization not found' })
  const data: { plan?: string; name?: string; slug?: string; suspendedAt?: Date | null } = {}
  if (body.plan) {
    const planExists = await prisma.plan.findUnique({ where: { slug: body.plan } })
    if (!planExists) return res.status(400).json({ error: `Plan "${body.plan}" not found` })
    data.plan = body.plan
  }
  if (body.name) data.name = body.name
  if (body.slug) {
    const slugTaken = await prisma.organization.findFirst({ where: { slug: body.slug, id: { not: orgId } } })
    if (slugTaken) return res.status(400).json({ error: 'Slug already in use' })
    data.slug = body.slug
  }
  if (body.suspendedAt !== undefined) {
    data.suspendedAt = body.suspendedAt === null ? null : new Date(body.suspendedAt)
  }
  if (Object.keys(data).length === 0) return res.status(400).json({ error: 'No fields to update' })
  const org = await prisma.organization.update({
    where: { id: orgId },
    data,
    select: { id: true, name: true, slug: true, plan: true },
  })
  res.json(org)
})

export default router
