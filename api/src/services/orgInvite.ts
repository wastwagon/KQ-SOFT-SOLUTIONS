import crypto from 'node:crypto'
import { prisma } from '../lib/prisma.js'
import { sendOrgInvite } from './email.js'
import { normalizeOrgMemberRole } from '../lib/orgMemberRole.js'
import { getUserLimit } from '../config/planFeatures.js'

const INVITE_TTL_DAYS = 7

export function inviteAppUrl(token: string): string {
  const base = (process.env.APP_URL || 'http://localhost:9100').replace(/\/$/, '')
  return `${base}/register?invite=${encodeURIComponent(token)}`
}

export async function createOrganizationInvite(opts: {
  orgId: string
  email: string
  role: string
  invitedByUserId?: string
}): Promise<{ ok: true; inviteId: string } | { ok: false; error: string; status: number }> {
  const email = opts.email.trim().toLowerCase()
  const role = normalizeOrgMemberRole(opts.role)

  const org = await prisma.organization.findUnique({
    where: { id: opts.orgId },
    select: { id: true, name: true, plan: true },
  })
  if (!org) return { ok: false, error: 'Organization not found', status: 404 }

  const limit = getUserLimit(org.plan)
  if (limit >= 0) {
    const [memberCount, pendingCount] = await Promise.all([
      prisma.organizationMember.count({ where: { organizationId: opts.orgId } }),
      prisma.organizationInvite.count({
        where: { organizationId: opts.orgId, acceptedAt: null, expiresAt: { gt: new Date() } },
      }),
    ])
    if (memberCount + pendingCount >= limit) {
      return {
        ok: false,
        error: `Your plan allows up to ${limit} member${limit === 1 ? '' : 's'}. Upgrade to invite more.`,
        status: 403,
      }
    }
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  })
  if (existingUser) {
    const member = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId: existingUser.id, organizationId: opts.orgId } },
    })
    if (member) {
      return { ok: false, error: 'This person is already a member of your organisation.', status: 400 }
    }
  }

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000)

  const invite = await prisma.organizationInvite.upsert({
    where: { organizationId_email: { organizationId: opts.orgId, email } },
    create: {
      organizationId: opts.orgId,
      email,
      role,
      token,
      invitedById: opts.invitedByUserId ?? null,
      expiresAt,
    },
    update: {
      role,
      token,
      invitedById: opts.invitedByUserId ?? null,
      expiresAt,
      acceptedAt: null,
    },
  })

  const inviter = opts.invitedByUserId
    ? await prisma.user.findUnique({
        where: { id: opts.invitedByUserId },
        select: { name: true, email: true },
      })
    : null

  await sendOrgInvite({
    to: email,
    orgName: org.name,
    role,
    inviteUrl: inviteAppUrl(invite.token),
    inviterName: inviter?.name || inviter?.email || undefined,
  })

  return { ok: true, inviteId: invite.id }
}

export async function getInviteByToken(token: string) {
  const invite = await prisma.organizationInvite.findUnique({
    where: { token },
    include: { organization: { select: { id: true, name: true } } },
  })
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) return null
  return invite
}

export async function acceptOrganizationInvite(opts: {
  token: string
  userId: string
  userEmail: string
}): Promise<{ ok: true; orgId: string; role: string } | { ok: false; error: string; status: number }> {
  const invite = await getInviteByToken(opts.token)
  if (!invite) {
    return { ok: false, error: 'Invite is invalid or has expired.', status: 400 }
  }
  const email = opts.userEmail.trim().toLowerCase()
  if (email !== invite.email) {
    return {
      ok: false,
      error: 'This invite was sent to a different email address. Sign in with that email to accept.',
      status: 403,
    }
  }

  const existing = await prisma.organizationMember.findUnique({
    where: { userId_organizationId: { userId: opts.userId, organizationId: invite.organizationId } },
  })
  if (existing) {
    await prisma.organizationInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    })
    return { ok: true, orgId: invite.organizationId, role: existing.role }
  }

  await prisma.$transaction([
    prisma.organizationMember.create({
      data: {
        userId: opts.userId,
        organizationId: invite.organizationId,
        role: invite.role,
      },
    }),
    prisma.organizationInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    }),
  ])

  return { ok: true, orgId: invite.organizationId, role: invite.role }
}
