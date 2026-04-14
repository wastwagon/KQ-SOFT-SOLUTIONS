import { Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma.js'
import { isPlatformAdmin } from '../lib/platformAdmin.js'
import type { AuthRequest } from './auth.js'

export async function requirePlatformAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.auth?.userId) {
    return res.status(401).json({ error: 'Authentication required' })
  }
  const user = await prisma.user.findUnique({
    where: { id: req.auth.userId },
    select: { email: true },
  })
  if (!user || !isPlatformAdmin(user.email)) {
    return res.status(403).json({ error: 'Platform admin access required' })
  }
  next()
}
