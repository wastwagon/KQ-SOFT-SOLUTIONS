import { useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import BrsHelp from '../components/BrsHelp'
import ConfirmedMatchesPanel from '../components/reconcile/ConfirmedMatchesPanel'
import MatchActionBar from '../components/reconcile/MatchActionBar'
import ReconcileToolbar from '../components/reconcile/ReconcileToolbar'
import ReconcileTransactionsTables from '../components/reconcile/ReconcileTransactionsTables'
import SplitSuggestionsPanel from '../components/reconcile/SplitSuggestionsPanel'
import SuggestedMatchesPanel from '../components/reconcile/SuggestedMatchesPanel'
import { useReconcileSession } from '../components/reconcile/useReconcileSession'
import SubscriptionRenewalPanel from '../components/SubscriptionRenewalPanel'
import type { MatchedPair, SuggestedMatch, SuggestedSplitMatch, Tx } from '../components/reconcile/types'

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
    evidenceUploadMutation,
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
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 max-w-xl">
        <p className="font-medium text-red-900">Could not load reconciliation data</p>
        <p className="mt-1">Check your connection and try again.</p>
        <button
          type="button"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['reconcile', projectId] })}
          className="mt-3 px-3 py-1.5 text-sm font-medium rounded-lg bg-white border border-red-300 text-red-900 hover:bg-red-100"
        >
          Retry
        </button>
      </div>
    )
  }

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm font-medium text-gray-500">Loading reconciliation data…</p>
      </div>
    )
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

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-gray-600 max-w-2xl leading-relaxed">
          This step <strong>matches your cash book entries</strong> (receipts or payments) to{' '}
          <strong>bank statement entries</strong> (credits or debits). Use the suggested matches
          for speed, or select rows in the tables below and click Match. When you're done, proceed
          to Review to finalise.
        </p>
      </div>

      <BrsHelp variant="reconcile" />

      {anyTruncated && (
        <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-sm text-amber-800">
            Showing first {Math.min(reconcileLimit, 5000) / 4} transactions per category. Some
            transactions are hidden.
          </p>
          <button
            type="button"
            onClick={loadMore}
            className="px-4 py-2 text-sm font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors"
          >
            Load more
          </button>
        </div>
      )}

      <ReconcileToolbar
        view={view}
        onViewChange={setView}
        bankAccounts={bankAccounts}
        bankAccountId={bankAccountId}
        onBankAccountChange={setBankAccountId}
      />

      <p className="text-sm font-medium text-gray-700">
        <span className="text-primary-600">{data.existingMatches ?? 0}</span> matches confirmed.
        {view === 'all'
          ? ' Cash book (all) shows receipts and payments together. Switch to Receipts or Payments to match.'
          : canReconcile
            ? ' Select a cash book row and a bank row, then click Match.'
            : ' View-only access.'}
      </p>

      {receipts.length === 0 && (view === 'receipts' || view === 'all') && (
        <EmptyHint>
          No cash book receipts found. Upload your cash book as{' '}
          <strong>Both (receipts + payments)</strong> and map the receipts document with the{' '}
          <strong>amt_received</strong> column.
        </EmptyHint>
      )}
      {payments.length === 0 && (view === 'payments' || view === 'all') && (
        <EmptyHint>
          No cash book payments found. Upload your cash book as{' '}
          <strong>Both (receipts + payments)</strong> and map the payments document with the{' '}
          <strong>amt_paid</strong> column.
        </EmptyHint>
      )}

      {canReconcile && (
        <p className="text-xs text-slate-600 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 max-w-2xl">
          <strong>Best practice:</strong> For cheques, match only when the amount (and reference if
          present) matches the bank.
        </p>
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
          isMatching={bulkMatchMutation.isPending}
        />
      )}

      {splitSuggestions.length > 0 && canReconcile && (
        <SplitSuggestionsPanel
          suggestions={splitSuggestions}
          currency={currency}
          selectedCbIds={selectedCbIds}
          selectedBankIds={selectedBankIds}
          onSelectGroup={(cbIds, bankIds) => {
            setSelectedCbIds(new Set(cbIds))
            setSelectedBankIds(new Set(bankIds))
          }}
        />
      )}

      {matchesForView.length > 0 && (
        <ConfirmedMatchesPanel
          matches={matchesForView}
          currency={currency}
          canReconcile={canReconcile}
          onUnmatch={(matchId) => unmatchMutation.mutate(matchId)}
          isUnmatching={unmatchMutation.isPending}
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

      <p className="text-sm font-medium text-gray-600 mb-3">
        {view === 'all'
          ? 'Cash book (all) shows receipts and payments together. Rows with 🔗 have suggested matches — hover for tooltip. Switch to Receipts or Payments to select and match.'
          : canReconcile
            ? 'Click rows to select. Rows with 🔗 have suggested matches — hover for tooltip. 1-to-1, 1-to-many, many-to-1, or many-to-many (multiple cash book + multiple bank).'
            : 'View-only. Row selection is disabled.'}
      </p>

      <ReconcileTransactionsTables
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
        <div className="pt-8 mt-12 border-t border-gray-100 flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-md">
            <h4 className="text-base font-bold text-gray-900 mb-1">Ready to finalise?</h4>
            <p className="text-sm text-gray-500">
              Review your matches and verify un-reconciled items before generating your professional
              BRS report.
            </p>
          </div>
          <button
            type="button"
            onClick={onProceedToReview}
            className="px-8 py-3 bg-gray-900 text-white rounded-xl font-bold shadow-lg hover:bg-gray-800 hover:shadow-xl active:scale-[0.98] transition-all flex items-center gap-2"
          >
            Proceed to Review
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <p className="text-sm font-medium text-amber-800">{children}</p>
    </div>
  )
}
