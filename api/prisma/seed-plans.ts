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
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface PlanSeed {
  slug: string
  name: string
  projectsPerMonth: number
  transactionsPerMonth: number
  monthlyGhs: number
  yearlyGhs: number
}

/** Jul 2026 catalogue: bank seats + txn caps; annual ≈ 10× monthly. */
const PLANS: PlanSeed[] = [
  {
    slug: 'basic',
    name: 'Basic',
    projectsPerMonth: 10,
    transactionsPerMonth: 1_000,
    monthlyGhs: 300,
    yearlyGhs: 3000,
  },
  {
    slug: 'standard',
    name: 'Standard',
    projectsPerMonth: 30,
    transactionsPerMonth: 5_000,
    monthlyGhs: 900,
    yearlyGhs: 9000,
  },
  {
    slug: 'premium',
    name: 'Premium',
    projectsPerMonth: 100,
    transactionsPerMonth: 20_000,
    monthlyGhs: 1500,
    yearlyGhs: 15000,
  },
  {
    slug: 'firm',
    name: 'Custom',
    projectsPerMonth: -1,
    transactionsPerMonth: -1,
    monthlyGhs: 0,
    yearlyGhs: 0,
  },
]

async function main() {
  const force = process.env.FORCE_PLAN_RESET === '1'
  /** Known pre–Jul 2026 monthly amounts — auto-sync without requiring FORCE_PLAN_RESET. */
  const legacyMonthly: Record<string, number[]> = {
    basic: [0, 150],
    standard: [50, 400],
    premium: [100, 900],
  }
  for (const plan of PLANS) {
    const existing = await prisma.plan.findUnique({ where: { slug: plan.slug } })
    const isLegacy =
      !!existing && (legacyMonthly[plan.slug] ?? []).includes(existing.monthlyGhs)
    const shouldReset = force || isLegacy || !existing
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      create: plan,
      update: shouldReset
        ? plan
        : {
            // Keep admin edits unless FORCE_PLAN_RESET=1 or legacy catalogue detected.
            name: plan.name,
            slug: plan.slug,
          },
    })
    if (isLegacy && !force) {
      console.log('seed-plans: healed legacy prices for %s → %s/%s GHS', plan.slug, plan.monthlyGhs, plan.yearlyGhs)
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
