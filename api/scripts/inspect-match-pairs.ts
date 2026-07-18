import {
  parseSpecimenFile,
  rowsToSideTxs,
  DEFAULT_SPECIMEN_ROOT,
} from '../src/services/specimenBenchmark.js'
import { suggestMatches } from '../src/services/matching.js'
import { buildSmartSuggestedMapping } from '../src/services/suggestedMapping.js'

async function inspect(bankId: string, cashFile: string, bankFile: string) {
  const cash = await parseSpecimenFile(DEFAULT_SPECIMEN_ROOT, bankId, {
    label: 'Cash book',
    file: cashFile,
    type: 'excel',
    status: 'ok',
  })
  const bank = await parseSpecimenFile(DEFAULT_SPECIMEN_ROOT, bankId, {
    label: 'Bank statement',
    file: bankFile,
    type: 'excel',
    status: 'ok',
  })
  console.log('\n===', bankId, '===')
  console.log('cash headers', cash.headers)
  console.log('bank headers', bank.headers)
  console.log('cash map', buildSmartSuggestedMapping(cash.headers, true))
  console.log('bank map', buildSmartSuggestedMapping(bank.headers, false))
  const receipts = rowsToSideTxs(cash.headers, cash.rows, 'receipts', 'r')
  const payments = rowsToSideTxs(cash.headers, cash.rows, 'payments', 'p')
  const credits = rowsToSideTxs(bank.headers, bank.rows, 'credits', 'c')
  const debits = rowsToSideTxs(bank.headers, bank.rows, 'debits', 'd')
  console.log({
    receipts: receipts.length,
    payments: payments.length,
    credits: credits.length,
    debits: debits.length,
  })
  console.log('sample receipt', receipts[0])
  console.log('sample credit', credits[0])
  console.log('sample payment', payments[0])
  console.log('sample debit', debits[0])
  const empty = new Set<string>()
  const rs = suggestMatches(receipts, credits, empty, empty)
  const ps = suggestMatches(payments, debits, empty, empty)
  const rAmts = new Set(receipts.map((t) => t.amount.toFixed(2)))
  const cAmts = new Set(credits.map((t) => t.amount.toFixed(2)))
  const pAmts = new Set(payments.map((t) => t.amount.toFixed(2)))
  const dAmts = new Set(debits.map((t) => t.amount.toFixed(2)))
  let rOverlap = 0
  let pOverlap = 0
  for (const a of rAmts) if (cAmts.has(a)) rOverlap++
  for (const a of pAmts) if (dAmts.has(a)) pOverlap++
  console.log({
    receiptSuggestions: rs.length,
    paymentSuggestions: ps.length,
    amountOverlapReceipts: rOverlap,
    amountOverlapPayments: pOverlap,
  })
  const cross1 = suggestMatches(payments, credits, empty, empty)
  const cross2 = suggestMatches(receipts, debits, empty, empty)
  console.log({
    crossPaymentsVsCredits: cross1.length,
    crossReceiptsVsDebits: cross2.length,
  })
  // Date window stats for overlapping amounts
  const creditByAmt = new Map<string, typeof credits>()
  for (const c of credits) {
    const k = c.amount.toFixed(2)
    if (!creditByAmt.has(k)) creditByAmt.set(k, [])
    creditByAmt.get(k)!.push(c)
  }
  let sameAmtDiffDate = 0
  for (const r of receipts.slice(0, 50)) {
    const hits = creditByAmt.get(r.amount.toFixed(2)) || []
    if (!hits.length) continue
    const within = hits.some((c) => {
      if (!r.date || !c.date) return true
      return Math.abs(r.date.getTime() - c.date.getTime()) <= 3 * 86400000
    })
    if (!within) sameAmtDiffDate++
  }
  console.log({ sampleSameAmtOutsideDateWindow: sameAmtDiffDate })
}

await inspect('15-acct4702-test-data', 'acct4702 cashbk.xlsx', 'acct 4702 bank statement.xlsx')
await inspect('16-acct430-test-data', 'acct430 cash book.xlsx', 'acct430 bank statement.xlsx')
