import { afterEach, describe, expect, it } from 'vitest'
import {
  computeWebhookSignature,
  extractCheckoutMetadata,
  isValidPaystackSignature,
  parseCheckoutReference,
  paystackCallbackUrl,
  publicAppOrigin,
} from './paystackFulfillment.js'

describe('parseCheckoutReference', () => {
  it('round-trips brs_{orgId}_{plan}_{period}_{timestamp}', () => {
    expect(parseCheckoutReference('brs_clxyz123abc_standard_yearly_1710000000000')).toEqual({
      orgId: 'clxyz123abc',
      plan: 'standard',
      period: 'yearly',
    })
  })

  it('returns null for unrelated references', () => {
    expect(parseCheckoutReference('pay_123')).toBeNull()
    expect(parseCheckoutReference('')).toBeNull()
  })
})

describe('extractCheckoutMetadata', () => {
  it('reads nested object metadata', () => {
    expect(
      extractCheckoutMetadata({ orgId: 'org1', plan: 'premium', period: 'quarterly', introOffer: true })
    ).toEqual({
      orgId: 'org1',
      plan: 'premium',
      period: 'quarterly',
      introOffer: true,
    })
  })

  it('parses metadata when Paystack stringifies it', () => {
    const parsed = extractCheckoutMetadata(
      JSON.stringify({ orgId: 'org2', plan: 'basic', period: 'monthly' })
    )
    expect(parsed.orgId).toBe('org2')
    expect(parsed.plan).toBe('basic')
  })

  it('reads Paystack custom_fields', () => {
    const parsed = extractCheckoutMetadata({
      custom_fields: [
        { display_name: 'Organisation', variable_name: 'orgId', value: 'org3' },
        { display_name: 'Plan', variable_name: 'plan', value: 'standard' },
        { display_name: 'Period', variable_name: 'period', value: 'monthly' },
      ],
    })
    expect(parsed).toMatchObject({ orgId: 'org3', plan: 'standard', period: 'monthly' })
  })

  it('falls back to the checkout reference when metadata is missing', () => {
    const parsed = extractCheckoutMetadata(undefined, 'brs_org9_premium_monthly_99')
    expect(parsed).toMatchObject({ orgId: 'org9', plan: 'premium', period: 'monthly' })
  })
})

describe('Paystack webhook signatures', () => {
  afterEach(() => {
    delete process.env.PAYSTACK_SECRET_KEY
    delete process.env.PAYSTACK_SECRET
    delete process.env.PAYSTACK_WEBHOOK_SECRET
  })

  it('accepts HMAC signed with the API secret key even if webhook secret is wrong', () => {
    process.env.PAYSTACK_SECRET_KEY = 'sk_live_real'
    process.env.PAYSTACK_WEBHOOK_SECRET = 'whsec_wrong_stripe_style'
    const raw = Buffer.from('{"event":"charge.success"}', 'utf8')
    const sig = computeWebhookSignature(raw, 'sk_live_real')
    expect(isValidPaystackSignature(raw, sig)).toBe(true)
    expect(isValidPaystackSignature(raw, computeWebhookSignature(raw, 'whsec_wrong_stripe_style'))).toBe(true)
    expect(isValidPaystackSignature(raw, 'deadbeef')).toBe(false)
  })
})

describe('paystackCallbackUrl', () => {
  afterEach(() => {
    delete process.env.PAYSTACK_CALLBACK_URL
    delete process.env.PAYSTACK_CALLBACK_ORIGIN
    delete process.env.APP_URL
    delete process.env.CORS_ORIGIN
  })

  it('points at the SPA billing page from APP_URL', () => {
    process.env.APP_URL = 'https://kqsoftwaresolutions.com/'
    expect(publicAppOrigin()).toBe('https://kqsoftwaresolutions.com')
    expect(paystackCallbackUrl()).toBe('https://kqsoftwaresolutions.com/settings/billing')
  })

  it('honours an explicit callback URL override', () => {
    process.env.PAYSTACK_CALLBACK_URL = 'https://app.example.com/settings/billing'
    expect(paystackCallbackUrl()).toBe('https://app.example.com/settings/billing')
  })
})
