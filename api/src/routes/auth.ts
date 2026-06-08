import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { sendPasswordReset } from '../services/email.js'
import { acceptOrganizationInvite, getInviteByToken } from '../services/orgInvite.js'
import { isPlatformAdmin } from '../lib/platformAdmin.js'
import { getPlatformDefaults } from '../lib/platformDefaults.js'
import { authMiddleware, requireJwtSecret } from '../middleware/auth.js'
import type { AuthRequest } from '../middleware/auth.js'
import { logger } from '../middleware/logging.js'

const router = Router()

// Default per-IP limiter for /login, /register, /me etc.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 30, // 30 requests per window
  message: { error: 'Too many attempts. Please try again later.' },
  standardHeaders: true,
})

// Tighter limiter for password recovery — prevents using us as an email-bomber
// or brute-forcing reset tokens.  Applied per-IP because the email is the
// thing the attacker is enumerating.
const passwordRecoveryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: { error: 'Too many password recovery attempts. Try again in an hour.' },
  standardHeaders: true,
})

router.use(authLimiter)
const JWT_SECRET = requireJwtSecret()
const SALT_ROUNDS = 10

const registerSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().optional(),
    orgName: z.string().min(1).optional(),
    inviteToken: z.string().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.inviteToken && !data.orgName?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Organisation name is required', path: ['orgName'] })
    }
  })

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  inviteToken: z.string().min(1).optional(),
})

const acceptInviteSchema = z.object({
  token: z.string().min(1),
})

const forgotSchema = z.object({
  email: z.string().email(),
})

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6),
})

function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase()
}

router.get('/invite/:token', async (req, res) => {
  const invite = await getInviteByToken(req.params.token)
  if (!invite) {
    return res.status(404).json({ error: 'Invite is invalid or has expired.' })
  }
  res.json({
    email: invite.email,
    role: invite.role,
    organization: { id: invite.organization.id, name: invite.organization.name },
    expiresAt: invite.expiresAt.toISOString(),
  })
})

router.post('/accept-invite', authMiddleware, async (req, res) => {
  try {
    const body = acceptInviteSchema.parse(req.body)
    const { userId, orgId: currentOrgId } = (req as AuthRequest).auth!
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })
    if (!user?.email) return res.status(401).json({ error: 'User not found' })
    const accepted = await acceptOrganizationInvite({
      token: body.token,
      userId,
      userEmail: user.email,
    })
    if (!accepted.ok) {
      return res.status(accepted.status).json({ error: accepted.error })
    }
    const useOrgId = accepted.orgId
    const membership = await prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId: useOrgId } },
      include: { organization: { select: { id: true, name: true } } },
    })
    const reissue = useOrgId !== currentOrgId
    const token = reissue
      ? jwt.sign({ userId, orgId: useOrgId }, JWT_SECRET, { expiresIn: '7d' })
      : undefined
    res.json({
      ok: true,
      org: membership?.organization ?? { id: useOrgId },
      role: accepted.role,
      token,
    })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: e.errors[0]?.message })
    }
    res.status(500).json({ error: 'Could not accept invite' })
  }
})

router.post('/register', async (req, res) => {
  try {
    const body = registerSchema.parse(req.body)
    const email = normalizeAuthEmail(body.email)
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' })
    }
    const passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS)

    if (body.inviteToken) {
      const invite = await getInviteByToken(body.inviteToken)
      if (!invite) {
        return res.status(400).json({ error: 'Invite is invalid or has expired.' })
      }
      if (invite.email !== email) {
        return res.status(400).json({
          error: 'Use the same email address the invitation was sent to.',
        })
      }
      const { user, org, role } = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: { email, passwordHash, name: body.name },
        })
        await tx.organizationMember.create({
          data: {
            userId: user.id,
            organizationId: invite.organizationId,
            role: invite.role,
          },
        })
        await tx.organizationInvite.update({
          where: { id: invite.id },
          data: { acceptedAt: new Date() },
        })
        const org = await tx.organization.findUniqueOrThrow({
          where: { id: invite.organizationId },
          select: { id: true, name: true },
        })
        return { user, org, role: invite.role }
      })
      const token = jwt.sign(
        { userId: user.id, orgId: org.id },
        JWT_SECRET,
        { expiresIn: '7d' }
      )
      return res.status(201).json({
        user: { id: user.id, email: user.email, name: user.name },
        org: { id: org.id, name: org.name },
        role,
        token,
        isPlatformAdmin: isPlatformAdmin(user.email),
      })
    }

    const slug = body.orgName!.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const uniqueSlug = `${slug}-${Date.now().toString(36).slice(-6)}`
    const platformDefaults = await getPlatformDefaults()
    const { user, org } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          name: body.name,
        },
      })
      const org = await tx.organization.create({
        data: {
          name: body.orgName!,
          slug: uniqueSlug,
          branding: {
            reportTitle: platformDefaults.defaultReportTitle,
            footer: platformDefaults.defaultFooter,
            primaryColor: platformDefaults.defaultPrimaryColor,
            secondaryColor: platformDefaults.defaultSecondaryColor,
          },
          members: {
            create: {
              userId: user.id,
              role: 'admin',
            },
          },
        },
      })
      return { user, org }
    })
    const token = jwt.sign(
      { userId: user.id, orgId: org.id },
      JWT_SECRET,
      { expiresIn: '7d' }
    )
    res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name },
      org: { id: org.id, name: org.name },
      role: 'admin',
      token,
      isPlatformAdmin: isPlatformAdmin(user.email),
    })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: e.errors[0]?.message })
    }
    res.status(500).json({ error: 'Registration failed' })
  }
})

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const { userId, orgId } = (req as AuthRequest).auth!
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, suspendedAt: true },
    })
    if (!user || user.suspendedAt != null) {
      return res.status(401).json({ error: 'User not found or suspended' })
    }
    const membership = await prisma.organizationMember.findFirst({
      where: { userId, organizationId: orgId },
      include: { organization: { select: { id: true, name: true, suspendedAt: true } } },
    })
    if (!membership) {
      return res.status(401).json({ error: 'Membership not found' })
    }
    if (membership.organization.suspendedAt) {
      return res.status(401).json({ error: 'Organization suspended' })
    }
    res.json({
      user: { id: user.id, email: user.email, name: user.name },
      org: { id: membership.organization.id, name: membership.organization.name },
      role: membership.role,
      isPlatformAdmin: isPlatformAdmin(user.email),
    })
  } catch (e) {
    logger.error({ err: e }, 'auth/me failed')
    res.status(500).json({ error: 'Failed to fetch session' })
  }
})

router.post('/login', async (req, res) => {
  try {
    const body = loginSchema.parse(req.body)
    const email = normalizeAuthEmail(body.email)
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user || user.suspendedAt) {
      return res.status(401).json({ error: user?.suspendedAt ? 'Account suspended' : 'Invalid email or password' })
    }
    if (!(await bcrypt.compare(body.password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }
    let orgId: string | undefined
    let role: string | undefined
    let orgName: string | undefined

    if (body.inviteToken) {
      const accepted = await acceptOrganizationInvite({
        token: body.inviteToken,
        userId: user.id,
        userEmail: email,
      })
      if (!accepted.ok) {
        return res.status(accepted.status).json({ error: accepted.error })
      }
      orgId = accepted.orgId
      role = accepted.role
      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true, name: true, suspendedAt: true },
      })
      if (!org || org.suspendedAt) {
        return res.status(401).json({ error: 'Organization suspended' })
      }
      orgName = org.name
    } else {
      const membership = await prisma.organizationMember.findFirst({
        where: { userId: user.id },
        include: { organization: { select: { id: true, name: true, suspendedAt: true } } },
      })
      if (!membership) {
        return res.status(400).json({ error: 'No organization found' })
      }
      if (membership.organization.suspendedAt) {
        return res.status(401).json({ error: 'Organization suspended' })
      }
      orgId = membership.organizationId
      role = membership.role
      orgName = membership.organization.name
    }

    const token = jwt.sign({ userId: user.id, orgId: orgId! }, JWT_SECRET, { expiresIn: '7d' })
    res.json({
      user: { id: user.id, email: user.email, name: user.name },
      org: { id: orgId, name: orgName },
      role,
      token,
      isPlatformAdmin: isPlatformAdmin(user.email),
    })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: e.errors[0]?.message })
    }
    logger.error({ err: e }, 'auth/login failed')
    res.status(500).json({ error: 'Login failed' })
  }
})

const RESET_TOKEN_EXPIRY_HOURS = 1

router.post('/forgot-password', passwordRecoveryLimiter, async (req, res) => {
  try {
    const body = forgotSchema.parse(req.body)
    const email = normalizeAuthEmail(body.email)
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          take: 1,
          include: { organization: { select: { name: true } } },
        },
      },
    })
    if (!user) {
      return res.json({ message: 'If that email exists, a reset link was sent.' })
    }
    const token = crypto.randomBytes(32).toString('hex')
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt: new Date(Date.now() + RESET_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000),
      },
    })
    const resetUrl = `${process.env.APP_URL || 'http://localhost:9100'}/reset-password?token=${token}`
    const orgName = user.memberships?.[0]?.organization?.name ?? null
    await sendPasswordReset(user.email, resetUrl, { orgName })
    res.json({ message: 'If that email exists, a reset link was sent.' })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: e.errors[0]?.message })
    }
    res.status(500).json({ error: 'Request failed' })
  }
})

router.post('/reset-password', passwordRecoveryLimiter, async (req, res) => {
  try {
    const body = resetSchema.parse(req.body)
    const record = await prisma.passwordResetToken.findUnique({
      where: { token: body.token },
      include: { user: true },
    })
    if (!record || record.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Invalid or expired reset link' })
    }
    const passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS)
    await prisma.$transaction([
      prisma.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.deleteMany({ where: { userId: record.userId } }),
    ])
    res.json({ message: 'Password reset successfully' })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: e.errors[0]?.message })
    }
    res.status(500).json({ error: 'Reset failed' })
  }
})

export default router
