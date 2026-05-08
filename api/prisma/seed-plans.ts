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

const PLANS: PlanSeed[] = [
  {
    slug: 'basic',
    name: 'Basic',
    projectsPerMonth: 5,
    transactionsPerMonth: 500,
    monthlyGhs: 150,
    yearlyGhs: 1500,
  },
  {
    slug: 'standard',
    name: 'Standard',
    projectsPerMonth: 20,
    transactionsPerMonth: 2000,
    monthlyGhs: 400,
    yearlyGhs: 4000,
  },
  {
    slug: 'premium',
    name: 'Premium',
    projectsPerMonth: 100,
    transactionsPerMonth: 10000,
    monthlyGhs: 900,
    yearlyGhs: 9000,
  },
  {
    slug: 'firm',
    name: 'Firm',
    projectsPerMonth: -1,
    transactionsPerMonth: -1,
    monthlyGhs: 0,
    yearlyGhs: 0,
  },
]

async function main() {
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      // Update keeps existing edits made via the admin UI for `name`/limits/prices,
      // BUT only if a row already exists. New deployments still get the canonical
      // defaults. If you need to force-reset to defaults, run:
      //   FORCE_PLAN_RESET=1 npx tsx prisma/seed-plans.ts
      create: plan,
      update:
        process.env.FORCE_PLAN_RESET === '1'
          ? plan
          : {
              // No-op update keeps existing admin edits intact while still ensuring the row exists.
              slug: plan.slug,
            },
    })
  }
  console.log(
    'seed-plans: ensured %d plans (%s)',
    PLANS.length,
    PLANS.map((p) => p.slug).join(', ')
  )
}

main()
  .catch((e) => {
    console.error('seed-plans: failed', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
