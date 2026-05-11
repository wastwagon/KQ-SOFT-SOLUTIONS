import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../store/auth'
import { reconcile, projects, isSubscriptionInactiveError, unlessSubscriptionInactive } from '../lib/api'
import { formatAmountNumber, formatDateCompact } from '../lib/format'
import { getCurrencySymbol } from '../lib/currency'
import { canSubmitForReview, canApprove } from '../lib/permissions'
import BrsHelp from '../components/BrsHelp'
import SubscriptionRenewalPanel from '../components/SubscriptionRenewalPanel'
import { useToast } from '../components/ui/Toast'

interface Tx {
  id: string
  date: string | null
  name: string | null
  details: string | null
  amount: number
  chqNo?: string | null
  docRef?: string | null
}

interface ProjectReviewProps {
  projectId: string
  onGoToReconcile?: () => void
  onGoToReport?: () => void
}

export default function ProjectReview({ projectId, onGoToReconcile, onGoToReport }: ProjectReviewProps) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const role = useAuth((s) => s.role)
  const [exceptionReviewedIds, setExceptionReviewedIds] = useState<Set<string>>(new Set())
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['reconcile', projectId],
    queryFn: () => reconcile.get(projectId),
    enabled: !!projectId,
  })

  const submitMutation = useMutation({
    mutationFn: () => projects.submit(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconcile', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: (err) =>
      unlessSubscriptionInactive(err, (e) =>
        toast.error('Submit for review failed', e instanceof Error ? e.message : undefined)
      ),
  })
  const approveMutation = useMutation({
    mutationFn: () => projects.approve(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconcile', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px] p-8">
        <p className="text-gray-600 font-medium">Loading review data…</p>
      </div>
    )
  }
  if (isError || !data) {
    if (isSubscriptionInactiveError(error)) {
      return (
        <div className="py-4">
          <SubscriptionRenewalPanel />
        </div>
      )
    }
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h2 className="text-lg font-semibold text-red-900 mb-2">Could not load review data</h2>
        <p className="text-sm text-red-800">
          {error instanceof Error ? error.message : 'Something went wrong. Try again or go back to Reconcile.'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['reconcile', projectId] })}
            className="px-4 py-2 bg-white border border-red-300 text-red-900 rounded-xl font-medium hover:bg-red-100"
          >
            Retry
          </button>
          {onGoToReconcile && (
            <button
              type="button"
              onClick={onGoToReconcile}
              className="px-4 py-2 bg-primary-600 text-white rounded-xl font-medium hover:bg-primary-700"
            >
              Go to Reconcile
            </button>
          )}
        </div>
      </div>
    )
  }

  const receipts = Array.isArray(data.receipts?.transactions) ? data.receipts.transactions : []
  const credits = Array.isArray(data.credits?.transactions) ? data.credits.transactions : []
  const payments = Array.isArray(data.payments?.transactions) ? data.payments.transactions : []
  const debits = Array.isArray(data.debits?.transactions) ? data.debits.transactions : []

  const matchedCbIds = new Set(data.matchedCashBookIds || data.matchedReceiptIds || [])
  const matchedBankIds = new Set(data.matchedBankIds || data.matchedCreditIds || [])

  const unmatchedReceipts = receipts.filter((t: Tx) => t?.id != null && !matchedCbIds.has(t.id))
  const unmatchedCredits = credits.filter((t: Tx) => t?.id != null && !matchedBankIds.has(t.id))
  const unmatchedPayments = payments.filter((t: Tx) => t?.id != null && !matchedCbIds.has(t.id))
  const unmatchedDebits = debits.filter((t: Tx) => t?.id != null && !matchedBankIds.has(t.id))

  // Build suggestion map for matching clues (cbId/bankId -> suggested matches)
  const receiptSugs = (data.suggestions?.receipts || []) as { cashBookTx: Tx; bankTx: Tx; confidence: number; reason: string }[]
  const paymentSugs = (data.suggestions?.payments || []) as { cashBookTx: Tx; bankTx: Tx; confidence: number; reason: string }[]
  const cbReceiptToBank = new Map<string, { bank: Tx; confidence: number; reason: string }[]>()
  const bankCreditToCb = new Map<string, { cb: Tx; confidence: number; reason: string }[]>()
  const cbPaymentToBank = new Map<string, { bank: Tx; confidence: number; reason: string }[]>()
  const bankDebitToCb = new Map<string, { cb: Tx; confidence: number; reason: string }[]>()
  for (const s of receiptSugs) {
    if (!cbReceiptToBank.has(s.cashBookTx.id)) cbReceiptToBank.set(s.cashBookTx.id, [])
    cbReceiptToBank.get(s.cashBookTx.id)!.push({ bank: s.bankTx, confidence: s.confidence, reason: s.reason })
    if (!bankCreditToCb.has(s.bankTx.id)) bankCreditToCb.set(s.bankTx.id, [])
    bankCreditToCb.get(s.bankTx.id)!.push({ cb: s.cashBookTx, confidence: s.confidence, reason: s.reason })
  }
  for (const s of paymentSugs) {
    if (!cbPaymentToBank.has(s.cashBookTx.id)) cbPaymentToBank.set(s.cashBookTx.id, [])
    cbPaymentToBank.get(s.cashBookTx.id)!.push({ bank: s.bankTx, confidence: s.confidence, reason: s.reason })
    if (!bankDebitToCb.has(s.bankTx.id)) bankDebitToCb.set(s.bankTx.id, [])
    bankDebitToCb.get(s.bankTx.id)!.push({ cb: s.cashBookTx, confidence: s.confidence, reason: s.reason })
  }
  const formatMatchTooltip = (label: string, t: Tx, conf: number, reason: string) =>
    `${label}: ${formatDateCompact(t.date)} • ${(t.name || t.details || '—').slice(0, 40)} • ${fmtAmt(t.amount)} (${Math.round(conf * 100)}%: ${reason})`

  const safeAmount = (t: Tx) => (typeof t?.amount === 'number' && !Number.isNaN(t.amount) ? t.amount : 0)
  const totalUnmatchedReceipts = unmatchedReceipts.reduce((s: number, t: Tx) => s + safeAmount(t), 0)
  const totalUnmatchedCredits = unmatchedCredits.reduce((s: number, t: Tx) => s + safeAmount(t), 0)
  const totalUnmatchedPayments = unmatchedPayments.reduce((s: number, t: Tx) => s + safeAmount(t), 0)
  const totalUnmatchedDebits = unmatchedDebits.reduce((s: number, t: Tx) => s + safeAmount(t), 0)

  const hasUnmatched =
    unmatchedReceipts.length > 0 ||
    unmatchedCredits.length > 0 ||
    unmatchedPayments.length > 0 ||
    unmatchedDebits.length > 0

  const totalUnmatchedCb = totalUnmatchedReceipts + totalUnmatchedPayments
  const totalUnmatchedBank = totalUnmatchedCredits + totalUnmatchedDebits
  const variance = totalUnmatchedCb - totalUnmatchedBank

  const projectStatus = (data?.project as { status?: string })?.status ?? ''

  const currency = (data?.project as { currency?: string })?.currency || 'GHS'
  const fmtAmt = (n: number) => formatAmountNumber(Number.isFinite(n) ? n : 0)
  const sym = getCurrencySymbol(currency)

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Review & exceptions</h2>

      <BrsHelp variant="full" />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-700 font-medium">Matched</p>
          <p className="text-xl font-bold text-green-800">{data.existingMatches ?? 0}</p>
          <p className="text-xs text-green-700 mt-1">
            Receipts/Credits: {data.summary?.matchedReceiptsCreditsCount ?? 0} · Payments/Debits: {data.summary?.matchedPaymentsDebitsCount ?? 0}
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-700 font-medium">Unmatched cash book</p>
          <p className="text-xl font-bold text-amber-800">
            {unmatchedReceipts.length + unmatchedPayments.length}
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-700 font-medium">Unmatched bank</p>
          <p className="text-xl font-bold text-amber-800">
            {unmatchedCredits.length + unmatchedDebits.length}
          </p>
        </div>
        <div
          className="bg-gray-50 border border-gray-200 rounded-lg p-4 cursor-help"
          title="Difference between total unmatched cash book amounts and total unmatched bank amounts (reconciliation discrepancy indicator)"
        >
          <p className="text-sm text-gray-700 font-medium">Variance</p>
          <p className={`text-xl font-bold ${variance !== 0 ? 'text-red-600' : 'text-gray-800'}`}>
            {fmtAmt(Math.abs(variance))} {variance !== 0 ? (variance > 0 ? '(CB > Bank)' : '(Bank > CB)') : ''}
          </p>
        </div>
      </div>

      {/* Recommendations */}
      <div
        className={`rounded-lg p-4 border ${
          hasUnmatched ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'
        }`}
      >
        <h3 className="font-medium mb-2 text-gray-900">
          {hasUnmatched ? 'Recommendations' : 'Ready for report'}
        </h3>
        {hasUnmatched ? (
          <>
            <p className="text-sm mb-3 text-gray-700">
              There are unmatched transactions. Review the exception list below, then return to Reconcile to match them or proceed to Report to generate the BRS with exceptions noted.
            </p>
            <div className="flex flex-wrap gap-2">
              {onGoToReconcile && (
                <button
                  onClick={onGoToReconcile}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Go to Reconcile
                </button>
              )}
              {onGoToReport && (
                <button
                  onClick={onGoToReport}
                  className="px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-lg hover:bg-gray-50"
                >
                  Proceed to Report (with exceptions)
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-sm mb-3 text-gray-700">All transactions are matched. You can submit for review, approve, or generate the BRS report.</p>
            <p className="text-xs text-slate-600 mb-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 max-w-2xl">
              <strong>Draft vs final:</strong> What you see now is the draft report. After <strong>Submit for review</strong> and <strong>Approve</strong>, the report is final and date/time stamped.
            </p>
            <div className="flex flex-wrap gap-2">
              {canSubmitForReview(role) && (projectStatus === 'reconciling' || projectStatus === 'mapping' || projectStatus === 'draft') && (
                <button
                  onClick={() => submitMutation.mutate()}
                  disabled={submitMutation.isPending}
                  className="px-4 py-2 border border-blue-300 text-blue-800 rounded-lg hover:bg-blue-50 disabled:opacity-50"
                  title="Submit for review (locks editing)"
                >
                  {submitMutation.isPending ? 'Submitting...' : 'Submit for review'}
                </button>
              )}
              {canApprove(role) && projectStatus === 'submitted_for_review' && (
                <>
                  <button
                    onClick={() => approveMutation.mutate()}
                    disabled={approveMutation.isPending}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    title="Approve BRS"
                  >
                    {approveMutation.isPending ? 'Approving...' : 'Approve'}
                  </button>
                  {approveMutation.error && !isSubscriptionInactiveError(approveMutation.error) && (
                    <p className="text-sm text-red-600">{approveMutation.error.message}</p>
                  )}
                </>
              )}
              {onGoToReport && (
                <button
                  onClick={onGoToReport}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Generate report
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Exception list: unmatched transactions with optional Reviewed tick-off */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-medium text-gray-900">Exception list (unmatched transactions)</h3>
          <span className="text-xs text-gray-500">Tick “Reviewed” when each exception has been checked (for your reference before Submit for review).</span>
        </div>
        <p className="text-xs text-primary-600 font-medium">Rows with 🔗 have suggested matches — hover for tooltip.</p>
        <div className="flex flex-col gap-6">
          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-2">Cash Book</h4>
            <div className="border border-gray-200 rounded-lg overflow-x-auto overflow-y-auto max-h-[45rem] bg-white">
              <table className="min-w-full text-xs sm:text-sm text-gray-900">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left w-8" title="Mark as reviewed">✓</th>
                    <th className="px-2 py-1.5 text-left whitespace-nowrap">Date</th>
                    <th className="px-2 py-1.5 text-left">Name</th>
                    <th className="px-2 py-1.5 text-left">Description</th>
                    <th className="px-2 py-1.5 text-left whitespace-nowrap">Chq no.</th>
                    <th className="px-2 py-1.5 text-left whitespace-nowrap">Ref. Doc. No.</th>
                    <th className="px-2 py-1.5 text-right whitespace-nowrap">Amount Received ({sym})</th>
                    <th className="px-2 py-1.5 text-right whitespace-nowrap">Amount Paid ({sym})</th>
                  </tr>
                </thead>
                <tbody>
                  {unmatchedReceipts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-2 py-4 text-center text-gray-500">
                        None
                      </td>
                    </tr>
                  ) : (
                    unmatchedReceipts.map((t: Tx) => {
                      const sug = cbReceiptToBank.get(t.id)
                      const tooltip = sug?.length
                        ? sug.map((s) => formatMatchTooltip('Suggested bank match', s.bank, s.confidence, s.reason)).join('\n\n')
                        : undefined
                      return (
                        <tr
                          key={t.id}
                          className={`border-t border-gray-200 ${sug?.length ? 'bg-primary-50/30' : ''}`}
                          title={tooltip}
                        >
                          <td className="px-2 py-1.5">
                            <input
                              type="checkbox"
                              checked={exceptionReviewedIds.has(t.id)}
                              onChange={() => setExceptionReviewedIds((prev) => { const next = new Set(prev); if (next.has(t.id)) next.delete(t.id); else next.add(t.id); return next })}
                              title="Mark as reviewed"
                              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            {formatDateCompact(t.date)}
                            {sug?.length ? <span className="ml-1 text-primary-600" title={tooltip}>🔗</span> : null}
                          </td>
                          <td className="px-2 py-1.5 truncate max-w-[90px]" title={t.name || ''}>{t.name || '—'}</td>
                          <td className="px-2 py-1.5 truncate max-w-[90px]" title={t.details || ''}>{t.details || '—'}</td>
                          <td className="px-2 py-1.5 font-mono text-xs whitespace-nowrap">{t.chqNo || '—'}</td>
                          <td className="px-2 py-1.5 font-mono text-xs whitespace-nowrap">{t.docRef || '—'}</td>
                          <td className="px-2 py-1.5 text-right font-medium whitespace-nowrap">{fmtAmt(t.amount)}</td>
                          <td className="px-2 py-1.5 text-right whitespace-nowrap">—</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-2">Bank Statement</h4>
            <div className="border border-gray-200 rounded-lg overflow-x-auto overflow-y-auto max-h-[45rem] bg-white">
              <table className="min-w-full text-xs sm:text-sm text-gray-900">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left w-8" title="Mark as reviewed">✓</th>
                    <th className="px-2 py-1.5 text-left whitespace-nowrap">Date</th>
                    <th className="px-2 py-1.5 text-left">Description</th>
                    <th className="px-2 py-1.5 text-left whitespace-nowrap">Chq no.</th>
                    <th className="px-2 py-1.5 text-left whitespace-nowrap">Ref. Doc. No.</th>
                    <th className="px-2 py-1.5 text-right whitespace-nowrap">Debit ({sym})</th>
                    <th className="px-2 py-1.5 text-right whitespace-nowrap">Credit ({sym})</th>
                    <th className="px-2 py-1.5 text-right whitespace-nowrap">Balance ({sym})</th>
                  </tr>
                </thead>
                <tbody>
                  {unmatchedCredits.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-2 py-4 text-center text-gray-500">
                        None
                      </td>
                    </tr>
                  ) : (
                    (() => {
                      let bal = 0
                      return unmatchedCredits.map((t: Tx) => {
                        bal += Number(t.amount)
                        const sug = bankCreditToCb.get(t.id)
                        const tooltip = sug?.length
                          ? sug.map((s) => formatMatchTooltip('Suggested cash book match', s.cb, s.confidence, s.reason)).join('\n\n')
                          : undefined
                        return (
                          <tr
                            key={t.id}
                            className={`border-t border-gray-200 ${sug?.length ? 'bg-primary-50/30' : ''}`}
                            title={tooltip}
                          >
                            <td className="px-2 py-1.5">
                              <input
                                type="checkbox"
                                checked={exceptionReviewedIds.has(t.id)}
                                onChange={() => setExceptionReviewedIds((prev) => { const next = new Set(prev); if (next.has(t.id)) next.delete(t.id); else next.add(t.id); return next })}
                                title="Mark as reviewed"
                                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                              />
                            </td>
                            <td className="px-2 py-1.5 whitespace-nowrap">
                              {formatDateCompact(t.date)}
                              {sug?.length ? <span className="ml-1 text-primary-600" title={tooltip}>🔗</span> : null}
                            </td>
                            <td className="px-2 py-1.5 truncate max-w-[100px]" title={t.details || ''}>{t.name || t.details || '—'}</td>
                            <td className="px-2 py-1.5 font-mono text-xs whitespace-nowrap">{t.chqNo || '—'}</td>
                            <td className="px-2 py-1.5 font-mono text-xs whitespace-nowrap">{t.docRef || '—'}</td>
                            <td className="px-2 py-1.5 text-right whitespace-nowrap">—</td>
                            <td className="px-2 py-1.5 text-right font-medium whitespace-nowrap">{fmtAmt(t.amount)}</td>
                            <td className="px-2 py-1.5 text-right text-gray-600 whitespace-nowrap">{fmtAmt(bal)}</td>
                          </tr>
                        )
                      })
                    })()
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-2">Cash Book</h4>
            <div className="border border-gray-200 rounded-lg overflow-x-auto overflow-y-auto max-h-[45rem] bg-white">
              <table className="min-w-full text-xs sm:text-sm text-gray-900">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left w-8" title="Mark as reviewed">✓</th>
                    <th className="px-2 py-1.5 text-left whitespace-nowrap">Date</th>
                    <th className="px-2 py-1.5 text-left">Name</th>
                    <th className="px-2 py-1.5 text-left">Description</th>
                    <th className="px-2 py-1.5 text-left whitespace-nowrap">Chq no.</th>
                    <th className="px-2 py-1.5 text-left whitespace-nowrap">Ref. Doc. No.</th>
                    <th className="px-2 py-1.5 text-right whitespace-nowrap">Amount Received ({sym})</th>
                    <th className="px-2 py-1.5 text-right whitespace-nowrap">Amount Paid ({sym})</th>
                  </tr>
                </thead>
                <tbody>
                  {unmatchedPayments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-2 py-4 text-center text-gray-500">
                        None
                      </td>
                    </tr>
                  ) : (
                    unmatchedPayments.map((t: Tx) => {
                      const sug = cbPaymentToBank.get(t.id)
                      const tooltip = sug?.length
                        ? sug.map((s) => formatMatchTooltip('Suggested bank match', s.bank, s.confidence, s.reason)).join('\n\n')
                        : undefined
                      return (
                        <tr
                          key={t.id}
                          className={`border-t border-gray-200 ${sug?.length ? 'bg-primary-50/30' : ''}`}
                          title={tooltip}
                        >
                          <td className="px-2 py-1.5">
                            <input
                              type="checkbox"
                              checked={exceptionReviewedIds.has(t.id)}
                              onChange={() => setExceptionReviewedIds((prev) => { const next = new Set(prev); if (next.has(t.id)) next.delete(t.id); else next.add(t.id); return next })}
                              title="Mark as reviewed"
                              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                          </td>
                          <td className="px-2 py-1.5 whitespace-nowrap">
                            {formatDateCompact(t.date)}
                            {sug?.length ? <span className="ml-1 text-primary-600" title={tooltip}>🔗</span> : null}
                          </td>
                          <td className="px-2 py-1.5 truncate max-w-[90px]" title={t.name || ''}>{t.name || '—'}</td>
                          <td className="px-2 py-1.5 truncate max-w-[90px]" title={t.details || ''}>{t.details || '—'}</td>
                          <td className="px-2 py-1.5 font-mono text-xs whitespace-nowrap">{t.chqNo || '—'}</td>
                          <td className="px-2 py-1.5 font-mono text-xs whitespace-nowrap">{t.docRef || '—'}</td>
                          <td className="px-2 py-1.5 text-right whitespace-nowrap">—</td>
                          <td className="px-2 py-1.5 text-right font-medium whitespace-nowrap">{fmtAmt(t.amount)}</td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-2">Bank Statement</h4>
            <div className="border border-gray-200 rounded-lg overflow-x-auto overflow-y-auto max-h-[45rem] bg-white">
              <table className="min-w-full text-xs sm:text-sm text-gray-900">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left w-8" title="Mark as reviewed">✓</th>
                    <th className="px-2 py-1.5 text-left whitespace-nowrap">Date</th>
                    <th className="px-2 py-1.5 text-left">Description</th>
                    <th className="px-2 py-1.5 text-left whitespace-nowrap">Chq no.</th>
                    <th className="px-2 py-1.5 text-left whitespace-nowrap">Ref. Doc. No.</th>
                    <th className="px-2 py-1.5 text-right whitespace-nowrap">Debit ({sym})</th>
                    <th className="px-2 py-1.5 text-right whitespace-nowrap">Credit ({sym})</th>
                    <th className="px-2 py-1.5 text-right whitespace-nowrap">Balance ({sym})</th>
                  </tr>
                </thead>
                <tbody>
                  {unmatchedDebits.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-2 py-4 text-center text-gray-500">
                        None
                      </td>
                    </tr>
                  ) : (
                    (() => {
                      let bal = 0
                      return unmatchedDebits.map((t: Tx) => {
                        bal -= Number(t.amount)
                        const sug = bankDebitToCb.get(t.id)
                        const tooltip = sug?.length
                          ? sug.map((s) => formatMatchTooltip('Suggested cash book match', s.cb, s.confidence, s.reason)).join('\n\n')
                          : undefined
                        return (
                          <tr
                            key={t.id}
                            className={`border-t border-gray-200 ${sug?.length ? 'bg-primary-50/30' : ''}`}
                            title={tooltip}
                          >
                            <td className="px-2 py-1.5">
                              <input
                                type="checkbox"
                                checked={exceptionReviewedIds.has(t.id)}
                                onChange={() => setExceptionReviewedIds((prev) => { const next = new Set(prev); if (next.has(t.id)) next.delete(t.id); else next.add(t.id); return next })}
                                title="Mark as reviewed"
                                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                              />
                            </td>
                            <td className="px-2 py-1.5 whitespace-nowrap">
                              {formatDateCompact(t.date)}
                              {sug?.length ? <span className="ml-1 text-primary-600" title={tooltip}>🔗</span> : null}
                            </td>
                            <td className="px-2 py-1.5 truncate max-w-[100px]" title={t.details || ''}>{t.name || t.details || '—'}</td>
                            <td className="px-2 py-1.5 font-mono text-xs whitespace-nowrap">{t.chqNo || '—'}</td>
                            <td className="px-2 py-1.5 font-mono text-xs whitespace-nowrap">{t.docRef || '—'}</td>
                            <td className="px-2 py-1.5 text-right font-medium whitespace-nowrap">{fmtAmt(t.amount)}</td>
                            <td className="px-2 py-1.5 text-right whitespace-nowrap">—</td>
                            <td className="px-2 py-1.5 text-right text-gray-600 whitespace-nowrap">{fmtAmt(bal)}</td>
                          </tr>
                        )
                      })
                    })()
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
