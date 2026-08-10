/**
 * Go-live unification smoke (DB-backed + pure helpers).
 *
 * Covers the workstreams we shipped:
 *  - project identity / statement business name
 *  - report entity name fallback
 *  - matching false-positive controls (spot checks via helpers)
 *  - regional pattern reason coverage
 *
 * Usage (from api/):
 *   npx tsx scripts/verify-go-live.ts
 */
import { PrismaClient } from '@prisma/client'
import {
  composeProjectDisplayName,
  resolveReportEntityName,
} from '../src/lib/projectIdentity.js'
import { isGhanaRegionalPatternMatchReason } from '../src/services/ghanaRegionalMatchers.js'
import { datesWithinWindow } from '../src/services/matching.js'
import { pickBankRuleCashBookMatch } from '../src/services/bankRules.js'

const prisma = new PrismaClient()

type Check = { name: string; ok: boolean; detail?: string }
const checks: Check[] = []

function check(name: string, ok: boolean, detail?: string) {
  checks.push({ name, ok, detail })
  const mark = ok ? 'PASS' : 'FAIL'
  console.log(`  [${mark}] ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  console.log('\n=== Go-live unification smoke ===\n')

  // ── Pure helpers (no DB) ─────────────────────────────────────────────────
  console.log('1) Pure helpers')
  const composed = composeProjectDisplayName({
    statementBusinessName: 'GHANA COCOA BOARD',
    bankAccountName: 'Current',
    accountNo: '1441001234567',
    reconciliationDate: '2023-09-30',
  })
  check(
    'composeProjectDisplayName',
    composed === 'GHANA COCOA BOARD — Current (1441001234567) — as at 2023-09-30',
    composed
  )
  check(
    'resolveReportEntityName prefers statement name',
    resolveReportEntityName('COCOBOD', 'KQ Soft') === 'COCOBOD'
  )
  check(
    'resolveReportEntityName falls back to org',
    resolveReportEntityName(null, 'KQ Soft Solutions') === 'KQ Soft Solutions'
  )
  check(
    'datesWithinWindow rejects null dates',
    datesWithinWindow(null, new Date('2023-09-30'), 3) === false
  )
  check(
    'bank rules reject amount-only',
    pickBankRuleCashBookMatch(
      {
        id: 'bk1',
        date: new Date('2023-09-15'),
        name: null,
        details: 'Bank fee XYZ',
        amount: 1000,
      },
      [
        {
          id: 'cb1',
          date: new Date('2023-03-01'),
          name: null,
          details: 'Unrelated rent',
          amount: 1000,
        },
      ],
      new Set(),
      { amountTolerance: 0.01 }
    ) === null
  )
  const regionalReasons = [
    'GCB cheque withdrawal: chq/ref + amount',
    'NIB inward cheque: chq/ref + amount',
    'Prudential inward clearing: amount + payee',
    'Absa FT: FT ref + amount',
    'BOA inward cheque: chq/ref + amount',
  ]
  check(
    'regional pattern reasons are bulk-safe',
    regionalReasons.every((r) => isGhanaRegionalPatternMatchReason(r))
  )

  // ── DB connectivity + project identity persistence ───────────────────────
  console.log('\n2) Database project identity')
  await prisma.$queryRaw`SELECT 1`
  check('database reachable', true)

  const col = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_name = 'projects' AND column_name = 'statement_business_name'`
  )
  check('statement_business_name column exists', col.length === 1)

  const org =
    (await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } })) ||
    (await prisma.organization.create({
      data: {
        name: 'Go-Live Verify Org',
        slug: `go-live-verify-${Date.now()}`,
        plan: 'premium',
      },
    }))

  const stamp = Date.now()
  const statementName = `VERIFY COCOBOD ${stamp}`
  const projectName = composeProjectDisplayName({
    statementBusinessName: statementName,
    bankAccountName: 'Verify Current',
    accountNo: '0091900180008',
    reconciliationDate: '2023-09-30',
  })
  const slug = `go-live-verify-${stamp}`

  const project = await prisma.project.create({
    data: {
      organizationId: org.id,
      name: projectName,
      slug,
      statementBusinessName: statementName,
      reconciliationDate: new Date('2023-09-30T00:00:00.000Z'),
      currency: 'GHS',
      bankAccounts: {
        create: {
          name: 'Verify Current',
          bankName: 'Prudential Bank',
          accountNo: '0091900180008',
        },
      },
    },
    include: { bankAccounts: true, organization: true },
  })

  check('project created with statementBusinessName', !!project.statementBusinessName, project.name)
  check(
    'bank account attached',
    project.bankAccounts.length === 1 && project.bankAccounts[0]!.accountNo === '0091900180008'
  )

  const entity = resolveReportEntityName(
    project.statementBusinessName,
    project.organization.name
  )
  check(
    'report entity uses statement business name',
    entity === statementName,
    entity
  )

  const legacyEntity = resolveReportEntityName(null, project.organization.name)
  check(
    'legacy projects keep org name on report',
    legacyEntity === project.organization.name
  )

  // Cleanup smoke project (keep org — may be shared demo org)
  await prisma.bankAccount.deleteMany({ where: { projectId: project.id } })
  await prisma.project.delete({ where: { id: project.id } })
  check('smoke project cleaned up', true)

  // ── Summary ──────────────────────────────────────────────────────────────
  const failed = checks.filter((c) => !c.ok)
  console.log(`\n=== Result: ${checks.length - failed.length}/${checks.length} passed ===\n`)
  if (failed.length) {
    console.error('Failed checks:')
    for (const f of failed) console.error(`  - ${f.name}${f.detail ? `: ${f.detail}` : ''}`)
    process.exitCode = 1
  }
}

main()
  .catch((err) => {
    console.error('\nSmoke failed with error:', err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
