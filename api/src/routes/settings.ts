import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authMiddleware, type AuthRequest } from '../middleware/auth.js'
import { canEditBranding, canManageMembers } from '../lib/permissions.js'
import { hasPlanFeature, getUserLimit } from '../config/planFeatures.js'

const router = Router()
router.use(authMiddleware)

/** GET /settings/platform-defaults — read-only platform defaults (defaultCurrency, branding for reset) */
router.get('/platform-defaults', async (_req, res) => {
  const row = await prisma.platformSettings.findUnique({ where: { key: 'generation' } })
  const value = (row?.value as Record<string, unknown>) ?? {}
  const defaultCurrency = (value.defaultCurrency as string) || 'GHS'
  res.json({
    defaultCurrency: ['GHS', 'USD', 'EUR'].includes(defaultCurrency) ? defaultCurrency : 'GHS',
    reportTitle: (value.defaultReportTitle as string) || 'Bank Reconciliation Statement',
    footer: (value.defaultFooter as string) || 'Prepared by your organisation',
    primaryColor: (value.defaultPrimaryColor as string) || '#16a34a',
    secondaryColor: (value.defaultSecondaryColor as string) || '#15803d',
  })
})

const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['member', 'viewer', 'preparer', 'reviewer']).default('member'),
})

export interface BrandingPayload {
  logoUrl?: string
  primaryColor?: string
  secondaryColor?: string
  letterheadAddress?: string
  reportTitle?: string
  footer?: string
  /** Premium+ only: max discrepancy (GH₵) that reviewers can approve; above this, admin required */
  approvalThresholdAmount?: number | null
}

router.get('/branding', async (req: AuthRequest, res) => {
  const orgId = req.auth!.orgId
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { name: true, branding: true },
  })
  if (!org) return res.status(404).json({ error: 'Organization not found' })
  const branding = (org.branding as BrandingPayload) || {}
  res.json({
    organizationName: org.name,
    ...branding,
  })
})

router.patch('/branding', async (req: AuthRequest, res) => {
  const role = req.auth!.role
  if (!canEditBranding(role)) {
    return res.status(403).json({ error: 'Insufficient permission to edit branding' })
  }
  const orgId = req.auth!.orgId
  const body = req.body as BrandingPayload
  if (body.logoUrl !== undefined) {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { plan: true },
    })
    if (!org || !hasPlanFeature(org.plan, 'full_branding')) {
      return res.status(403).json({ error: 'Logo requires Premium plan or higher.' })
    }
  }
  const orgForPlan = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true },
  })
  const allowed: (keyof BrandingPayload)[] = [
    'logoUrl', 'primaryColor', 'secondaryColor',
    'letterheadAddress', 'reportTitle', 'footer',
  ]
  if (orgForPlan && hasPlanFeature(orgForPlan.plan, 'threshold_approval')) {
    allowed.push('approvalThresholdAmount')
  }
  const existing = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { branding: true },
  })
  const prev = (existing?.branding as Record<string, unknown>) || {}
  const branding: Record<string, unknown> = { ...prev }
  for (const k of allowed) {
    if (body[k] !== undefined) {
      if (k === 'approvalThresholdAmount') {
        const v = body[k]
        branding[k] = (v == null || (typeof v === 'string' && v === '')) ? null : (typeof v === 'number' && !Number.isNaN(v) ? v : prev[k])
      } else {
        branding[k] = typeof body[k] === 'string' ? body[k].trim() : body[k]
      }
    }
  }
  await prisma.organization.update({
    where: { id: orgId },
    data: { branding: branding as object },
  })
  const updated = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { branding: true },
  })
  res.json((updated?.branding as BrandingPayload) || {})
})

/** GET /settings/members - list org members */
router.get('/members', async (req: AuthRequest, res) => {
  const orgId = req.auth!.orgId
  const members = await prisma.organizationMember.findMany({
    where: { organizationId: orgId },
    include: { user: { select: { id: true, email: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true },
  })
  const limit = org ? getUserLimit(org.plan) : 1
  res.json({
    members: members.map((m) => ({
      id: m.id,
      userId: m.userId,
      email: m.user.email,
      name: m.user.name,
      role: m.role,
      createdAt: m.createdAt,
    })),
    limit: limit < 0 ? null : limit,
    currentCount: members.length,
  })
})

/** POST /settings/members - add member by email (user must already exist) */
router.post('/members', async (req: AuthRequest, res) => {
  const role = req.auth!.role
  if (!canManageMembers(role)) {
    return res.status(403).json({ error: 'Only admins can add members.' })
  }
  const orgId = req.auth!.orgId
  const parse = addMemberSchema.safeParse(req.body)
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.errors[0]?.message ?? 'Invalid input' })
  }
  const { email, role: newRole } = parse.data

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { plan: true },
  })
  if (!org) return res.status(404).json({ error: 'Organization not found' })

  const limit = getUserLimit(org.plan)
  if (limit >= 0) {
    const currentCount = await prisma.organizationMember.count({
      where: { organizationId: orgId },
    })
    if (currentCount >= limit) {
      return res.status(403).json({
        error: `Your plan allows up to ${limit} member${limit === 1 ? '' : 's'}. Upgrade to add more.`,
      })
    }
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, email: true, name: true },
  })
  if (!user) {
    return res.status(404).json({
      error: 'No user found with this email. The person must register first, then you can add them.',
    })
  }

  const existing = await prisma.organizationMember.findUnique({
    where: {
      userId_organizationId: { userId: user.id, organizationId: orgId },
    },
  })
  if (existing) {
    return res.status(400).json({ error: 'This person is already a member of your organisation.' })
  }

  const member = await prisma.organizationMember.create({
    data: {
      userId: user.id,
      organizationId: orgId,
      role: newRole,
    },
    include: { user: { select: { id: true, email: true, name: true } } },
  })
  res.status(201).json({
    id: member.id,
    userId: member.userId,
    email: member.user.email,
    name: member.user.name,
    role: member.role,
    createdAt: member.createdAt,
  })
})

/** DELETE /settings/members/:userId - remove member */
router.delete('/members/:userId', async (req: AuthRequest, res) => {
  const role = req.auth!.role
  if (!canManageMembers(role)) {
    return res.status(403).json({ error: 'Only admins can remove members.' })
  }
  const orgId = req.auth!.orgId
  const { userId } = req.params
  const mem = await prisma.organizationMember.findFirst({
    where: { organizationId: orgId, userId },
  })
  if (!mem) return res.status(404).json({ error: 'Member not found' })
  const memberCount = await prisma.organizationMember.count({ where: { organizationId: orgId } })
  if (memberCount <= 1) {
    return res.status(400).json({ error: 'Cannot remove the last member.' })
  }
  await prisma.organizationMember.delete({ where: { id: mem.id } })
  res.json({ removed: true })
})

/** PATCH /settings/members/:userId - update member role */
router.patch('/members/:userId', async (req: AuthRequest, res) => {
  const role = req.auth!.role
  if (!canManageMembers(role)) {
    return res.status(403).json({ error: 'Only admins can change member roles.' })
  }
  const orgId = req.auth!.orgId
  const { userId } = req.params
  const body = z.object({ role: z.enum(['member', 'viewer', 'preparer', 'reviewer', 'admin']) }).safeParse(req.body)
  if (!body.success) return res.status(400).json({ error: 'Invalid role' })
  const mem = await prisma.organizationMember.findFirst({
    where: { organizationId: orgId, userId },
  })
  if (!mem) return res.status(404).json({ error: 'Member not found' })
  const updated = await prisma.organizationMember.update({
    where: { id: mem.id },
    data: { role: body.data.role },
    include: { user: { select: { id: true, email: true, name: true } } },
  })
  res.json({
    id: updated.id,
    userId: updated.userId,
    email: updated.user.email,
    name: updated.user.name,
    role: updated.role,
    createdAt: updated.createdAt,
  })
})

export default router
