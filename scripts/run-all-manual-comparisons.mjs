#!/usr/bin/env node
/**
 * Run all manual-vs-platform BRS comparison tests (acct002, accountno095, accountno552).
 * Usage: API_URL=http://localhost:9101 node scripts/run-all-manual-comparisons.mjs
 */
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const API = process.env.API_URL || 'http://localhost:9101'

const scripts = [
  { name: 'acct002 (Grace Baptist, Aug 2018)', file: 'run-acct002-test.mjs' },
  { name: 'acct430 (TGL GT Bank EUR, Dec 2018)', file: 'run-acct430-test.mjs' },
  { name: 'acct4702 (TGL Properties SCB, Dec 2019)', file: 'run-acct4702-test.mjs' },
  { name: 'accountno095 (Ecobank 9035)', file: 'run-accountno095-test.mjs' },
  { name: 'accountno552 (Ecobank 9033)', file: 'run-accountno552-test.mjs' },
]

function run(script) {
  return new Promise((resolve) => {
    const child = spawn('node', [path.join(__dirname, script.file)], {
      cwd: ROOT,
      env: { ...process.env, API_URL: API },
      stdio: 'inherit',
    })
    child.on('close', (code) => resolve(code ?? 1))
  })
}

async function main() {
  console.log('Running all manual comparison tests against', API, '\n')
  const results = []
  for (const s of scripts) {
    console.log('\n' + '='.repeat(60))
    console.log(s.name)
    console.log('='.repeat(60))
    const code = await run(s)
    results.push({ name: s.name, ok: code === 0 })
  }
  console.log('\n' + '='.repeat(60))
  console.log('SUMMARY')
  console.log('='.repeat(60))
  for (const r of results) {
    console.log(`  ${r.ok ? '✓ PASS' : '✗ FAIL'}  ${r.name}`)
  }
  const allOk = results.every((r) => r.ok)
  process.exit(allOk ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
