import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight, ChevronDown } from 'lucide-react'
import BrsHelp from '../components/BrsHelp'
import ConfirmedMatchesPanel from '../components/reconcile/ConfirmedMatchesPanel'
import MatchActionBar from '../components/reconcile/MatchActionBar'
import ReconcileToolbar from '../components/reconcile/ReconcileToolbar'
import ReconcileTransactionsTables from '../components/reconcile/ReconcileTransactionsTables'
import CountMatchPanel from '../components/reconcile/CountMatchPanel'
import SplitSuggestionsPanel from '../components/reconcile/SplitSuggestionsPanel'
import SuggestedMatchesPanel from '../components/reconcile/SuggestedMatchesPanel'
import { useReconcileSession } from '../components/reconcile/useReconcileSession'
import { RECONCILE_CLIENT_LIMIT } from '../lib/importLimits'
import SubscriptionRenewalPanel from '../components/SubscriptionRenewalPanel'
import WorkflowStepIntro from '../components/project/WorkflowStepIntro'
import WorkflowStepSkeleton from '../components/project/WorkflowStepSkeleton'
import Button from '../components/ui/Button'
import Alert from '../components/ui/Alert'
import type { MatchedPair, SuggestedMatch, SuggestedSplitMatch, Tx } from '../components/reconcile/types'
import { ghanaBankProfileTip } from '../lib/ghanaBankProfileTips'

/**
 * Orchestrator for the reconcile step of the BRS workflow.
 *
 * All data, mutations, persistence and selection live in
 * {@link useReconcileSession}; the panels and tables below are
 * pure-presentational and composed here.  The page is responsible only for:
 *   - Picking which slice of data each subcomponent sees (filtered by view).
 *   - Knowing which mutation to fire for the current selection (1:1 vs N:M).
 *   - Empty-state messaging and the "Proceed to Review" CTA.
 */
type ProjectReconcileProps = {
  projectId: string
  canReconcile?: boolean
  onProceedToReview?: () => void
}

export default function ProjectReconcile({
  projectId,
  canReconcile = true,
  onProceedToReview,
}: ProjectReconcileProps) {
  const queryClient = useQueryClient()
  const session = useReconcileSession(projectId)
  const {
    data,
    isLoading,
    subscriptionPaywallBlocked,
    reconcileLoadFailed,
    view,
    setView,
    bankAccounts,
    bankAccountId,
    setBankAccountId,
    matchParams,
    setMatchParams,
    selectedCbIds,
    setSelectedCbIds,
    toggleCb,
    selectedBankIds,
    setSelectedBankIds,
    toggleBank,
    clearSelection,
    bulkSelected,
    setBulkSelected,
    features,
    matchMutation,
    multiMatchMutation,
    bulkMatchMutation,
    unmatchMutation,
    clearAllMatchesMutation,
    evidenceUploadMutation,
    phasedAutoMatchMutation,
    forgetMemoryMutation,
    reconcileLimit,
    loadMore,
  } = session

  const matches = useMemo<MatchedPair[]>(() => (data?.matches ?? []) as MatchedPair[], [data?.matches])
  const receipts = useMemo<Tx[]>(() => data?.receipts?.transactions ?? [], [data?.receipts?.transactions])
  const credits = useMemo<Tx[]>(() => data?.credits?.transactions ?? [], [data?.credits?.transactions])
  const payments = useMemo<Tx[]>(() => data?.payments?.transactions ?? [], [data?.payments?.transactions])
  const debits = useMemo<Tx[]>(() => data?.debits?.transactions ?? [], [data?.debits?.transactions])

  const matchesForView = useMemo(() => {
    if (view === 'all') return matches
    const receiptIds = new Set(receipts.map((r) => r.id))
    const creditIds = new Set(credits.map((c) => c.id))
    const paymentIds = new Set(payments.map((p) => p.id))
    const debitIds = new Set(debits.map((d) => d.id))
    if (view === 'receipts') {
      return matches.filter((m) => receiptIds.has(m.cbTx.id) && creditIds.has(m.bankTx.id))
    }
    return matches.filter((m) => paymentIds.has(m.cbTx.id) && debitIds.has(m.bankTx.id))
  }, [view, matches, receipts, credits, payments, debits])

  if (subscriptionPaywallBlocked) {
    return (
      <div className="py-8">
        <SubscriptionRenewalPanel />
      </div>
    )
  }

  if (reconcileLoadFailed) {
    const err = session.reconcileError
    const detail =
      err instanceof Error && err.message.trim()
        ? err.message
        : 'Check your connection and try again.'
    return (
      <Alert
        tone="error"
        title="Could not load reconciliation data"
        onRetry={() => queryClient.invalidateQueries({ queryKey: ['reconcile', projectId] })}
      >
        <p>{detail}</p>
        <p className="mt-2 text-xs opacity-90">
          If you just finished mapping, wait a few seconds for imports to settle, then retry. Large PDF/Excel
          files can take longer on first open of Reconcile.
        </p>
      </Alert>
    )
  }

  if (isLoading || !data) {
    return <WorkflowStepSkeleton bodyRows={4} />
  }

  const currency = (data.project as { currency?: string })?.currency || 'GHS'
  const anyTruncated =
    data.receipts?.truncated ||
    data.credits?.truncated ||
    data.payments?.truncated ||
    data.debits?.truncated

  const matchedCbIds = new Set<string>(data.matchedCashBookIds ?? data.matchedReceiptIds ?? [])
  const matchedBankIds = new Set<string>(data.matchedBankIds ?? data.matchedCreditIds ?? [])
  const flaggedBankIds = new Set<string>(data.flaggedBankIds ?? [])

  const receiptSugs = (data.suggestions?.receipts ?? []) as SuggestedMatch[]
  const paymentSugs = (data.suggestions?.payments ?? []) as SuggestedMatch[]
  const suggestions: SuggestedMatch[] =
    view === 'all'
      ? [...receiptSugs, ...paymentSugs]
      : view === 'receipts'
        ? receiptSugs
        : paymentSugs

  const splitSuggestions: SuggestedSplitMatch[] =
    view === 'all'
      ? [
          ...((data.suggestions?.split?.receipts ?? []) as SuggestedSplitMatch[]),
          ...((data.suggestions?.split?.payments ?? []) as SuggestedSplitMatch[]),
        ]
      : view === 'receipts'
        ? ((data.suggestions?.split?.receipts ?? []) as SuggestedSplitMatch[])
        : ((data.suggestions?.split?.payments ?? []) as SuggestedSplitMatch[])

  // Decide which match mutation fires for the current selection.
  const cbArr = Array.from(selectedCbIds)
  const bankArr = Array.from(selectedBankIds)
  const canMatchInView = view !== 'all'
  const hasMultiMatch = !!features.one_to_many && !!features.many_to_many
  const canMatch1to1 = canMatchInView && cbArr.length === 1 && bankArr.length === 1
  const canMatch1toMany = canMatchInView && hasMultiMatch && cbArr.length === 1 && bankArr.length >= 2
  const canMatchManyTo1 = canMatchInView && hasMultiMatch && cbArr.length >= 2 && bankArr.length === 1
  const canMatchManyToMany =
    canMatchInView && hasMultiMatch && cbArr.length >= 2 && bankArr.length >= 2
  const canMatch = canMatch1to1 || canMatch1toMany || canMatchManyTo1 || canMatchManyToMany

  const handleConfirmMatch = () => {
    if (canMatch1to1) {
      matchMutation.mutate({
        cashBookTransactionId: cbArr[0]!,
        bankTransactionId: bankArr[0]!,
      })
    } else if (canMatch1toMany) {
      multiMatchMutation.mutate({
        cashBookTransactionId: cbArr[0]!,
        bankTransactionIds: bankArr,
      })
    } else if (canMatchManyTo1) {
      multiMatchMutation.mutate({
        cashBookTransactionIds: cbArr,
        bankTransactionId: bankArr[0]!,
      })
    } else if (canMatchManyToMany) {
      multiMatchMutation.mutate({
        cashBookTransactionIds: cbArr,
        bankTransactionIds: bankArr,
      })
    }
  }

  const ghanaTip =
    canReconcile && data.reconcileProfile?.ghanaBrs
      ? ghanaBankProfileTip(data.reconcileProfile?.bankFormat)
      : null
  const ghanaWindowDays = data.reconcileProfile?.clearingDateWindowDays
  const hasWarnings =
    anyTruncated ||
    (receipts.length === 0 && (view === 'receipts' || view === 'all')) ||
    (payments.length === 0 && (view === 'payments' || view === 'all')) ||
    !!data.sideInversion?.inverted ||
    (data.duplicateChequeWarnings?.length ?? 0) > 0 ||
    !!ghanaTip

  return (
    <div className="space-y-6">
      <WorkflowStepIntro
        eyebrow="Match"
        title="Reconcile transactions"
        subtitle="Match cash book receipts and payments to bank credits and debits. Confirm suggestions, or select rows and match yourself."
      />

      <BrsHelp variant="reconcile" />

      <div className="sticky top-0 z-20 -mx-1 border-b border-border-muted bg-surface/95 px-1 py-3 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-gray-700">
            <span className="tabular-nums text-primary-600">{data.existingMatches ?? 0}</span> matches
            confirmed
            {view === 'all'
              ? '. Switch to Receipts or Payments to match.'
              : canReconcile
                ? '. Select a cash book row and a bank row, then confirm.'
                : '. View-only.'}
          </p>
          <ReconcileToolbar
            view={view}
            onViewChange={setView}
            bankAccounts={bankAccounts}
            bankAccountId={bankAccountId}
            onBankAccountChange={setBankAccountId}
          />
        </div>
      </div>

      {hasWarnings && (
        <ReconcileNotices>
          {anyTruncated && (
            <div className="flex items-center justify-between gap-4">
              <p>
                Showing the first {Math.min(reconcileLimit, RECONCILE_CLIENT_LIMIT) / 4} transactions per
                category. Some rows are hidden.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadMore}
                className="shrink-0"
              >
                Load more
              </Button>
            </div>
          )}
          {receipts.length === 0 && (view === 'receipts' || view === 'all') && (
            <p>
              No cash book receipts found. Upload the cash book with both receipts and payments, then map
              the amount-received column.
            </p>
          )}
          {payments.length === 0 && (view === 'payments' || view === 'all') && (
            <p>
              No cash book payments found. Upload the cash book with both receipts and payments, then map
              the amount-paid column.
            </p>
          )}
          {canReconcile && ghanaTip && (
            <p>
              <strong>{ghanaTip.title}</strong>
              {data.reconcileProfile?.bankFormat === 'ecobank' && ghanaWindowDays
                ? ` — clearing matches use a ${ghanaWindowDays}-day date window. `
                : ' — '}
              {ghanaTip.body}
            </p>
          )}
          {data.sideInversion?.inverted && canReconcile && (
            <p>
              <strong>Cash-book sides look swapped</strong> — this export appears to flip receipts with
              bank debits and payments with bank credits. Suggestions are paired on the crossed sides
              automatically. {data.sideInversion.reason}
            </p>
          )}
          {(data.duplicateChequeWarnings?.length ?? 0) > 0 && canReconcile && (
            <p>
              <strong>Duplicate cheque numbers in cash book:</strong>{' '}
              {data.duplicateChequeWarnings!.map((w) => `${w.chqNo} (×${w.count})`).join(', ')}. Match
              each row carefully — bulk match skips ambiguous pairs.
            </p>
          )}
        </ReconcileNotices>
      )}

      {canReconcile && (
        <details className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 max-w-2xl">
          <summary className="cursor-pointer font-semibold text-slate-800">Matching tips</summary>
          <p className="mt-2 leading-relaxed">
            For cheques, match only when the amount (and reference if present) matches the bank. Prefer
            bank-pattern suggestions (Clearing, INW CLG, cheque paid, telex, EBOX/FT) before generic
            amount pairs. Each project is one currency — matching does not convert FX.
          </p>
        </details>
      )}

      {canReconcile && (
        <CountMatchPanel
          projectId={projectId}
          projectName={(data.project as { name?: string } | undefined)?.name}
          projectSlug={
            ((data.project as { name?: string } | undefined)?.name || 'project')
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '') || 'project'
          }
          currency={currency}
          bankAccountId={bankAccountId || undefined}
          onSelectAmountRows={(cbIds, bankIds) => {
            setSelectedCbIds(new Set(cbIds))
            setSelectedBankIds(new Set(bankIds))
          }}
        />
      )}

      {suggestions.length > 0 && canReconcile && (
        <SuggestedMatchesPanel
          suggestions={suggestions}
          currency={currency}
          features={features}
          matchParams={matchParams}
          onMatchParamsChange={setMatchParams}
          selectedCbIds={selectedCbIds}
          selectedBankIds={selectedBankIds}
          onSelectPair={(cbId, bankId) => {
            setSelectedCbIds(new Set([cbId]))
            setSelectedBankIds(new Set([bankId]))
          }}
          bulkSelected={bulkSelected}
          onBulkSelectedChange={setBulkSelected}
          onBulkMatch={(pairs) => bulkMatchMutation.mutate(pairs)}
          onPhasedAutoMatch={() => phasedAutoMatchMutation.mutate()}
          isPhasedAutoMatching={phasedAutoMatchMutation.isPending}
          isMatching={bulkMatchMutation.isPending}
          onForgetMemory={(id) => forgetMemoryMutation.mutate(id)}
          isForgettingMemory={forgetMemoryMutation.isPending}
        />
      )}

      {splitSuggestions.length > 0 && canReconcile && (
        <SplitSuggestionsPanel
          suggestions={splitSuggestions}
          currency={currency}
          features={features}
          selectedCbIds={selectedCbIds}
          selectedBankIds={selectedBankIds}
          onSelectGroup={(cbIds, bankIds) => {
            setSelectedCbIds(new Set(cbIds))
            setSelectedBankIds(new Set(bankIds))
          }}
          onForgetMemory={(id) => forgetMemoryMutation.mutate(id)}
          isForgettingMemory={forgetMemoryMutation.isPending}
        />
      )}

      {matchesForView.length > 0 && (
        <ConfirmedMatchesPanel
          matches={matchesForView}
          currency={currency}
          canReconcile={canReconcile}
          onUnmatch={(matchId) => unmatchMutation.mutate(matchId)}
          isUnmatching={unmatchMutation.isPending}
          onClearAll={() => clearAllMatchesMutation.mutate()}
          isClearingAll={clearAllMatchesMutation.isPending}
          onUploadEvidence={(matchId, file) => evidenceUploadMutation.mutate({ file, matchId })}
          isUploading={evidenceUploadMutation.isPending}
          uploadingMatchId={evidenceUploadMutation.variables?.matchId ?? null}
        />
      )}

      {canMatch && canReconcile && (
        <MatchActionBar
          cbCount={cbArr.length}
          bankCount={bankArr.length}
          isPending={matchMutation.isPending || multiMatchMutation.isPending}
          onClear={clearSelection}
          onConfirm={handleConfirmMatch}
        />
      )}

      <p className="text-sm font-medium text-gray-600">
        {view === 'all'
          ? 'Cash book (all) shows receipts and payments together. A mark next to the date means a suggested match — hover for details. Switch to Receipts or Payments to select and match.'
          : canReconcile
            ? 'Click rows to select. A mark next to the date means a suggested match — hover for details. You can match 1-to-1, 1-to-many, many-to-1, or many-to-many.'
            : 'View-only. Row selection is disabled.'}
      </p>

      <ReconcileTransactionsTables
        projectSlug={projectId}
        view={view}
        canReconcile={canReconcile}
        currency={currency}
        receipts={receipts}
        payments={payments}
        credits={credits}
        debits={debits}
        matchedCbIds={matchedCbIds}
        matchedBankIds={matchedBankIds}
        flaggedBankIds={flaggedBankIds}
        receiptSugs={receiptSugs}
        paymentSugs={paymentSugs}
        selectedCbIds={selectedCbIds}
        selectedBankIds={selectedBankIds}
        onToggleCb={toggleCb}
        onToggleBank={toggleBank}
      />

      {onProceedToReview && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-6 border-t border-gray-100 pt-8">
          <div className="max-w-md">
            <h4 className="mb-1 text-base font-bold text-gray-900">Ready to finalise?</h4>
            <p className="text-sm text-gray-500">
              Review matches and unmatched items before generating the BRS report.
            </p>
          </div>
          <Button type="button" onClick={onProceedToReview} className="bg-gray-900 hover:bg-gray-800 focus:ring-gray-700">
            Proceed to Review
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      )}
    </div>
  )
}

function ReconcileNotices({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800">
      <Button
        type="button"
        variant="ghost"
        onClick={() => setOpen((v) => !v)}
        className="w-full !justify-between px-4 py-2.5 h-auto font-semibold text-slate-800 hover:bg-slate-100/80"
        aria-expanded={open}
      >
        Notices
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </Button>
      {open && <div className="space-y-3 border-t border-slate-200 px-4 py-3">{children}</div>}
    </div>
  )
}
