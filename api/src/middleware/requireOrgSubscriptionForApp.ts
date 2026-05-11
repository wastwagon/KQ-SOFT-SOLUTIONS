import { Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma.js'
import { isPlatformAdmin } from '../lib/platformAdmin.js'
import {
  getOrgSubscriptionStatus,
  isSubscriptionPaywallEnabled,
  subscriptionStatusBlocksAppAccess,
} from '../services/orgSubscriptionAccess.js'
import type { AuthRequest } from './auth.js'

/**
 * When `SUBSCRIPTION_PAYWALL=true`, blocks core product routes for organisations
 * whose subscription snapshot is `free` (post-trial, no successful payment) or
 * `expired` (last paid period ended).
 *
 * Does not run on `/subscription` or `/settings` (billing still reachable).
 * Platform admin users (JWT, matching PLATFORM_ADMIN_EMAILS) bypass the check.
 */
export async function requireOrgSubscriptionForApp(req: AuthRequest, res: Response, next: NextFunction) {
  if (!isSubscriptionPaywallEnabled()) return next()
  if (!req.auth) return next()

  const { userId, orgId } = req.auth
  if (!String(userId).startsWith('apikey:')) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    })
    if (user?.email && isPlatformAdmin(user.email)) return next()
  }

  const status = await getOrgSubscriptionStatus(orgId)
  if (!subscriptionStatusBlocksAppAccess(status)) return next()

  return res.status(403).json({
    error:
      'Subscription inactive. Open Settings → Billing to renew, or contact support if you are on a custom plan.',
    code: 'SUBSCRIPTION_INACTIVE',
    subscriptionStatus: status,
  })
}
