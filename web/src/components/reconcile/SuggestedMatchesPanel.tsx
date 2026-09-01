import { useState } from 'react'
import { Settings } from 'lucide-react'
import { formatAmount } from '../../lib/format'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import Card from '../ui/Card'
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
  onPhasedAutoMatch?: () => void
  isPhasedAutoMatching?: boolean
  isMatching: boolean
  onForgetMemory?: (memoryId: string) => void
  isForgettingMemory?: boolean
  /** When false (schedule-first BRS), hide bulk auto-match actions. */
  encourageAutoMatch?: boolean
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
  onPhasedAutoMatch,
  isPhasedAutoMatching = false,
  isMatching,
  onForgetMemory,
  isForgettingMemory = false,
  encourageAutoMatch = true,
}: SuggestedMatchesPanelProps) {
  const [showSettings, setShowSettings] = useState(false)
  const [listCount, setListCount] = useState(150)
  const highConfidence = suggestions.filter((s) => s.confidence >= 0.95)
  const safeSuggestions = suggestions.filter((s) => !s.duplicateWarning && s.confidence >= 0.9)
  const phaseBPatternRe =
    /Ecobank |SCB |GCB |NIB |Prudential |Absa |BOA |ref shifted|via bank/i
  const phaseBSuggestions = suggestions.filter(
    (s) =>
      !s.duplicateWarning &&
      s.confidence >= 0.85 &&
      (s.bankPattern ||
        s.ecobankPattern ||
        phaseBPatternRe.test(s.reason || ''))
  )
  const visible = suggestions.slice(0, listCount)
  const canBulk = !!features.bulk_match
  return (
    <Card
      title="Suggested matches"
      sublabel={
        encourageAutoMatch
          ? canBulk
            ? 'Click a suggestion to pre-select, or tick to bulk-select.'
            : 'Click a suggestion to pre-select, then click Match.'
          : 'Reference only for schedule BRS — do not bulk-match. Open Report for uncredited, unpresented, and bank-only lines.'
      }
      actions={
        <Button
          type="button"
          variant={showSettings ? 'secondary' : 'outline'}
          size="xs"
          onClick={() => setShowSettings((v) => !v)}
          aria-expanded={showSettings}
        >
          <Settings className="w-4 h-4 mr-1.5" />
          {showSettings ? 'Hide Settings' : 'Matching Settings'}
        </Button>
      }
    >

      {showSettings && (
        <MatchSettingsPanel value={matchParams} onChange={onMatchParamsChange} />
      )}

      {canBulk && encourageAutoMatch && (
        <div className="flex flex-wrap gap-2 mb-4">
          {onPhasedAutoMatch && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onPhasedAutoMatch}
              disabled={isMatching}
              isLoading={isPhasedAutoMatching}
              title="Runs server-side auto-complete: safe 90%+ matches, bank-pattern 85%+, corroborated cheque refs, then residual sweeps/clearing pairs (SCB/Ecobank/GCB/NIB etc.)"
            >
              Auto-match all
            </Button>
          )}
          {highConfidence.length > 0 && (
            <Button
              type="button"
              size="sm"
              onClick={() =>
                onBulkMatch(
                  highConfidence.map((s) => ({
                    cashBookTransactionId: s.cashBookTx.id,
                    bankTransactionId: s.bankTx.id,
                  }))
                )
              }
              disabled={isMatching}
              className="bg-green-600 hover:bg-green-700 focus:ring-green-500"
              title="Apply only suggestions with 95%+ confidence"
            >
              Match all high-confidence (95%+) — {highConfidence.length}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={() =>
              onBulkMatch(
                safeSuggestions.map((s) => ({
                  cashBookTransactionId: s.cashBookTx.id,
                  bankTransactionId: s.bankTx.id,
                }))
              )
            }
            disabled={isMatching || safeSuggestions.length === 0}
            title="Skips ambiguous duplicates; requires 90%+ confidence"
          >
            Match safe suggestions (90%+, no duplicates) — {safeSuggestions.length}
          </Button>
          {phaseBSuggestions.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                onBulkMatch(
                  phaseBSuggestions.map((s) => ({
                    cashBookTransactionId: s.cashBookTx.id,
                    bankTransactionId: s.bankTx.id,
                  }))
                )
              }
              disabled={isMatching || phaseBSuggestions.length === 0}
              title="Phase B: pattern-matched suggestions at 85%+ (Ecobank/SCB/GCB/NIB/Prudential/Absa/BOA) — skips generic amount-only guesses"
            >
              Match receipts + Ecobank patterns (85%+) — {phaseBSuggestions.length}
            </Button>
          )}
          {bulkSelected.size > 0 && (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                const pairs = Array.from(bulkSelected).map((i) => ({
                  cashBookTransactionId: suggestions[i].cashBookTx.id,
                  bankTransactionId: suggestions[i].bankTx.id,
                }))
                onBulkMatch(pairs)
              }}
              disabled={isMatching}
            >
              Match {bulkSelected.size} selected
            </Button>
          )}
        </div>
      )}

      <ul className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {visible.map((s, i) => {
          const isSelected =
            selectedCbIds.has(s.cashBookTx.id) && selectedBankIds.has(s.bankTx.id)
          return (
            <li key={i}>
              <label
                className={`flex items-center gap-3 w-full text-left px-4 py-2.5 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-primary-400 bg-primary-50 shadow-sm'
                    : 'border-border hover:bg-gray-50'
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
                  <span className="mx-1.5 text-gray-400">↔</span>
                  <span className="text-gray-700">
                    {s.bankTx.name || s.bankTx.details || '—'}
                  </span>
                  <span className="ml-2 text-xs font-medium text-gray-500">
                    {formatAmount(s.cashBookTx.amount, currency)} ·{' '}
                    {Math.round(s.confidence * 100)}%
                  </span>
                  {s.reason.toLowerCase().includes('ecobank clearing') && (
                    <Badge size="sm" tone="brand" className="ml-2" title="Ecobank inward clearing / HSE deposit — payment matched to bank credit">
                      Clearing
                    </Badge>
                  )}
                  {s.reason.toLowerCase().includes('ecobank transfer') && (
                    <Badge size="sm" tone="warning" className="ml-2" title="Ecobank outward transfer — payment matched to bank debit">
                      Transfer
                    </Badge>
                  )}
                  {s.reason.toLowerCase().includes('ecobank withdrawal') && (
                    <Badge size="sm" tone="neutral" className="ml-2" title="Ecobank named withdrawal — payment matched to bank debit by payee">
                      Withdrawal
                    </Badge>
                  )}
                  {(s.bankPattern || s.ecobankPattern) &&
                    !/ecobank (clearing|transfer|withdrawal)/i.test(s.reason) && (
                      <Badge
                        size="sm"
                        tone="brand"
                        className="ml-2"
                        title={s.reason}
                      >
                        Pattern
                      </Badge>
                    )}
                  {features.ai_suggestions &&
                    (s.orgMemoryBoosted || /org memory/i.test(s.reason)) && (
                    <span className="ml-2 inline-flex items-center gap-1">
                      <Badge
                        size="sm"
                        tone="success"
                        title={
                          s.orgMemoryConfirmations
                            ? `Boosted from ${s.orgMemoryConfirmations} prior confirmation(s) of a similar amount + reference/narration`
                            : 'Boosted because your organisation confirmed a similar amount + reference/narration before'
                        }
                      >
                        Learned
                        {s.orgMemoryConfirmations != null && s.orgMemoryConfirmations > 0
                          ? ` · ${s.orgMemoryConfirmations}×`
                          : ''}
                      </Badge>
                    </span>
                  )}
                  {s.duplicateWarning && (
                    <Badge
                      size="sm"
                      tone="warning"
                      className="ml-2"
                      title="Multiple bank transactions match this cash book — verify before matching"
                    >
                      Verify
                    </Badge>
                  )}
                </button>
                {onForgetMemory && s.orgMemoryId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="shrink-0"
                    disabled={isForgettingMemory}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      onForgetMemory(s.orgMemoryId!)
                    }}
                    title="Stop boosting suggestions from this learned pattern"
                  >
                    Forget
                  </Button>
                )}
              </label>
            </li>
          )
        })}
      </ul>
      {suggestions.length > listCount && (
        <Button
          type="button"
          variant="outline"
          className="mt-3 w-full"
          onClick={() => setListCount((n) => Math.min(n + 150, suggestions.length))}
        >
          Show more suggestions ({listCount} of {suggestions.length})
        </Button>
      )}
    </Card>
  )
}
