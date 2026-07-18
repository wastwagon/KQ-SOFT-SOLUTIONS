#!/usr/bin/env node
/**
 * Run parse/match benchmark against corrected-bank-specimens-for-user/.
 *
 * Usage:
 *   npx tsx api/scripts/run-specimen-benchmark.ts
 *   npx tsx api/scripts/run-specimen-benchmark.ts --excel-only
 *   npx tsx api/scripts/run-specimen-benchmark.ts --bank 11-lordship-9033-q1-2026
 *   npx tsx api/scripts/run-specimen-benchmark.ts --out /tmp/benchmark.json
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  formatBenchmarkSummary,
  runSpecimenBenchmark,
} from '../src/services/specimenBenchmark.js'

const args = process.argv.slice(2)
const excelOnly = args.includes('--excel-only')
const outIdx = args.indexOf('--out')
const outPath = outIdx >= 0 ? args[outIdx + 1] : null
const bankIdx = args.indexOf('--bank')
const bankIds = bankIdx >= 0 && args[bankIdx + 1] ? [args[bankIdx + 1]!] : undefined

const report = await runSpecimenBenchmark({
  excelOnly,
  bankIds,
  includeMatch: !args.includes('--no-match'),
})

console.log(formatBenchmarkSummary(report))

if (outPath) {
  const abs = path.resolve(outPath)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, JSON.stringify(report, null, 2))
  console.log(`Wrote ${abs}`)
}

if (report.parse.failed > 0) process.exitCode = 1
