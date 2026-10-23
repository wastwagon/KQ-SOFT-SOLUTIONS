import { describe, expect, it } from 'vitest'
import { z } from 'zod'

/** Mirror admin plan update schema — free tier must be editable. */
const CANONICAL_PLAN_SLUGS = ['free', 'basic', 'standard', 'premium', 'firm'] as const
const PAID_PLAN_SLUGS = ['basic', 'standard', 'premium', 'firm'] as const

const createPlanSchema = z.object({
  slug: z.enum(PAID_PLAN_SLUGS),
  name: z.string().min(1),
  monthlyGhs: z.number().min(0),
})

const updatePlanSchema = createPlanSchema
  .extend({ slug: z.enum(CANONICAL_PLAN_SLUGS) })
  .partial()

describe('admin plan update schema', () => {
  it('accepts free slug on update', () => {
    const body = updatePlanSchema.parse({
      slug: 'free',
      monthlyGhs: 0,
      name: 'Free',
    })
    expect(body.slug).toBe('free')
  })

  it('accepts partial pricing-only update', () => {
    const body = updatePlanSchema.parse({ monthlyGhs: 249 })
    expect(body.monthlyGhs).toBe(249)
  })
})
