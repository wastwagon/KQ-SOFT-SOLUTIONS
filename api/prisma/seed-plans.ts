/**
 * Production-safe plan seed.
 *
 * Idempotent: upserts the four canonical subscription tiers (basic,
 * standard, premium, firm) so the public `/api/v1/public/plans` endpoint
 * always returns complete data. Safe to run on every container start.
 *
 * Unlike `prisma/seed.ts`, this script:
 *   - Does NOT create any users, organizations, or payments.
 *   - Only writes to the `Plan` table.
 *   - Is the seed used by `start-api.sh` in production.
 *
 * Run: npx tsx prisma/seed-plans.ts
 * Force reset prices/limits: FORCE_PLAN_RESET=1 npx tsx prisma/seed-plans.ts
 *
 * Pricing must stay in sync with:
 *   - api/src/config/subscription.ts → PLAN_PRICES, TIER_LIMITS
 *   - PLANNING_DATA.json → subscription_tiers
 *   - web/src/lib/plans.ts → MARKETING_PLANS
 */
import { PrismaClient, type Prisma } from '@prisma/client'
import { isStoredFeaturesEmpty, mergePlanFeatures } from '../src/config/planFeatures.js'

const prisma = new PrismaClient()

interface PlanSeed {
  slug: string
  name: string
  projectsPerMonth: number
  transactionsPerMonth: number
  monthlyGhs: number
  yearlyGhs: number
  quarterlyGhs: number
  bankAccounts: number
  cleanExportsPerMonth: number
  usersLimit: number
}

/** Sep 2026 catalogue: Free / Solo / Team / Firm. Annual = 10× monthly. */
const PLANS: PlanSeed[] = [
  {
    slug: 'free',
    name: 'Free',
    projectsPerMonth: 5,
    transactionsPerMonth: 500,
    monthlyGhs: 0,
    yearlyGhs: 0,
    quarterlyGhs: 0,
    bankAccounts: 1,
    cleanExportsPerMonth: 0,
    usersLimit: 1,
  },
  {
    slug: 'basic',
    name: 'Solo',
    projectsPerMonth: 12,
    transactionsPerMonth: 3_000,
    monthlyGhs: 199,
    yearlyGhs: 1990,
    quarterlyGhs: 567,
    bankAccounts: 3,
    cleanExportsPerMonth: 5,
    usersLimit: 1,
  },
  {
    slug: 'standard',
    name: 'Team',
    projectsPerMonth: 40,
    transactionsPerMonth: 15_000,
    monthlyGhs: 399,
    yearlyGhs: 3990,
    quarterlyGhs: 1137,
    bankAccounts: 10,
    cleanExportsPerMonth: 20,
    usersLimit: 5,
  },
  {
    slug: 'premium',
    name: 'Firm',
    projectsPerMonth: 100,
    transactionsPerMonth: 40_000,
    monthlyGhs: 990,
    yearlyGhs: 9900,
    quarterlyGhs: 2822,
    bankAccounts: 30,
    cleanExportsPerMonth: 60,
    usersLimit: 10,
  },
  {
    slug: 'firm',
    name: 'Custom',
    projectsPerMonth: -1,
    transactionsPerMonth: -1,
    monthlyGhs: 0,
    yearlyGhs: 0,
    quarterlyGhs: 0,
    bankAccounts: -1,
    cleanExportsPerMonth: -1,
    usersLimit: -1,
  },
]

async function main() {
  const force = process.env.FORCE_PLAN_RESET === '1'
  /** Known pre–Jul 2026 monthly amounts — auto-sync without requiring FORCE_PLAN_RESET. */
  const legacyMonthly: Record<string, number[]> = {
    basic: [0, 150, 300],
    standard: [50, 400, 900],
    premium: [100, 900, 1500],
  }
  for (const plan of PLANS) {
    const existing = await prisma.plan.findUnique({ where: { slug: plan.slug } })
    const isLegacy =
      !!existing && (legacyMonthly[plan.slug] ?? []).includes(existing.monthlyGhs)
    const shouldReset = force || isLegacy || !existing
    const features = mergePlanFeatures(plan.slug, existing?.features) as Prisma.InputJsonValue
    const shouldBackfillFeatures = !!existing && isStoredFeaturesEmpty(existing.features)
    const firstTimeCms = shouldBackfillFeatures
      ? {
          features,
          usersLimit: plan.usersLimit,
          bankAccounts: plan.bankAccounts,
          cleanExportsPerMonth: plan.cleanExportsPerMonth,
          quarterlyGhs: plan.quarterlyGhs,
        }
      : {}
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      create: { ...plan, features },
      update: shouldReset
        ? { ...plan, features }
        : {
            // Keep admin CMS edits (prices, monthly volume, seats) but always
            // persist ungated split matching so Basic/Standard Confirm match works.
            name: plan.name,
            slug: plan.slug,
            features,
            ...firstTimeCms,
          },
    })
    if (isLegacy && !force) {
      console.log('seed-plans: healed legacy prices for %s → %s/%s GHS', plan.slug, plan.monthlyGhs, plan.yearlyGhs)
    }
    if (shouldBackfillFeatures && !shouldReset) {
      console.log('seed-plans: backfilled default CMS fields for %s', plan.slug)
    }
  }
  console.log(
    'seed-plans: ensured %d plans (%s)%s',
    PLANS.length,
    PLANS.map((p) => p.slug).join(', '),
    force ? ' [FORCE_PLAN_RESET applied]' : ''
  )
}

main()
  .catch((e) => {
    console.error('seed-plans: failed', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
