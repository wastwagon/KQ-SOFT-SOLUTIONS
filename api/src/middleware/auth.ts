import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma.js'
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
}

export interface AuthRequest extends Request {
  auth?: AuthPayload
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
    const payload = jwt.verify(token, JWT_SECRET) as unknown as { userId: string; orgId: string }
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: payload.userId, organizationId: payload.orgId },
      select: { role: true },
    })
    if (!membership) {
      return res.status(401).json({ error: 'Membership not found' })
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
