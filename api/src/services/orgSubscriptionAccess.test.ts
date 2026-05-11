import { describe, expect, it } from 'vitest'
import { subscriptionStatusBlocksAppAccess } from './orgSubscriptionAccess.js'

describe('subscriptionStatusBlocksAppAccess', () => {
  it('blocks free and expired', () => {
    expect(subscriptionStatusBlocksAppAccess('free')).toBe(true)
    expect(subscriptionStatusBlocksAppAccess('expired')).toBe(true)
  })

  it('allows trial and active', () => {
    expect(subscriptionStatusBlocksAppAccess('trial')).toBe(false)
    expect(subscriptionStatusBlocksAppAccess('active')).toBe(false)
  })
})
