import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../store/auth'
import { reconcile, projects, isSubscriptionInactiveError, unlessSubscriptionInactive } from '../lib/api'
import { formatAmountNumber, formatDateCompact } from '../lib/format'
import { amountColumnHeader } from '../lib/currency'
import { canSubmitForReview, canApprove } from '../lib/permissions'
import BrsHelp from '../components/BrsHelp'
import SubscriptionRenewalPanel from '../components/SubscriptionRenewalPanel'
import WorkflowStepIntro from '../components/project/WorkflowStepIntro'
import WorkflowStepSkeleton from '../components/project/WorkflowStepSkeleton'
import Button from '../components/ui/Button'
import Alert from '../components/ui/Alert'
import Card from '../components/ui/Card'
import { useToast } from '../components/ui/Toast'
import SuggestedMatchMark from '../components/reconcile/SuggestedMatchMark'

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
    return <WorkflowStepSkeleton bodyRows={3} />
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
      <Alert
        tone="error"
        title="Could not load review data"
        onRetry={() => queryClient.invalidateQueries({ queryKey: ['reconcile', projectId] })}
        action={
          onGoToReconcile ? (
            <Button type="button" size="sm" onClick={onGoToReconcile}>
              Go to Reconcile
            </Button>
          ) : undefined
        }
      >
        {error instanceof Error ? error.message : 'Something went wrong. Try again or go back to Reconcile.'}
      </Alert>
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

  return (
    <div className="space-y-6">
      <WorkflowStepIntro
        eyebrow="Review"
        title="Review & exceptions"
        subtitle="Confirm unmatched items before you generate the BRS. Submit or approve when your firm’s process allows."
      />

      <div className="sticky top-0 z-20 -mx-1 border-b border-border-muted bg-white/95 px-1 py-3 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{data.existingMatches ?? 0} matched</span>
            {' · '}
            {unmatchedReceipts.length + unmatchedPayments.length} unmatched cash book
            {' · '}
            {unmatchedCredits.length + unmatchedDebits.length} unmatched bank
            {variance !== 0 ? (
              <>
                {' · '}
                <span className="font-medium text-red-700">
                  variance {fmtAmt(Math.abs(variance))} {variance > 0 ? '(CB > Bank)' : '(Bank > CB)'}
                </span>
              </>
            ) : null}
          </p>
          <div className="flex flex-wrap gap-2">
            {hasUnmatched && onGoToReconcile && (
              <Button type="button" onClick={onGoToReconcile}>
                Go to Reconcile
              </Button>
            )}
            {canSubmitForReview(role) &&
              (projectStatus === 'reconciling' || projectStatus === 'mapping' || projectStatus === 'draft') && (
                <Button
                  type="button"
                  variant={hasUnmatched ? 'outline' : 'primary'}
                  onClick={() => submitMutation.mutate()}
                  disabled={submitMutation.isPending}
                  isLoading={submitMutation.isPending}
                  title="Submit for review (locks editing)"
                >
                  Submit for review
                </Button>
              )}
            {canApprove(role) && projectStatus === 'submitted_for_review' && (
              <Button
                type="button"
                onClick={() => approveMutation.mutate()}
                disabled={approveMutation.isPending}
                isLoading={approveMutation.isPending}
                title="Approve BRS"
              >
                Approve
              </Button>
            )}
            {onGoToReport && (
              <Button type="button" variant={hasUnmatched ? 'outline' : 'primary'} onClick={onGoToReport}>
                {hasUnmatched ? 'Proceed to Report' : 'Generate report'}
              </Button>
            )}
          </div>
        </div>
      </div>

      <BrsHelp variant="review" />

      {hasUnmatched ? (
        <Alert tone="warning" title="Unmatched items remain">
          Review the exception list below, then return to Reconcile to match them, or proceed to Report
          with exceptions noted on the BRS.
        </Alert>
      ) : (
        <Alert tone="success" title="Ready for report">
          All transactions are matched. Submit for review and approve to stamp the report as final.
        </Alert>
      )}
      {approveMutation.error && !isSubscriptionInactiveError(approveMutation.error) && (
        <Alert tone="error" title="Could not approve">
          {approveMutation.error.message}
        </Alert>
      )}

      {/* Exception list: unmatched transactions with optional Reviewed tick-off */}
      <Card
        title="Exception list"
        sublabel="Tick Reviewed after you check each unmatched row. A mark next to the date means there is a suggested match — hover for details."
      >
        <div className="flex flex-col gap-6">
          <div>
            <h4 className="text-sm font-medium text-gray-600 mb-2">Cash Book</h4>
            <div className="border border-border rounded-xl overflow-x-auto overflow-y-auto max-h-[45rem] bg-white">
              <table className="min-w-full text-xs sm:text-sm text-gray-900">
                <thead className="bg-white sticky top-0 z-10">
                  <tr>
                    <th className="px-2 py-1.5 text-left w-8" title="Mark as reviewed">✓</th>
                    <th className="px-2 py-1.5 text-left whitespace-nowrap">Date</th>
                    <th className="px-2 py-1.5 text-left">Name</th>
                    <th className="px-2 py-1.5 text-left">Description</th>
                    <th className="px-2 py-1.5 text-left whitespace-nowrap">Chq no.</th>
                    <th className="px-2 py-1.5 text-left whitespace-nowrap">Ref. Doc. No.</th>
                    <th className="px-2 py-1.5 text-right whitespace-nowrap">{amountColumnHeader(currency)}</th>
                    <th className="px-2 py-1.5 text-right whitespace-nowrap">{amountColumnHeader(currency)}</th>
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
                          className={`border-t border-border ${sug?.length ? 'bg-primary-50/30' : ''}`}
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
                            {sug?.length ? <SuggestedMatchMark title={tooltip} /> : null}
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
            <div className="border border-border rounded-xl overflow-x-auto overflow-y-auto max-h-[45rem] bg-white">
              <table className="min-w-full text-xs sm:text-sm text-gray-900">
                <thead className="bg-white sticky top-0 z-10">
                  <tr>
                    <th className="px-2 py-1.5 text-left w-8" title="Mark as reviewed">✓</th>
                    <th className="px-2 py-1.5 text-left whitespace-nowrap">Date</th>
                    <th className="px-2 py-1.5 text-left">Description</th>
                    <th className="px-2 py-1.5 text-left whitespace-nowrap">Chq no.</th>
                    <th className="px-2 py-1.5 text-left whitespace-nowrap">Ref. Doc. No.</th>
                    <th className="px-2 py-1.5 text-right whitespace-nowrap">{amountColumnHeader(currency)}</th>
                    <th className="px-2 py-1.5 text-right whitespace-nowrap">{amountColumnHeader(currency)}</th>
                    <th className="px-2 py-1.5 text-right whitespace-nowrap">{amountColumnHeader(currency)}</th>
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
                            className={`border-t border-border ${sug?.length ? 'bg-primary-50/30' : ''}`}
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
                              {sug?.length ? <SuggestedMatchMark title={tooltip} /> : null}
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
            <div className="border border-border rounded-xl overflow-x-auto overflow-y-auto max-h-[45rem] bg-white">
              <table className="min-w-full text-xs sm:text-sm text-gray-900">
                <thead className="bg-white sticky top-0 z-10">
                  <tr>
                    <th className="px-2 py-1.5 text-left w-8" title="Mark as reviewed">✓</th>
                    <th className="px-2 py-1.5 text-left whitespace-nowrap">Date</th>
                    <th className="px-2 py-1.5 text-left">Name</th>
                    <th className="px-2 py-1.5 text-left">Description</th>
                    <th className="px-2 py-1.5 text-left whitespace-nowrap">Chq no.</th>
                    <th className="px-2 py-1.5 text-left whitespace-nowrap">Ref. Doc. No.</th>
                    <th className="px-2 py-1.5 text-right whitespace-nowrap">{amountColumnHeader(currency)}</th>
                    <th className="px-2 py-1.5 text-right whitespace-nowrap">{amountColumnHeader(currency)}</th>
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
                          className={`border-t border-border ${sug?.length ? 'bg-primary-50/30' : ''}`}
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
                            {sug?.length ? <SuggestedMatchMark title={tooltip} /> : null}
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
            <div className="border border-border rounded-xl overflow-x-auto overflow-y-auto max-h-[45rem] bg-white">
              <table className="min-w-full text-xs sm:text-sm text-gray-900">
                <thead className="bg-white sticky top-0 z-10">
                  <tr>
                    <th className="px-2 py-1.5 text-left w-8" title="Mark as reviewed">✓</th>
                    <th className="px-2 py-1.5 text-left whitespace-nowrap">Date</th>
                    <th className="px-2 py-1.5 text-left">Description</th>
                    <th className="px-2 py-1.5 text-left whitespace-nowrap">Chq no.</th>
                    <th className="px-2 py-1.5 text-left whitespace-nowrap">Ref. Doc. No.</th>
                    <th className="px-2 py-1.5 text-right whitespace-nowrap">{amountColumnHeader(currency)}</th>
                    <th className="px-2 py-1.5 text-right whitespace-nowrap">{amountColumnHeader(currency)}</th>
                    <th className="px-2 py-1.5 text-right whitespace-nowrap">{amountColumnHeader(currency)}</th>
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
                            className={`border-t border-border ${sug?.length ? 'bg-primary-50/30' : ''}`}
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
                              {sug?.length ? <SuggestedMatchMark title={tooltip} /> : null}
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
      </Card>
    </div>
  )
}
