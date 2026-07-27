import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma.js'
import { membershipAccessBlocked } from '../lib/membershipAccess.js'
import { isPlatformAdmin } from '../lib/platformAdmin.js'
import type { OrgRole } from '../lib/permissions.js'

export function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret && process.env.NODE_ENV !== 'test') {
    throw new Error('JWT_SECRET is required')
  }
  return secret || 'test-secret'
}
const JWT_SECRET = requireJwtSecret()

export interface AuthPayload {
  userId: string
  orgId: string
  role?: OrgRole
  /** True when a platform admin is viewing another organisation's workspace. */
  impersonating?: boolean
  /** Admin's home org id (to exit impersonation). */
  homeOrgId?: string
}

export interface AuthRequest extends Request {
  auth?: AuthPayload
}

export type JwtAuthClaims = {
  userId: string
  orgId: string
  impersonating?: boolean
  homeOrgId?: string
}

function looksLikeJwt(token: string): boolean {
  const parts = token.split('.')
  return parts.length === 3 && parts.every((p) => p.length > 0)
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  const apiKeyHeader = req.headers['x-api-key'] as string | undefined
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : apiKeyHeader?.trim()
  if (!token) {
    return res.status(401).json({ error: 'Missing token. Use Authorization: Bearer <token> or X-API-Key: <key>' })
  }
  if (!looksLikeJwt(token)) {
    const { apiKeyAuthMiddleware } = await import('./apiKeyAuth.js')
    return apiKeyAuthMiddleware(req, res, next)
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as unknown as JwtAuthClaims

    // Platform-admin support session: enter a subscriber org without membership.
    if (payload.impersonating) {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, email: true, suspendedAt: true },
      })
      if (!user || user.suspendedAt != null || !isPlatformAdmin(user.email)) {
        return res.status(401).json({ error: 'Invalid impersonation session' })
      }
      const org = await prisma.organization.findUnique({
        where: { id: payload.orgId },
        select: { id: true },
      })
      if (!org) {
        return res.status(401).json({ error: 'Organisation not found' })
      }
      req.auth = {
        userId: user.id,
        orgId: org.id,
        role: 'admin',
        impersonating: true,
        homeOrgId: payload.homeOrgId,
      }
      return next()
    }

    const membership = await prisma.organizationMember.findFirst({
      where: { userId: payload.userId, organizationId: payload.orgId },
      select: {
        role: true,
        user: { select: { email: true, suspendedAt: true } },
        organization: { select: { suspendedAt: true } },
      },
    })
    if (!membership) {
      return res.status(401).json({ error: 'Membership not found' })
    }
    const access = membershipAccessBlocked({
      role: membership.role,
      userEmail: membership.user.email,
      userSuspendedAt: membership.user.suspendedAt,
      orgSuspendedAt: membership.organization.suspendedAt,
    })
    if (access.blocked) {
      return res.status(403).json({ error: access.message, code: access.code })
    }
    req.auth = {
      userId: payload.userId,
      orgId: payload.orgId,
      role: membership.role as OrgRole,
    }
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
