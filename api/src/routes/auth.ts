import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { sendPasswordReset } from '../services/email.js'
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

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
  orgName: z.string().min(1),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const forgotSchema = z.object({
  email: z.string().email(),
})

const resetSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6),
})

router.post('/register', async (req, res) => {
  try {
    const body = registerSchema.parse(req.body)
    const existing = await prisma.user.findUnique({ where: { email: body.email } })
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' })
    }
    const passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS)
    const slug = body.orgName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const uniqueSlug = `${slug}-${Date.now().toString(36).slice(-6)}`
    const platformDefaults = await getPlatformDefaults()
    const { user, org } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: body.email,
          passwordHash,
          name: body.name,
        },
      })
      const org = await tx.organization.create({
        data: {
          name: body.orgName,
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
    const user = await prisma.user.findUnique({ where: { email: body.email } })
    if (!user || user.suspendedAt) {
      return res.status(401).json({ error: user?.suspendedAt ? 'Account suspended' : 'Invalid email or password' })
    }
    if (!(await bcrypt.compare(body.password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email or password' })
    }
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
    const token = jwt.sign(
      { userId: user.id, orgId: membership.organizationId },
      JWT_SECRET,
      { expiresIn: '7d' }
    )
    res.json({
      user: { id: user.id, email: user.email, name: user.name },
      org: { id: membership.organization.id, name: membership.organization.name },
      role: membership.role,
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
    const user = await prisma.user.findUnique({
      where: { email: body.email },
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
