/**
 * CLI: dry-run (default) or execute retention prune.
 *
 *   npx tsx src/scripts/runRetentionPrune.ts
 *   npx tsx src/scripts/runRetentionPrune.ts --execute
 *   RETENTION_YEARS=7 npx tsx src/scripts/runRetentionPrune.ts --execute
 */
import { runRetentionPrune } from '../services/dataRetention.js'
import { prisma } from '../lib/prisma.js'

async function main() {
  const execute = process.argv.includes('--execute')
  const yearsEnv = process.env.RETENTION_YEARS
  const retentionYears = yearsEnv ? Number(yearsEnv) : undefined
  const result = await runRetentionPrune({
    dryRun: !execute,
    retentionYears: Number.isFinite(retentionYears) && (retentionYears as number) > 0 ? retentionYears : undefined,
  })
  console.log(JSON.stringify(result, null, 2))
  if (!execute) {
    console.error('\nDry run only. Pass --execute to permanently delete eligible projects.')
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
