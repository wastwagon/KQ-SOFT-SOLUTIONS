import { useState } from 'react'
import { Settings } from 'lucide-react'
import { formatAmount } from '../../lib/format'
import MatchSettingsPanel from './MatchSettingsPanel'
import type { MatchParams, SuggestedMatch } from './types'

/**
 * Suggested matches card.  Renders the auto-generated 1:1 suggestions with:
 *   - A toggle that opens MatchSettingsPanel.
 *   - Bulk-action buttons for premium plans (high-confidence, all, selected).
 *   - A scrollable list where each row is selectable and clickable.
 *
 * The page above passes selection state in and gets back callbacks for what
 * the user did — this component never owns the selection itself.
 */
interface SuggestedMatchesPanelProps {
  suggestions: SuggestedMatch[]
  currency: string
  features: Record<string, boolean>
  matchParams: MatchParams
  onMatchParamsChange: (next: MatchParams) => void
  selectedCbIds: Set<string>
  selectedBankIds: Set<string>
  onSelectPair: (cbId: string, bankId: string) => void
  bulkSelected: Set<number>
  onBulkSelectedChange: (next: Set<number>) => void
  onBulkMatch: (pairs: { cashBookTransactionId: string; bankTransactionId: string }[]) => void
  isMatching: boolean
}

export default function SuggestedMatchesPanel({
  suggestions,
  currency,
  features,
  matchParams,
  onMatchParamsChange,
  selectedCbIds,
  selectedBankIds,
  onSelectPair,
  bulkSelected,
  onBulkSelectedChange,
  onBulkMatch,
  isMatching,
}: SuggestedMatchesPanelProps) {
  const [showSettings, setShowSettings] = useState(false)
  const highConfidence = suggestions.filter((s) => s.confidence >= 0.95)
  const visible = suggestions.slice(0, 50)
  const canBulk = !!features.bulk_match

  return (
    <section className="rounded-xl border border-amber-200/80 bg-amber-50/80 p-5 shadow-sm">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold text-amber-900 tracking-tight mb-1">
            Suggested matches
          </h3>
          <p className="text-sm text-amber-800/90">
            {canBulk
              ? 'Click a suggestion to pre-select, or tick to bulk-select.'
              : 'Click a suggestion to pre-select, then click Match.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowSettings((v) => !v)}
          aria-expanded={showSettings}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            showSettings ? 'bg-amber-200 text-amber-900' : 'bg-white/80 text-amber-700 hover:bg-white'
          } border border-amber-200`}
        >
          <Settings className="w-4 h-4" />
          {showSettings ? 'Hide Settings' : 'Matching Settings'}
        </button>
      </header>

      {showSettings && (
        <MatchSettingsPanel value={matchParams} onChange={onMatchParamsChange} />
      )}

      {canBulk && (
        <div className="flex flex-wrap gap-2 mb-4">
          {highConfidence.length > 0 && (
            <button
              type="button"
              onClick={() =>
                onBulkMatch(
                  highConfidence.map((s) => ({
                    cashBookTransactionId: s.cashBookTx.id,
                    bankTransactionId: s.bankTx.id,
                  }))
                )
              }
              disabled={isMatching}
              className="px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium shadow-sm hover:bg-green-700 hover:shadow disabled:opacity-50 transition-all"
              title="Apply only suggestions with 95%+ confidence"
            >
              {isMatching
                ? 'Matching…'
                : `Match all high-confidence (95%+) — ${highConfidence.length}`}
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              onBulkMatch(
                visible.map((s) => ({
                  cashBookTransactionId: s.cashBookTx.id,
                  bankTransactionId: s.bankTx.id,
                }))
              )
            }
            disabled={isMatching || visible.length === 0}
            className="px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium shadow-sm hover:bg-primary-700 hover:shadow disabled:opacity-50 transition-all"
          >
            {isMatching ? 'Matching…' : 'Match all suggested (up to 50)'}
          </button>
          {bulkSelected.size > 0 && (
            <button
              type="button"
              onClick={() => {
                const pairs = Array.from(bulkSelected).map((i) => ({
                  cashBookTransactionId: suggestions[i].cashBookTx.id,
                  bankTransactionId: suggestions[i].bankTx.id,
                }))
                onBulkMatch(pairs)
              }}
              disabled={isMatching}
              className="px-4 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-medium shadow-sm hover:bg-primary-600 disabled:opacity-50 transition-all"
            >
              Match {bulkSelected.size} selected
            </button>
          )}
        </div>
      )}

      <ul className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {visible.map((s, i) => {
          const isSelected =
            selectedCbIds.has(s.cashBookTx.id) && selectedBankIds.has(s.bankTx.id)
          return (
            <li key={i}>
              <label
                className={`flex items-center gap-3 w-full text-left px-4 py-2.5 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-primary-400 bg-primary-50 shadow-sm'
                    : 'border-amber-200/70 hover:bg-amber-100/70'
                }`}
              >
                {canBulk && (
                  <input
                    type="checkbox"
                    checked={bulkSelected.has(i)}
                    onChange={(e) => {
                      e.stopPropagation()
                      const next = new Set(bulkSelected)
                      if (next.has(i)) next.delete(i)
                      else next.add(i)
                      onBulkSelectedChange(next)
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                )}
                <button
                  type="button"
                  onClick={() => onSelectPair(s.cashBookTx.id, s.bankTx.id)}
                  className="flex-1 text-left text-sm text-gray-900"
                >
                  <span className="font-semibold text-gray-900">
                    {s.cashBookTx.name || s.cashBookTx.details || '—'}
                  </span>
                  <span className="mx-1.5 text-amber-600">↔</span>
                  <span className="text-gray-700">
                    {s.bankTx.name || s.bankTx.details || '—'}
                  </span>
                  <span className="ml-2 text-xs font-medium text-gray-500">
                    {formatAmount(s.cashBookTx.amount, currency)} ·{' '}
                    {Math.round(s.confidence * 100)}%
                  </span>
                  {s.duplicateWarning && (
                    <span
                      className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800"
                      title="Multiple bank transactions match this cash book — verify before matching"
                    >
                      Verify
                    </span>
                  )}
                </button>
              </label>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
