import { describe, expect, it, beforeEach, vi } from 'vitest'

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    organization: { findUnique: vi.fn() },
    organizationMember: { count: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    organizationInvite: { count: vi.fn(), upsert: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('./email.js', () => ({
  sendOrgInvite: vi.fn(async () => undefined),
}))

import { prisma } from '../lib/prisma.js'
import { sendOrgInvite } from './email.js'
import {
  acceptOrganizationInvite,
  createOrganizationInvite,
  getInviteByToken,
  inviteAppUrl,
} from './orgInvite.js'

describe('orgInvite', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('builds invite URL from APP_URL', () => {
    const prev = process.env.APP_URL
    process.env.APP_URL = 'https://app.example.com/'
    expect(inviteAppUrl('abc123')).toBe('https://app.example.com/register?invite=abc123')
    process.env.APP_URL = prev
  })

  it('rejects invite when plan member limit reached', async () => {
    vi.mocked(prisma.organization.findUnique).mockResolvedValue({
      id: 'org-1',
      name: 'Acme',
      plan: 'starter',
    } as never)
    vi.mocked(prisma.organizationMember.count).mockResolvedValue(2)
    vi.mocked(prisma.organizationInvite.count).mockResolvedValue(0)

    const result = await createOrganizationInvite({
      orgId: 'org-1',
      email: 'new@example.com',
      role: 'preparer',
    })

    expect(result).toEqual({
      ok: false,
      error: 'Your plan allows up to 1 member. Upgrade to invite more.',
      status: 403,
    })
    expect(sendOrgInvite).not.toHaveBeenCalled()
  })

  it('returns null for expired invite token', async () => {
    vi.mocked(prisma.organizationInvite.findUnique).mockResolvedValue({
      id: 'inv-1',
      email: 'a@b.com',
      role: 'preparer',
      organizationId: 'org-1',
      acceptedAt: null,
      expiresAt: new Date('2020-01-01'),
      organization: { id: 'org-1', name: 'Acme' },
    } as never)

    expect(await getInviteByToken('tok')).toBeNull()
  })

  it('accepts invite for matching email', async () => {
    vi.mocked(prisma.organizationInvite.findUnique).mockResolvedValue({
      id: 'inv-1',
      email: 'join@example.com',
      role: 'reviewer',
      organizationId: 'org-1',
      acceptedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
      organization: { id: 'org-1', name: 'Acme' },
    } as never)
    vi.mocked(prisma.organizationMember.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.$transaction).mockResolvedValue([] as never)

    const result = await acceptOrganizationInvite({
      token: 'tok',
      userId: 'user-1',
      userEmail: 'join@example.com',
    })

    expect(result).toEqual({ ok: true, orgId: 'org-1', role: 'reviewer' })
    expect(prisma.$transaction).toHaveBeenCalled()
  })

  it('rejects accept when email does not match invite', async () => {
    vi.mocked(prisma.organizationInvite.findUnique).mockResolvedValue({
      id: 'inv-1',
      email: 'join@example.com',
      role: 'reviewer',
      organizationId: 'org-1',
      acceptedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
      organization: { id: 'org-1', name: 'Acme' },
    } as never)

    const result = await acceptOrganizationInvite({
      token: 'tok',
      userId: 'user-1',
      userEmail: 'other@example.com',
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.status).toBe(403)
    }
  })
})
