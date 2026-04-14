import { Response, NextFunction } from 'express'
import { prisma } from '../lib/prisma.js'
import { getKeyPrefix, verifyApiKey } from '../lib/apiKey.js'
import { getPlatformDefaults } from '../lib/platformDefaults.js'
import type { AuthRequest } from './auth.js'

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX_KEYS = 10_000

export function pruneRateLimitEntries(
  map: Map<string, { count: number; resetAt: number }>,
  now: number,
  maxKeys = RATE_LIMIT_MAX_KEYS
) {
  for (const [key, entry] of map) {
    if (now > entry.resetAt) map.delete(key)
  }
  if (map.size <= maxKeys) return
  // Remove oldest reset windows first until within bounds.
  const entriesByReset = Array.from(map.entries()).sort((a, b) => a[1].resetAt - b[1].resetAt)
  const overflow = map.size - maxKeys
  for (let i = 0; i < overflow; i++) {
    const key = entriesByReset[i]?.[0]
    if (key) map.delete(key)
  }
}

function pruneRateLimitMap(now: number) {
  pruneRateLimitEntries(rateLimitMap, now, RATE_LIMIT_MAX_KEYS)
}

async function checkRateLimit(keyPrefix: string): Promise<boolean> {
  const { apiRateLimitPerMin } = await getPlatformDefaults()
  const now = Date.now()
  const windowMs = 60 * 1000
  pruneRateLimitMap(now)
  let entry = rateLimitMap.get(keyPrefix)
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs }
    rateLimitMap.set(keyPrefix, entry)
  }
  entry.count++
  if (entry.count > apiRateLimitPerMin) return false
  return true
}

export async function apiKeyAuthMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const apiKey = (req.headers.authorization?.replace(/^Bearer\s+/i, '').trim()) ||
    (req.headers['x-api-key'] as string)?.trim()
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing API key. Use Authorization: Bearer <key> or X-API-Key: <key>' })
  }
  const prefix = getKeyPrefix(apiKey)
  const ok = await checkRateLimit(prefix)
  if (!ok) {
    const { apiRateLimitPerMin } = await getPlatformDefaults()
    return res.status(429).json({ error: `Rate limit exceeded. ${apiRateLimitPerMin} requests per minute.` })
  }
  const keyRecord = await prisma.apiKey.findFirst({
    where: { keyPrefix: prefix },
    include: { organization: true },
  })
  if (!keyRecord) {
    return res.status(401).json({ error: 'Invalid API key' })
  }
  if (keyRecord.expiresAt && new Date() > keyRecord.expiresAt) {
    return res.status(401).json({ error: 'API key expired' })
  }
  if (!verifyApiKey(apiKey, keyRecord.keyHash)) {
    return res.status(401).json({ error: 'Invalid API key' })
  }
  await prisma.apiKey.update({
    where: { id: keyRecord.id },
    data: { lastUsedAt: new Date() },
  })
  req.auth = {
    userId: `apikey:${keyRecord.id}`,
    orgId: keyRecord.organizationId,
    role: 'admin',
  }
  next()
}
