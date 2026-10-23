import { useMemo, useState } from 'react'
import { formatAmountNumber, formatDateCompact } from '../../lib/format'
import { getCurrencySymbol } from '../../lib/currency'
import Badge from '../ui/Badge'
import Card from '../ui/Card'
import type { ReconcileView, Tx } from './types'

type CbRow = {
  t: Tx & { _type?: 'receipt' | 'payment' }
  isReceipt: boolean
  runningBalance: number
}

type BankRow = {
  t: Tx & { _type?: 'credit' | 'debit' }
  amt: number
  isCredit: boolean
  runningBalance: number
}

type ReconcileMobileReviewProps = {
  view: ReconcileView
  canReconcile: boolean
  currency: string
  cbRows: CbRow[]
  bankRows: BankRow[]
  matchedCbIds: Set<string>
  matchedBankIds: Set<string>
  flaggedBankIds: Set<string>
  selectedCbIds: Set<string>
  selectedBankIds: Set<string>
  onToggleCb: (id: string) => void
  onToggleBank: (id: string) => void
  cbUnmatchedNote: (t: Tx) => string
  bankUnmatchedNote: (t: Tx) => string
  cbHasSuggestion: (t: Tx, isReceipt: boolean) => boolean
  bankHasSuggestion: (t: Tx, isCredit: boolean) => boolean
}

function UnmatchedToggle({
  checked,
  onChange,
  unmatchedCount,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  unmatchedCount: number
}) {
  return (
    <label className="flex items-center gap-3 min-h-[44px] rounded-xl border border-border bg-white px-3 py-2 text-sm text-gray-800 shadow-card cursor-pointer">
      <input
        type="checkbox"
        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="flex-1 leading-snug">
        <span className="font-semibold text-gray-900">Unmatched only</span>
        <span className="block text-xs text-gray-500">{unmatchedCount} open line(s) in this view</span>
      </span>
    </label>
  )
}

export default function ReconcileMobileReview({
  view,
  canReconcile,
  currency,
  cbRows,
  bankRows,
  matchedCbIds,
  matchedBankIds,
  flaggedBankIds,
  selectedCbIds,
  selectedBankIds,
  onToggleCb,
  onToggleBank,
  cbUnmatchedNote,
  bankUnmatchedNote,
  cbHasSuggestion,
  bankHasSuggestion,
}: ReconcileMobileReviewProps) {
  const interactive = canReconcile && view !== 'all'
  const [unmatchedOnly, setUnmatchedOnly] = useState(interactive)

  const unmatchedCb = useMemo(
    () => cbRows.filter(({ t }) => !matchedCbIds.has(t.id)).length,
    [cbRows, matchedCbIds]
  )
  const unmatchedBank = useMemo(
    () => bankRows.filter(({ t }) => !matchedBankIds.has(t.id)).length,
    [bankRows, matchedBankIds]
  )

  const visibleCb = useMemo(() => {
    if (!unmatchedOnly) return cbRows
    return cbRows.filter(({ t }) => !matchedCbIds.has(t.id))
  }, [cbRows, unmatchedOnly, matchedCbIds])

  const visibleBank = useMemo(() => {
    if (!unmatchedOnly) return bankRows
    return bankRows.filter(({ t }) => !matchedBankIds.has(t.id))
  }, [bankRows, unmatchedOnly, matchedBankIds])

  const sym = getCurrencySymbol(currency)

  return (
    <div className="lg:hidden flex flex-col gap-4">
      <div className="rounded-xl border border-primary-100 bg-primary-50/80 px-3 py-3 text-xs text-primary-900 leading-relaxed">
        <p className="font-semibold">Mobile review</p>
        <p className="mt-1 text-primary-800/90">
          {interactive
            ? 'Tap a row to select it. Use Receipts or Payments view (not All) to match. Confirm appears at the bottom.'
            : 'Swipe-friendly list. Switch to Receipts or Payments and use a larger screen to match lines.'}
        </p>
      </div>

      {interactive && (
        <UnmatchedToggle
          checked={unmatchedOnly}
          onChange={setUnmatchedOnly}
          unmatchedCount={unmatchedCb + unmatchedBank}
        />
      )}

      <Card noPadding>
        <div className="px-4 py-3 border-b border-border bg-surface">
          <h3 className="text-sm font-bold text-gray-900">Cash book</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {visibleCb.length} line{visibleCb.length === 1 ? '' : 's'}
            {unmatchedOnly ? ' · unmatched' : ''}
          </p>
        </div>
        <ul className="divide-y divide-gray-100 max-h-[28rem] overflow-y-auto">
          {visibleCb.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-gray-500">No lines to show.</li>
          ) : (
            visibleCb.map(({ t, isReceipt, runningBalance }) => {
              const selected = selectedCbIds.has(t.id)
              const matched = matchedCbIds.has(t.id)
              const suggested = cbHasSuggestion(t, isReceipt)
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    disabled={!interactive}
                    onClick={() => onToggleCb(t.id)}
                    className={`w-full text-left px-4 py-3.5 min-h-[44px] transition-colors ${
                      interactive ? 'active:bg-gray-100' : ''
                    } ${selected ? 'bg-primary-50 ring-1 ring-inset ring-primary-200' : ''} ${
                      matched ? 'opacity-70' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-gray-500">
                            {formatDateCompact(t.date)}
                          </span>
                          {view === 'all' && (
                            <Badge tone={isReceipt ? 'success' : 'brand'} size="sm">
                              {isReceipt ? 'Receipt' : 'Payment'}
                            </Badge>
                          )}
                          {matched && (
                            <Badge tone="neutral" size="sm">Matched</Badge>
                          )}
                          {suggested && !matched && (
                            <Badge tone="success" size="sm">Suggested</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-sm font-medium text-gray-900 truncate">
                          {t.name || t.details || '—'}
                        </p>
                        {t.details && t.name && (
                          <p className="text-xs text-gray-500 truncate mt-0.5">{t.details}</p>
                        )}
                        {!matched && view !== 'all' && (
                          <p className="text-xs text-amber-800 mt-1.5 line-clamp-2">
                            {cbUnmatchedNote(t)}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold text-gray-900 tabular-nums">
                          {sym}
                          {formatAmountNumber(Number(t.amount))}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5 tabular-nums">
                          Bal {formatAmountNumber(runningBalance)}
                        </p>
                        {selected && (
                          <span className="inline-block mt-1 text-primary-600 text-xs font-bold">Selected</span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </Card>

      <Card noPadding>
        <div className="px-4 py-3 border-b border-border bg-surface">
          <h3 className="text-sm font-bold text-gray-900">Bank statement</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {visibleBank.length} line{visibleBank.length === 1 ? '' : 's'}
            {unmatchedOnly ? ' · unmatched' : ''}
          </p>
        </div>
        <ul className="divide-y divide-gray-100 max-h-[28rem] overflow-y-auto">
          {visibleBank.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-gray-500">No lines to show.</li>
          ) : (
            visibleBank.map(({ t, amt, isCredit, runningBalance }) => {
              const selected = selectedBankIds.has(t.id)
              const matched = matchedBankIds.has(t.id)
              const suggested = bankHasSuggestion(t, isCredit)
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    disabled={!interactive}
                    onClick={() => onToggleBank(t.id)}
                    className={`w-full text-left px-4 py-3.5 min-h-[44px] transition-colors ${
                      interactive ? 'active:bg-gray-100' : ''
                    } ${selected ? 'bg-primary-50 ring-1 ring-inset ring-primary-200' : ''} ${
                      matched ? 'opacity-70' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-gray-500">
                            {formatDateCompact(t.date)}
                          </span>
                          {view === 'all' && (
                            <Badge tone={isCredit ? 'success' : 'brand'} size="sm">
                              {isCredit ? 'Credit' : 'Debit'}
                            </Badge>
                          )}
                          {flaggedBankIds.has(t.id) && (
                            <Badge tone="warning" size="sm">Flagged</Badge>
                          )}
                          {matched && <Badge tone="neutral" size="sm">Matched</Badge>}
                          {suggested && !matched && (
                            <Badge tone="success" size="sm">Suggested</Badge>
                          )}
                        </div>
                        <p className="mt-1 text-sm font-medium text-gray-900 truncate">
                          {t.name || t.details || '—'}
                        </p>
                        {!matched && view !== 'all' && (
                          <p className="text-xs text-amber-800 mt-1.5 line-clamp-2">
                            {bankUnmatchedNote(t)}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold text-gray-900 tabular-nums">
                          {sym}
                          {formatAmountNumber(amt)}
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5 tabular-nums">
                          Bal {formatAmountNumber(runningBalance)}
                        </p>
                        {selected && (
                          <span className="inline-block mt-1 text-primary-600 text-xs font-bold">Selected</span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </Card>

      <p className="text-xs text-gray-500 text-center pb-2">
        Full grid with exports is available on larger screens (laptop or tablet landscape).
      </p>
    </div>
  )
}
