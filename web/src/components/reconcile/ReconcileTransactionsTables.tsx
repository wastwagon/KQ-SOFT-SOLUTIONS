import { useMemo } from 'react'
import { formatAmountNumber, formatDateCompact } from '../../lib/format'
import { getCurrencySymbol } from '../../lib/currency'
import type { ReconcileView, SuggestedMatch, Tx } from './types'

/**
 * The two stacked transaction tables (Cash Book + Bank Statement) shown at
 * the bottom of the reconcile page.  Owns its own row-tooltip computation
 * (suggestion maps + unmatched reasons) and running-balance accumulation
 * so the page-level orchestrator stays slim.
 *
 * The component is deliberately read-mostly: selection state comes in from
 * the page, and clicks delegate back through `onToggleCb`/`onToggleBank`.
 */
interface ReconcileTransactionsTablesProps {
  view: ReconcileView
  canReconcile: boolean
  currency: string
  receipts: Tx[]
  payments: Tx[]
  credits: Tx[]
  debits: Tx[]
  matchedCbIds: Set<string>
  matchedBankIds: Set<string>
  flaggedBankIds: Set<string>
  receiptSugs: SuggestedMatch[]
  paymentSugs: SuggestedMatch[]
  selectedCbIds: Set<string>
  selectedBankIds: Set<string>
  onToggleCb: (id: string) => void
  onToggleBank: (id: string) => void
}

const sortByDate = (a: Tx, b: Tx) => {
  const da = a.date ? new Date(a.date).getTime() : 0
  const db = b.date ? new Date(b.date).getTime() : 0
  return da - db
}

function fmtAmt(n: number) {
  return formatAmountNumber(Number.isFinite(n) ? n : 0)
}

function formatMatchTooltip(label: string, t: Tx, conf: number, reason: string) {
  return `${label}: ${formatDateCompact(t.date)} • ${(t.name || t.details || '—').slice(0, 40)} • ${fmtAmt(t.amount)} (${Math.round(conf * 100)}%: ${reason})`
}

export default function ReconcileTransactionsTables({
  view,
  canReconcile,
  currency,
  receipts,
  payments,
  credits,
  debits,
  matchedCbIds,
  matchedBankIds,
  flaggedBankIds,
  receiptSugs,
  paymentSugs,
  selectedCbIds,
  selectedBankIds,
  onToggleCb,
  onToggleBank,
}: ReconcileTransactionsTablesProps) {
  // Build suggestion lookup tables once per render — used for the 🔗 marker
  // and the row tooltip.
  const cbReceiptToBank = useMemo(() => buildCbToBank(receiptSugs), [receiptSugs])
  const cbPaymentToBank = useMemo(() => buildCbToBank(paymentSugs), [paymentSugs])
  const bankCreditToCb = useMemo(() => buildBankToCb(receiptSugs), [receiptSugs])
  const bankDebitToCb = useMemo(() => buildBankToCb(paymentSugs), [paymentSugs])

  const cbTxs = useMemo<Array<Tx & { _type?: 'receipt' | 'payment' }>>(() => {
    if (view === 'all') {
      return [
        ...receipts.map((t) => ({ ...t, _type: 'receipt' as const })),
        ...payments.map((t) => ({ ...t, _type: 'payment' as const })),
      ].sort(sortByDate)
    }
    return view === 'receipts' ? receipts : payments
  }, [view, receipts, payments])

  const bankTxs = useMemo<Array<Tx & { _type?: 'credit' | 'debit' }>>(() => {
    if (view === 'all') {
      return [
        ...credits.map((t) => ({ ...t, _type: 'credit' as const })),
        ...debits.map((t) => ({ ...t, _type: 'debit' as const })),
      ].sort(sortByDate)
    }
    return view === 'receipts' ? credits : debits
  }, [view, credits, debits])

  // NOTE: We use `reduce` rather than a `let runningBalance` accumulator
  // because the React Hooks lint rule (`react-hooks/immutability`) flags
  // mutable closures inside `useMemo` — they can cause inconsistent reads
  // on subsequent renders.  Each row carries its own pre-summed balance.
  const cbRows = useMemo(
    () =>
      cbTxs.reduce<
        Array<{
          t: Tx & { _type?: 'receipt' | 'payment' }
          isReceipt: boolean
          runningBalance: number
        }>
      >((acc, t) => {
        const isReceipt = view === 'all' ? t._type === 'receipt' : view === 'receipts'
        const prev = acc.length > 0 ? acc[acc.length - 1].runningBalance : 0
        const next = prev + (isReceipt ? Number(t.amount) : -Number(t.amount))
        acc.push({ t, isReceipt, runningBalance: next })
        return acc
      }, []),
    [cbTxs, view]
  )

  const bankRows = useMemo(
    () =>
      bankTxs.reduce<
        Array<{
          t: Tx & { _type?: 'credit' | 'debit' }
          amt: number
          isCredit: boolean
          runningBalance: number
        }>
      >((acc, t) => {
        const amt = Number(t.amount)
        const isCredit = view === 'all' ? t._type === 'credit' : view === 'receipts'
        const prev = acc.length > 0 ? acc[acc.length - 1].runningBalance : 0
        const next = prev + (isCredit ? amt : -amt)
        acc.push({ t, amt, isCredit, runningBalance: next })
        return acc
      }, []),
    [bankTxs, view]
  )

  function getUnmatchedReason(t: Tx, isCashBook: boolean): string {
    if (isCashBook) {
      if (view === 'receipts') return 'Uncredited — no matching bank credit'
      return t.chqNo?.trim()
        ? 'Unpresented cheque — no bank debit with same amount/ref'
        : 'Unpresented — no matching bank debit'
    }
    if (view === 'receipts') return 'No matching cash book receipt'
    return 'No matching cash book payment'
  }

  function cbTooltip(t: Tx & { _type?: 'receipt' | 'payment' }, isReceipt: boolean): string {
    const base = matchedCbIds.has(t.id) ? '' : getUnmatchedReason(t, true)
    const sugs = isReceipt ? cbReceiptToBank.get(t.id) : cbPaymentToBank.get(t.id)
    if (!sugs?.length) return base
    const lines = sugs
      .slice(0, 3)
      .map((s) => formatMatchTooltip('Suggested bank match', s.bank, s.confidence, s.reason))
    return base ? `${base}\n\n${lines.join('\n')}` : lines.join('\n')
  }

  function bankTooltip(t: Tx & { _type?: 'credit' | 'debit' }, isCredit: boolean): string {
    const base = matchedBankIds.has(t.id) ? '' : getUnmatchedReason(t, false)
    const sugs = isCredit ? bankCreditToCb.get(t.id) : bankDebitToCb.get(t.id)
    if (!sugs?.length) return base
    const lines = sugs
      .slice(0, 3)
      .map((s) => formatMatchTooltip('Suggested cash book match', s.cb, s.confidence, s.reason))
    return base ? `${base}\n\n${lines.join('\n')}` : lines.join('\n')
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Cash Book table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <h3 className="px-4 py-3 bg-gray-50 border-b border-gray-200 text-sm font-bold text-gray-900 tracking-tight">
          Cash Book
        </h3>
        <div className="overflow-x-auto overflow-y-auto max-h-[45rem]">
          <table className="min-w-full text-xs sm:text-sm text-gray-900">
            <thead className="bg-gray-100/80 sticky top-0">
              <tr>
                {view !== 'all' && (
                  <th
                    scope="col"
                    className="px-2 sm:px-3 py-2.5 text-left w-8 text-gray-500 font-medium"
                  />
                )}
                {view === 'all' && (
                  <th
                    scope="col"
                    className="px-2 sm:px-3 py-2.5 text-left text-gray-600 font-semibold whitespace-nowrap"
                  >
                    Type
                  </th>
                )}
                <th
                  scope="col"
                  className="px-2 sm:px-3 py-2.5 text-left text-gray-600 font-semibold whitespace-nowrap"
                >
                  Date
                </th>
                <th
                  scope="col"
                  className="px-2 sm:px-3 py-2.5 text-left text-gray-600 font-semibold min-w-[120px]"
                >
                  Name
                </th>
                <th
                  scope="col"
                  className="px-2 sm:px-3 py-2.5 text-left text-gray-600 font-semibold min-w-[180px]"
                >
                  Description
                </th>
                <th
                  scope="col"
                  className="px-2 sm:px-3 py-2.5 text-left text-gray-600 font-semibold whitespace-nowrap"
                >
                  Chq no.
                </th>
                <th
                  scope="col"
                  className="px-2 sm:px-3 py-2.5 text-left text-gray-600 font-semibold whitespace-nowrap"
                >
                  Ref. Doc. No.
                </th>
                <th
                  scope="col"
                  className="px-2 sm:px-3 py-2.5 text-right text-gray-600 font-semibold whitespace-nowrap"
                >
                  Amount Received ({getCurrencySymbol(currency)})
                </th>
                <th
                  scope="col"
                  className="px-2 sm:px-3 py-2.5 text-right text-gray-600 font-semibold whitespace-nowrap"
                >
                  Amount Paid ({getCurrencySymbol(currency)})
                </th>
                <th
                  scope="col"
                  className="px-2 sm:px-3 py-2.5 text-right text-gray-600 font-semibold whitespace-nowrap"
                >
                  Balance ({getCurrencySymbol(currency)})
                </th>
                {view !== 'all' && (
                  <th
                    scope="col"
                    className="px-2 sm:px-3 py-2.5 text-left text-gray-500 font-medium min-w-[100px] sm:min-w-[140px]"
                  >
                    Note
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cbRows.map(({ t, isReceipt, runningBalance }) => {
                const interactive = canReconcile && view !== 'all'
                const tooltip = cbTooltip(t, isReceipt)
                const sugMap = isReceipt ? cbReceiptToBank : cbPaymentToBank
                return (
                  <tr
                    key={t.id}
                    onClick={() => interactive && onToggleCb(t.id)}
                    title={tooltip}
                    className={`${
                      interactive ? 'cursor-pointer' : 'cursor-default'
                    } transition-colors ${
                      selectedCbIds.has(t.id)
                        ? 'bg-primary-50'
                        : interactive
                          ? 'hover:bg-gray-50'
                          : ''
                    } ${matchedCbIds.has(t.id) ? 'opacity-60' : ''}`}
                  >
                    {view !== 'all' && (
                      <td className="px-2 sm:px-3 py-2 whitespace-nowrap">
                        {selectedCbIds.has(t.id) && (
                          <span className="text-primary-600 font-bold" aria-label="Selected">
                            ✓
                          </span>
                        )}
                      </td>
                    )}
                    {view === 'all' && (
                      <td className="px-2 sm:px-3 py-2 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            isReceipt ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {isReceipt ? 'Receipt' : 'Payment'}
                        </span>
                      </td>
                    )}
                    <td className="px-2 sm:px-3 py-2 font-medium text-gray-700 whitespace-nowrap">
                      {formatDateCompact(t.date)}
                      {sugMap.has(t.id) && (
                        <span className="ml-1 text-primary-600" title={tooltip}>
                          🔗
                        </span>
                      )}
                    </td>
                    <td
                      className="px-2 sm:px-3 py-2 text-gray-900 min-w-[100px]"
                      title={t.name || ''}
                    >
                      {t.name || '—'}
                    </td>
                    <td
                      className="px-2 sm:px-3 py-2 text-gray-700 min-w-[140px]"
                      title={t.details || ''}
                    >
                      {t.details || '—'}
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-gray-600 font-mono text-xs whitespace-nowrap">
                      {t.chqNo || '—'}
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-gray-600 font-mono text-xs whitespace-nowrap">
                      {t.docRef || '—'}
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-right font-semibold text-gray-900 whitespace-nowrap">
                      {isReceipt ? formatAmountNumber(t.amount) : '—'}
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-right font-semibold text-gray-900 whitespace-nowrap">
                      {!isReceipt ? formatAmountNumber(t.amount) : '—'}
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-right text-gray-600 whitespace-nowrap">
                      {formatAmountNumber(runningBalance)}
                    </td>
                    {view !== 'all' && (
                      <td
                        className="px-2 sm:px-3 py-2 text-xs text-amber-700 truncate min-w-0"
                        title={tooltip}
                      >
                        {!matchedCbIds.has(t.id) && getUnmatchedReason(t, true)}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bank Statement table */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <h3 className="px-4 py-3 bg-gray-50 border-b border-gray-200 text-sm font-bold text-gray-900 tracking-tight">
          Bank Statement
        </h3>
        <div className="overflow-x-auto overflow-y-auto max-h-[45rem]">
          <table className="min-w-full text-xs sm:text-sm text-gray-900">
            <thead className="bg-gray-100/80 sticky top-0">
              <tr>
                {view !== 'all' && (
                  <th
                    scope="col"
                    className="px-2 sm:px-3 py-2.5 text-left w-8 text-gray-500 font-medium"
                  />
                )}
                {view === 'all' && (
                  <th
                    scope="col"
                    className="px-2 sm:px-3 py-2.5 text-left text-gray-600 font-semibold whitespace-nowrap"
                  >
                    Type
                  </th>
                )}
                <th
                  scope="col"
                  className="px-2 sm:px-3 py-2.5 text-left text-gray-600 font-semibold whitespace-nowrap"
                >
                  Date
                </th>
                <th
                  scope="col"
                  className="px-2 sm:px-3 py-2.5 text-left text-gray-600 font-semibold min-w-[180px]"
                >
                  Description
                </th>
                <th
                  scope="col"
                  className="px-2 sm:px-3 py-2.5 text-left text-gray-600 font-semibold whitespace-nowrap"
                >
                  Chq no.
                </th>
                <th
                  scope="col"
                  className="px-2 sm:px-3 py-2.5 text-left text-gray-600 font-semibold whitespace-nowrap"
                >
                  Ref. Doc. No.
                </th>
                <th
                  scope="col"
                  className="px-2 sm:px-3 py-2.5 text-right text-gray-600 font-semibold whitespace-nowrap"
                >
                  Debit ({getCurrencySymbol(currency)})
                </th>
                <th
                  scope="col"
                  className="px-2 sm:px-3 py-2.5 text-right text-gray-600 font-semibold whitespace-nowrap"
                >
                  Credit ({getCurrencySymbol(currency)})
                </th>
                <th
                  scope="col"
                  className="px-2 sm:px-3 py-2.5 text-right text-gray-600 font-semibold whitespace-nowrap"
                >
                  Balance ({getCurrencySymbol(currency)})
                </th>
                {view !== 'all' && (
                  <th
                    scope="col"
                    className="px-2 sm:px-3 py-2.5 text-left text-gray-500 font-medium min-w-[100px] sm:min-w-[140px]"
                  >
                    Note
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bankRows.map(({ t, amt, isCredit, runningBalance }) => {
                const interactive = canReconcile && view !== 'all'
                const tooltip = bankTooltip(t, isCredit)
                const sugMap = isCredit ? bankCreditToCb : bankDebitToCb
                return (
                  <tr
                    key={t.id}
                    onClick={() => interactive && onToggleBank(t.id)}
                    title={tooltip}
                    className={`${
                      interactive ? 'cursor-pointer' : 'cursor-default'
                    } transition-colors ${
                      selectedBankIds.has(t.id)
                        ? 'bg-primary-50'
                        : interactive
                          ? 'hover:bg-gray-50'
                          : ''
                    } ${matchedBankIds.has(t.id) ? 'opacity-60' : ''}`}
                  >
                    {view === 'all' ? (
                      <td className="px-2 sm:px-3 py-2 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            t._type === 'credit'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {t._type === 'credit' ? 'Credit' : 'Debit'}
                        </span>
                      </td>
                    ) : (
                      <td className="px-2 sm:px-3 py-2 whitespace-nowrap">
                        {selectedBankIds.has(t.id) && (
                          <span className="text-primary-600 font-bold" aria-label="Selected">
                            ✓
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-2 sm:px-3 py-2 font-medium text-gray-700 whitespace-nowrap">
                      {formatDateCompact(t.date)}
                      {sugMap.has(t.id) && (
                        <span className="ml-1 text-primary-600" title={tooltip}>
                          🔗
                        </span>
                      )}
                    </td>
                    <td
                      className="px-2 sm:px-3 py-2 text-gray-900 min-w-[140px]"
                      title={t.details || ''}
                    >
                      <span>{t.name || t.details || '—'}</span>
                      {flaggedBankIds.has(t.id) && (
                        <span
                          className="ml-1 px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded"
                          title="Flagged by bank rule"
                        >
                          Flagged
                        </span>
                      )}
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-gray-600 font-mono text-xs whitespace-nowrap">
                      {t.chqNo || '—'}
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-gray-600 font-mono text-xs whitespace-nowrap">
                      {t.docRef || '—'}
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-right font-semibold text-gray-900 whitespace-nowrap">
                      {view === 'all'
                        ? !isCredit
                          ? formatAmountNumber(amt)
                          : '—'
                        : view === 'payments'
                          ? formatAmountNumber(amt)
                          : '—'}
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-right font-semibold text-gray-900 whitespace-nowrap">
                      {view === 'all'
                        ? isCredit
                          ? formatAmountNumber(amt)
                          : '—'
                        : view === 'receipts'
                          ? formatAmountNumber(amt)
                          : '—'}
                    </td>
                    <td className="px-2 sm:px-3 py-2 text-right text-gray-600 whitespace-nowrap">
                      {formatAmountNumber(runningBalance)}
                    </td>
                    {view !== 'all' && (
                      <td
                        className="px-2 sm:px-3 py-2 text-xs text-amber-700 truncate min-w-0"
                        title={tooltip}
                      >
                        {!matchedBankIds.has(t.id) && getUnmatchedReason(t, false)}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function buildCbToBank(sugs: SuggestedMatch[]) {
  const map = new Map<string, { bank: Tx; confidence: number; reason: string }[]>()
  for (const s of sugs) {
    if (!map.has(s.cashBookTx.id)) map.set(s.cashBookTx.id, [])
    map.get(s.cashBookTx.id)!.push({ bank: s.bankTx, confidence: s.confidence, reason: s.reason })
  }
  return map
}

function buildBankToCb(sugs: SuggestedMatch[]) {
  const map = new Map<string, { cb: Tx; confidence: number; reason: string }[]>()
  for (const s of sugs) {
    if (!map.has(s.bankTx.id)) map.set(s.bankTx.id, [])
    map.get(s.bankTx.id)!.push({ cb: s.cashBookTx, confidence: s.confidence, reason: s.reason })
  }
  return map
}
