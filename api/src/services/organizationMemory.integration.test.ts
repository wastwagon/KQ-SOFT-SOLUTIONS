/**
 * Postgres smoke: migrate → remember → load/boost → cross-org isolation.
 *
 * Requires Docker. Skipped automatically when `docker info` fails.
 * Run: npm run test:integration
 */
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

function dockerAvailable(): boolean {
  try {
    execFileSync('docker', ['info'], {
      stdio: 'ignore',
      timeout: 8_000,
    })
    return true
  } catch {
    return false
  }
}

const canRun = dockerAvailable()

describe.skipIf(!canRun)('memory tables postgres smoke', () => {
  type PrismaClient = import('@prisma/client').PrismaClient
  let container: { stop: () => Promise<unknown>; getConnectionUri: () => string }
  let prisma: PrismaClient
  let orgAId: string
  let orgBId: string

  let rememberOrganisationMatch: typeof import('../services/organizationMatchMemory.js').rememberOrganisationMatch
  let loadOrganisationMatchMemories: typeof import('../services/organizationMatchMemory.js').loadOrganisationMatchMemories
  let applyOrganisationMatchMemoryBoost: typeof import('../services/organizationMatchMemory.js').applyOrganisationMatchMemoryBoost
  let forgetOrganisationMatchMemory: typeof import('../services/organizationMatchMemory.js').forgetOrganisationMatchMemory
  let rememberDocumentLayout: typeof import('../services/documentLayoutMemory.js').rememberDocumentLayout
  let findBestLayoutMemory: typeof import('../services/documentLayoutMemory.js').findBestLayoutMemory
  let forgetDocumentLayoutMemory: typeof import('../services/documentLayoutMemory.js').forgetDocumentLayoutMemory

  beforeAll(async () => {
    const { PostgreSqlContainer } = await import('@testcontainers/postgresql')
    container = await new PostgreSqlContainer('postgres:16-alpine').start()
    const databaseUrl = container.getConnectionUri()
    process.env.DATABASE_URL = databaseUrl

    execFileSync(
      'npx',
      ['prisma', 'db', 'push', '--skip-generate', '--accept-data-loss'],
      {
        cwd: apiRoot,
        env: { ...process.env, DATABASE_URL: databaseUrl },
        stdio: 'pipe',
      }
    )

    const prismaMod = await import('../lib/prisma.js')
    await prismaMod.reconnectPrisma(databaseUrl)
    prisma = prismaMod.prisma

    const matchMem = await import('../services/organizationMatchMemory.js')
    rememberOrganisationMatch = matchMem.rememberOrganisationMatch
    loadOrganisationMatchMemories = matchMem.loadOrganisationMatchMemories
    applyOrganisationMatchMemoryBoost = matchMem.applyOrganisationMatchMemoryBoost
    forgetOrganisationMatchMemory = matchMem.forgetOrganisationMatchMemory
    const layoutMem = await import('../services/documentLayoutMemory.js')
    rememberDocumentLayout = layoutMem.rememberDocumentLayout
    findBestLayoutMemory = layoutMem.findBestLayoutMemory
    forgetDocumentLayoutMemory = layoutMem.forgetDocumentLayoutMemory

    const orgA = await prisma.organization.create({
      data: { name: 'Smoke Org A', slug: `smoke-a-${Date.now()}` },
    })
    const orgB = await prisma.organization.create({
      data: { name: 'Smoke Org B', slug: `smoke-b-${Date.now()}` },
    })
    orgAId = orgA.id
    orgBId = orgB.id
  }, 180_000)

  afterAll(async () => {
    await prisma?.$disconnect().catch(() => undefined)
    await container?.stop().catch(() => undefined)
  })

  it('remembers a 1:1 match, increments on re-confirm, and boosts suggestions', async () => {
    const cashBookTx = {
      amount: 12_500.5,
      chqNo: '199056',
      name: 'Supplier Kofi',
      details: 'CHQ 199056',
    }
    const bankTx = {
      amount: 12_500.5,
      chqNo: '199056',
      details: 'Inward Cheque - Dr CHQ 199056',
    }

    const first = await rememberOrganisationMatch({
      organizationId: orgAId,
      currency: 'GHS',
      sideKind: 'payment',
      cashBookTx,
      bankTx,
    })
    expect(first).toBe(true)

    const second = await rememberOrganisationMatch({
      organizationId: orgAId,
      currency: 'GHS',
      sideKind: 'payment',
      cashBookTx,
      bankTx,
    })
    expect(second).toBe(true)

    const memories = await loadOrganisationMatchMemories({
      organizationId: orgAId,
      currency: 'GHS',
      sideKind: 'payment',
      amountMinors: [1_250_050],
    })
    expect(memories).toHaveLength(1)
    expect(memories[0]!.confirmationCount).toBe(2)

    const suggestions: {
      cashBookTx: {
        id: string
        amount: number
        date: null
        name: string | null
        details: string | null
        docRef: null
        chqNo: string | null
      }
      bankTx: {
        id: string
        amount: number
        date: null
        name: string | null
        details: string | null
        docRef: null
        chqNo: string | null
      }
      confidence: number
      reason: string
      orgMemoryBoosted?: boolean
      orgMemoryConfirmations?: number
    }[] = [
      {
        cashBookTx: {
          id: 'cb1',
          amount: 12_500.5,
          date: null,
          name: 'Supplier Kofi',
          details: 'CHQ 199056',
          docRef: null,
          chqNo: '199056',
        },
        bankTx: {
          id: 'bk1',
          amount: 12_500.5,
          date: null,
          name: null,
          details: 'Inward Cheque - Dr CHQ 199056',
          docRef: null,
          chqNo: '199056',
        },
        confidence: 0.8,
        reason: 'amount+cheque',
      },
    ]
    const boosted = applyOrganisationMatchMemoryBoost(suggestions, memories)
    expect(boosted).toBe(1)
    expect(suggestions[0]!.orgMemoryBoosted).toBe(true)
    expect(suggestions[0]!.orgMemoryConfirmations).toBe(2)
    expect(suggestions[0]!.confidence).toBeGreaterThan(0.8)
  })

  it('isolates match memory across organisations', async () => {
    const memoriesB = await loadOrganisationMatchMemories({
      organizationId: orgBId,
      currency: 'GHS',
      sideKind: 'payment',
      amountMinors: [1_250_050],
    })
    expect(memoriesB).toHaveLength(0)

    const rememberedB = await rememberOrganisationMatch({
      organizationId: orgBId,
      currency: 'GHS',
      sideKind: 'payment',
      cashBookTx: {
        amount: 12_500.5,
        chqNo: '199056',
        name: 'Other org',
        details: 'CHQ 199056',
      },
      bankTx: {
        amount: 12_500.5,
        chqNo: '199056',
        details: 'Bank CHQ 199056',
      },
    })
    expect(rememberedB).toBe(true)

    const memoriesA = await loadOrganisationMatchMemories({
      organizationId: orgAId,
      currency: 'GHS',
      sideKind: 'payment',
      amountMinors: [1_250_050],
    })
    const memoriesB2 = await loadOrganisationMatchMemories({
      organizationId: orgBId,
      currency: 'GHS',
      sideKind: 'payment',
      amountMinors: [1_250_050],
    })
    expect(memoriesA).toHaveLength(1)
    expect(memoriesB2).toHaveLength(1)
    expect(memoriesA[0]!.id).not.toBe(memoriesB2[0]!.id)
  })

  it('forgets match memory only within the owning organisation', async () => {
    const memoriesA = await loadOrganisationMatchMemories({
      organizationId: orgAId,
      currency: 'GHS',
      sideKind: 'payment',
      amountMinors: [1_250_050],
    })
    const id = memoriesA[0]!.id

    const cross = await forgetOrganisationMatchMemory(orgBId, id)
    expect(cross).toBe(false)
    expect(
      (
        await loadOrganisationMatchMemories({
          organizationId: orgAId,
          currency: 'GHS',
          sideKind: 'payment',
          amountMinors: [1_250_050],
        })
      ).length
    ).toBe(1)

    const own = await forgetOrganisationMatchMemory(orgAId, id)
    expect(own).toBe(true)
    expect(
      (
        await loadOrganisationMatchMemories({
          organizationId: orgAId,
          currency: 'GHS',
          sideKind: 'payment',
          amountMinors: [1_250_050],
        })
      ).length
    ).toBe(0)
  })

  it('remembers layout mapping and isolates by organisation', async () => {
    const headers = ['Date', 'Narration', 'Cheque No', 'Amount', 'Balance']
    const mapping = { date: 0, details: 1, chqNo: 2, amount: 3 }

    await rememberDocumentLayout({
      organizationId: orgAId,
      documentType: 'bank_debits',
      headers,
      mapping,
      parseMethodHint: 'excel',
    })

    const hitA = await findBestLayoutMemory(orgAId, 'bank_debits', headers)
    expect(hitA).not.toBeNull()
    expect(hitA!.exact).toBe(true)
    expect(hitA!.fieldMapping.amount).toBe('Amount')
    expect(hitA!.fieldMapping.chqNo).toBe('Cheque No')

    const missB = await findBestLayoutMemory(orgBId, 'bank_debits', headers)
    expect(missB).toBeNull()

    // Soft-match behaviour is covered in unit tests; smoke focuses on persistence + org isolation.
    const forgottenCross = await forgetDocumentLayoutMemory(orgBId, hitA!.id)
    expect(forgottenCross).toBe(false)
    const forgotten = await forgetDocumentLayoutMemory(orgAId, hitA!.id)
    expect(forgotten).toBe(true)
    expect(await findBestLayoutMemory(orgAId, 'bank_debits', headers)).toBeNull()
  })
})
