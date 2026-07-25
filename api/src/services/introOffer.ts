/**
 * Intro offer: 50% off the first N self-serve billing periods.
 * Count is stored in platform_settings so existing DBs need no migration.
 */
import { prisma } from '../lib/prisma.js'
import { INTRO_OFFER_MONTHS } from '../config/subscription.js'

const KEY_PREFIX = 'org_intro_offer_applied:'

function settingsKey(orgId: string) {
  return `${KEY_PREFIX}${orgId}`
}

export function isIntroOfferEnvEnabled(): boolean {
  return process.env.INTRO_OFFER_ENABLED === 'true' || process.env.INTRO_OFFER_50_PCT === 'true'
}

export async function getIntroOfferPaymentsApplied(orgId: string): Promise<number> {
  const row = await prisma.platformSettings.findUnique({
    where: { key: settingsKey(orgId) },
  })
  if (row?.value != null) {
    try {
      const parsed =
        typeof row.value === 'object' && !Array.isArray(row.value)
          ? (row.value as { count?: number })
          : (JSON.parse(String(row.value)) as { count?: number })
      if (typeof parsed.count === 'number' && parsed.count >= 0) return parsed.count
    } catch {
      /* fall through */
    }
  }
  // Legacy: introOfferUsedAt set without counter → treat as fully consumed.
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { introOfferUsedAt: true },
  })
  if (org?.introOfferUsedAt) return INTRO_OFFER_MONTHS
  return 0
}

export async function isOrgIntroOfferEligible(orgId: string): Promise<boolean> {
  if (!isIntroOfferEnvEnabled()) return false
  const applied = await getIntroOfferPaymentsApplied(orgId)
  return applied < INTRO_OFFER_MONTHS
}

export async function recordIntroOfferPayment(orgId: string): Promise<number> {
  const current = await getIntroOfferPaymentsApplied(orgId)
  const next = Math.min(INTRO_OFFER_MONTHS, current + 1)
  await prisma.platformSettings.upsert({
    where: { key: settingsKey(orgId) },
    create: { key: settingsKey(orgId), value: { count: next } },
    update: { value: { count: next } },
  })
  if (next >= INTRO_OFFER_MONTHS) {
    await prisma.organization.update({
      where: { id: orgId },
      data: { introOfferUsedAt: new Date() },
    })
  }
  return next
}
