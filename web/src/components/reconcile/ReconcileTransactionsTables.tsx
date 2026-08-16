import { useMemo, useState } from 'react'
import { formatAmountNumber, formatDateCompact } from '../../lib/format'
import { amountColumnHeader, getCurrencySymbol } from '../../lib/currency'
import {
  getStoredDateOrder,
  setStoredDateOrder,
  sortTxsByDate,
  type DateOrder,
} from '../../lib/transactionDateOrder'
import DateOrderToggle from '../DateOrderToggle'
import ReconcileTableExportButtons from './ReconcileTableExportButtons'
import SuggestedMatchMark from './SuggestedMatchMark'
import Badge from '../ui/Badge'
import Card from '../ui/Card'
import type { ReconcileView, SuggestedMatch, Tx } from './types'

/**
 * The two stacked transaction tables (Cash Book + Bank Statement) shown at
 * the bottom of the reconcile page. Owns suggestion maps, unmatched reasons,
 * and running-balance accumulation so the page-level orchestrator stays slim.
 */
interface ReconcileTransactionsTablesProps {
  projectSlug: string
  projectName?: string
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

function fmtAmt(n: number) {
  return formatAmountNumber(Number.isFinite(n) ? n : 0)
}

function formatMatchTooltip(label: string, t: Tx, conf: number, reason: string) {
  return `${label}: ${formatDateCompact(t.date)} • ${(t.name || t.details || '—').slice(0, 40)} • ${fmtAmt(t.amount)} (${Math.round(conf * 100)}%: ${reason})`
}

/** Extra columns stay available on wide screens; laptops keep date, narrative, and amounts. */
const COL_XL = 'hidden xl:table-cell'
const COL_2XL = 'hidden 2xl:table-cell'

export default function ReconcileTransactionsTables({
  projectSlug,
  projectName,
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
  const [dateOrder, setDateOrder] = useState<DateOrder>(() => getStoredDateOrder())

  function changeDateOrder(next: DateOrder) {
    setDateOrder(next)
    setStoredDateOrder(next)
  }

  // Build suggestion lookup tables once per render — used for the suggested-match marker
  // and the row tooltip.
  const cbReceiptToBank = useMemo(() => buildCbToBank(receiptSugs), [receiptSugs])
  const cbPaymentToBank = useMemo(() => buildCbToBank(paymentSugs), [paymentSugs])
  const bankCreditToCb = useMemo(() => buildBankToCb(receiptSugs), [receiptSugs])
  const bankDebitToCb = useMemo(() => buildBankToCb(paymentSugs), [paymentSugs])

  // Always chronological for balances; reverse for newest-first display.
  const cbTxsChrono = useMemo<Array<Tx & { _type?: 'receipt' | 'payment' }>>(() => {
    if (view === 'all') {
      return sortTxsByDate(
        [
          ...receipts.map((t) => ({ ...t, _type: 'receipt' as const })),
          ...payments.map((t) => ({ ...t, _type: 'payment' as const })),
        ],
        'oldest_first'
      )
    }
    return sortTxsByDate(view === 'receipts' ? [...receipts] : [...payments], 'oldest_first')
  }, [view, receipts, payments])

  const bankTxsChrono = useMemo<Array<Tx & { _type?: 'credit' | 'debit' }>>(() => {
    if (view === 'all') {
      return sortTxsByDate(
        [
          ...credits.map((t) => ({ ...t, _type: 'credit' as const })),
          ...debits.map((t) => ({ ...t, _type: 'debit' as const })),
        ],
        'oldest_first'
      )
    }
    return sortTxsByDate(view === 'receipts' ? [...credits] : [...debits], 'oldest_first')
  }, [view, credits, debits])

  // NOTE: We use `reduce` rather than a `let runningBalance` accumulator
  // because the React Hooks lint rule (`react-hooks/immutability`) flags
  // mutable closures inside `useMemo` — they can cause inconsistent reads
  // on subsequent renders.  Each row carries its own pre-summed balance.
  const cbRows = useMemo(() => {
    const chrono = cbTxsChrono.reduce<
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
    }, [])
    return dateOrder === 'newest_first' ? [...chrono].reverse() : chrono
  }, [cbTxsChrono, view, dateOrder])

  const bankRows = useMemo(() => {
    const chrono = bankTxsChrono.reduce<
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
    }, [])
    return dateOrder === 'newest_first' ? [...chrono].reverse() : chrono
  }, [bankTxsChrono, view, dateOrder])

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

  const exportBase = {
    view,
    currency,
    projectSlug,
    projectName,
    receipts,
    payments,
    credits,
    debits,
    matchedCbIds,
    matchedBankIds,
    dateOrder,
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          Default list order is oldest → newest (cash book style). Switch to newest first to scan
          recent activity; running balances stay period-correct either way.
        </p>
        <DateOrderToggle value={dateOrder} onChange={changeDateOrder} />
      </div>

      {/* Cash Book table */}
      <Card noPadding>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-surface border-b border-border">
          <h3 className="text-sm font-bold text-gray-900 tracking-tight">Cash Book</h3>
          <ReconcileTableExportButtons side="cash_book" label="cash book" {...exportBase} />
        </div>
        <div className="overflow-x-auto overflow-y-auto max-h-[45rem]">
          <table className="min-w-full text-xs sm:text-sm text-gray-900">
            <thead className="bg-white sticky top-0 z-10">
              <tr>
                {view !== 'all' && (
                  <th
                    scope="col"
                    className="px-2 sm:px-3 py-1.5 text-left w-8 text-gray-500 font-medium"
                  />
                )}
                {view === 'all' && (
                  <th
                    scope="col"
                    className="px-2 sm:px-3 py-1.5 text-left text-gray-600 font-semibold whitespace-nowrap"
                  >
                    Type
                  </th>
                )}
                <th
                  scope="col"
                  className="px-2 sm:px-3 py-1.5 text-left text-gray-600 font-semibold whitespace-nowrap"
                >
                  Date
                </th>
                <th
                  scope="col"
                  className="px-2 sm:px-3 py-1.5 text-left text-gray-600 font-semibold max-w-[9rem]"
                >
                  Name
                </th>
                <th
                  scope="col"
                  className={`${COL_XL} px-2 sm:px-3 py-1.5 text-left text-gray-600 font-semibold max-w-[16rem]`}
                >
                  Description
                </th>
                <th
                  scope="col"
                  className={`${COL_XL} px-2 sm:px-3 py-1.5 text-left text-gray-600 font-semibold whitespace-nowrap`}
                >
                  Chq no.
                </th>
                <th
                  scope="col"
                  className={`${COL_2XL} px-2 sm:px-3 py-1.5 text-left text-gray-600 font-semibold whitespace-nowrap`}
                >
                  Ref. Doc. No.
                </th>
                <th
                  scope="col"
                  className="px-2 sm:px-3 py-1.5 text-right text-gray-600 font-semibold whitespace-nowrap"
                >
                  Received ({amountColumnHeader(currency)})
                </th>
                <th
                  scope="col"
                  className="px-2 sm:px-3 py-1.5 text-right text-gray-600 font-semibold whitespace-nowrap"
                >
                  Paid ({amountColumnHeader(currency)})
                </th>
                <th
                  scope="col"
                  className={`${COL_XL} px-2 sm:px-3 py-1.5 text-right text-gray-600 font-semibold whitespace-nowrap`}
                >
                  Balance ({getCurrencySymbol(currency)})
                </th>
                {view !== 'all' && (
                  <th
                    scope="col"
                    className={`${COL_2XL} px-2 sm:px-3 py-1.5 text-left text-gray-500 font-medium`}
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
                      <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap">
                        {selectedCbIds.has(t.id) && (
                          <span className="text-primary-600 font-bold" aria-label="Selected">
                            ✓
                          </span>
                        )}
                      </td>
                    )}
                    {view === 'all' && (
                      <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap">
                        <Badge tone={isReceipt ? 'success' : 'brand'} size="sm">
                          {isReceipt ? 'Receipt' : 'Payment'}
                        </Badge>
                      </td>
                    )}
                    <td className="px-2 sm:px-3 py-1.5 font-medium text-gray-700 whitespace-nowrap">
                      {formatDateCompact(t.date)}
                      {sugMap.has(t.id) && <SuggestedMatchMark title={tooltip} />}
                    </td>
                    <td
                      className="px-2 sm:px-3 py-1.5 text-gray-900 max-w-[9rem] truncate"
                      title={[t.name, t.details].filter(Boolean).join(' — ') || undefined}
                    >
                      {t.name || '—'}
                    </td>
                    <td
                      className={`${COL_XL} px-2 sm:px-3 py-1.5 text-gray-700 max-w-[16rem] truncate`}
                      title={t.details || ''}
                    >
                      {t.details || '—'}
                    </td>
                    <td className={`${COL_XL} px-2 sm:px-3 py-1.5 text-gray-600 font-mono text-xs whitespace-nowrap`}>
                      {t.chqNo || '—'}
                    </td>
                    <td className={`${COL_2XL} px-2 sm:px-3 py-1.5 text-gray-600 font-mono text-xs whitespace-nowrap`}>
                      {t.docRef || '—'}
                    </td>
                    <td className="px-2 sm:px-3 py-1.5 text-right font-semibold text-gray-900 whitespace-nowrap">
                      {isReceipt ? formatAmountNumber(t.amount) : '—'}
                    </td>
                    <td className="px-2 sm:px-3 py-1.5 text-right font-semibold text-gray-900 whitespace-nowrap">
                      {!isReceipt ? formatAmountNumber(t.amount) : '—'}
                    </td>
                    <td className={`${COL_XL} px-2 sm:px-3 py-1.5 text-right text-gray-600 whitespace-nowrap`}>
                      {formatAmountNumber(runningBalance)}
                    </td>
                    {view !== 'all' && (
                      <td
                        className={`${COL_2XL} px-2 sm:px-3 py-1.5 text-xs text-amber-700 truncate max-w-[12rem]`}
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
      </Card>

      {/* Bank Statement table */}
      <Card noPadding>
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 bg-surface border-b border-border">
          <h3 className="text-sm font-bold text-gray-900 tracking-tight">Bank Statement</h3>
          <ReconcileTableExportButtons side="bank_statement" label="bank statement" {...exportBase} />
        </div>
        <div className="overflow-x-auto overflow-y-auto max-h-[45rem]">
          <table className="min-w-full text-xs sm:text-sm text-gray-900">
            <thead className="bg-white sticky top-0 z-10">
              <tr>
                {view !== 'all' && (
                  <th
                    scope="col"
                    className="px-2 sm:px-3 py-1.5 text-left w-8 text-gray-500 font-medium"
                  />
                )}
                {view === 'all' && (
                  <th
                    scope="col"
                    className="px-2 sm:px-3 py-1.5 text-left text-gray-600 font-semibold whitespace-nowrap"
                  >
                    Type
                  </th>
                )}
                <th
                  scope="col"
                  className="px-2 sm:px-3 py-1.5 text-left text-gray-600 font-semibold whitespace-nowrap"
                >
                  Date
                </th>
                <th
                  scope="col"
                  className="px-2 sm:px-3 py-1.5 text-left text-gray-600 font-semibold max-w-[16rem]"
                >
                  Description
                </th>
                <th
                  scope="col"
                  className={`${COL_XL} px-2 sm:px-3 py-1.5 text-left text-gray-600 font-semibold whitespace-nowrap`}
                >
                  Chq no.
                </th>
                <th
                  scope="col"
                  className={`${COL_2XL} px-2 sm:px-3 py-1.5 text-left text-gray-600 font-semibold whitespace-nowrap`}
                >
                  Ref. Doc. No.
                </th>
                <th
                  scope="col"
                  className="px-2 sm:px-3 py-1.5 text-right text-gray-600 font-semibold whitespace-nowrap"
                >
                  Debit ({amountColumnHeader(currency)})
                </th>
                <th
                  scope="col"
                  className="px-2 sm:px-3 py-1.5 text-right text-gray-600 font-semibold whitespace-nowrap"
                >
                  Credit ({amountColumnHeader(currency)})
                </th>
                <th
                  scope="col"
                  className={`${COL_XL} px-2 sm:px-3 py-1.5 text-right text-gray-600 font-semibold whitespace-nowrap`}
                >
                  Balance ({getCurrencySymbol(currency)})
                </th>
                {view !== 'all' && (
                  <th
                    scope="col"
                    className={`${COL_2XL} px-2 sm:px-3 py-1.5 text-left text-gray-500 font-medium`}
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
                      <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap">
                        <Badge tone={t._type === 'credit' ? 'success' : 'brand'} size="sm">
                          {t._type === 'credit' ? 'Credit' : 'Debit'}
                        </Badge>
                      </td>
                    ) : (
                      <td className="px-2 sm:px-3 py-1.5 whitespace-nowrap">
                        {selectedBankIds.has(t.id) && (
                          <span className="text-primary-600 font-bold" aria-label="Selected">
                            ✓
                          </span>
                        )}
                      </td>
                    )}
                    <td className="px-2 sm:px-3 py-1.5 font-medium text-gray-700 whitespace-nowrap">
                      {formatDateCompact(t.date)}
                      {sugMap.has(t.id) && <SuggestedMatchMark title={tooltip} />}
                    </td>
                    <td
                      className="px-2 sm:px-3 py-1.5 text-gray-900 max-w-[16rem] truncate"
                      title={t.details || t.name || undefined}
                    >
                      <span>{t.name || t.details || '—'}</span>
                      {flaggedBankIds.has(t.id) && (
                        <Badge size="sm" tone="warning" className="ml-1" title="Flagged by bank rule">
                          Flagged
                        </Badge>
                      )}
                    </td>
                    <td className={`${COL_XL} px-2 sm:px-3 py-1.5 text-gray-600 font-mono text-xs whitespace-nowrap`}>
                      {t.chqNo || '—'}
                    </td>
                    <td className={`${COL_2XL} px-2 sm:px-3 py-1.5 text-gray-600 font-mono text-xs whitespace-nowrap`}>
                      {t.docRef || '—'}
                    </td>
                    <td className="px-2 sm:px-3 py-1.5 text-right font-semibold text-gray-900 whitespace-nowrap">
                      {view === 'all'
                        ? !isCredit
                          ? formatAmountNumber(amt)
                          : '—'
                        : view === 'payments'
                          ? formatAmountNumber(amt)
                          : '—'}
                    </td>
                    <td className="px-2 sm:px-3 py-1.5 text-right font-semibold text-gray-900 whitespace-nowrap">
                      {view === 'all'
                        ? isCredit
                          ? formatAmountNumber(amt)
                          : '—'
                        : view === 'receipts'
                          ? formatAmountNumber(amt)
                          : '—'}
                    </td>
                    <td className={`${COL_XL} px-2 sm:px-3 py-1.5 text-right text-gray-600 whitespace-nowrap`}>
                      {formatAmountNumber(runningBalance)}
                    </td>
                    {view !== 'all' && (
                      <td
                        className={`${COL_2XL} px-2 sm:px-3 py-1.5 text-xs text-amber-700 truncate max-w-[12rem]`}
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
      </Card>
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
