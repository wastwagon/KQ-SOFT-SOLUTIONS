import { useState, useEffect, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reconcile, subscription, attachments } from '../lib/api'
import { formatAmount, formatAmountNumber, formatDateCompact } from '../lib/format'
import { getCurrencySymbol } from '../lib/currency'
import { Settings, Link as LinkIcon, ArrowRight } from 'lucide-react'
import BrsHelp from '../components/BrsHelp'

interface Tx {
  id: string
  date: string | null
  name: string | null
  details: string | null
  amount: number
  chqNo?: string | null
  docRef?: string | null
}

interface SuggestedMatch {
  cashBookTx: Tx
  bankTx: Tx
  confidence: number
  reason: string
  duplicateWarning?: boolean
}

interface SuggestedSplitMatch {
  cashBookTxs: Tx[]
  bankTxs: Tx[]
  confidence: number
  reason: string
}

interface AttachmentInfo {
  id: string
  filename: string
  mimeType?: string | null
  size?: number | null
}

interface MatchedPair {
  matchId: string
  cbTx: Tx
  bankTx: Tx
  attachments?: AttachmentInfo[]
}

type ProjectReconcileProps = { projectId: string; canReconcile?: boolean; onProceedToReview?: () => void }
export default function ProjectReconcile({ projectId, canReconcile = true, onProceedToReview }: ProjectReconcileProps) {
  const queryClient = useQueryClient()
  const [view, setView] = useState<'receipts' | 'payments' | 'all'>('all')
  const [selectedCbIds, setSelectedCbIds] = useState<Set<string>>(new Set())
  const [selectedBankIds, setSelectedBankIds] = useState<Set<string>>(new Set())
  const [bulkSelected, setBulkSelected] = useState<Set<number>>(new Set())
  const [bankAccountId, setBankAccountId] = useState<string>('')
  const [actionMessage, setActionMessage] = useState('')
  const [matchParams, setMatchParams] = useState({
    useDate: true,
    useDocRef: true,
    useChequeNo: true,
  })
  const [showSettings, setShowSettings] = useState(false)
  const bankAccountRestoredRef = useRef(false)
  const matchParamsRestoredRef = useRef(false)

  const { data: usageData } = useQuery({
    queryKey: ['subscription', 'usage'],
    queryFn: subscription.getUsage,
  })
  const features = (usageData?.features || {}) as Record<string, boolean>
  const [reconcileLimit, setReconcileLimit] = useState(1500)
  const { data, isLoading } = useQuery({
    queryKey: [
      'reconcile',
      projectId,
      bankAccountId || null,
      reconcileLimit,
      matchParams.useDate,
      matchParams.useDocRef,
      matchParams.useChequeNo,
    ],
    queryFn: () =>
      reconcile.get(projectId, {
        bankAccountId: bankAccountId || undefined,
        limit: reconcileLimit,
        useDate: matchParams.useDate,
        useDocRef: matchParams.useDocRef,
        useChequeNo: matchParams.useChequeNo,
      }),
    enabled: !!projectId,
  })

  const bankAccounts = useMemo(
    () => (data?.bankAccounts || []) as { id: string; name: string }[],
    [data?.bankAccounts]
  )
  useEffect(() => {
    if (bankAccountRestoredRef.current || !projectId || bankAccounts.length === 0) return
    try {
      const saved = localStorage.getItem(`brs_last_bank_account_${projectId}`)
      if (saved && bankAccounts.some((a) => a.id === saved)) {
        setBankAccountId(saved)
        bankAccountRestoredRef.current = true
      }
    } catch {
      /* localStorage may be unavailable */
    }
  }, [projectId, bankAccounts])
  useEffect(() => {
    if (bankAccountId && projectId) {
      try {
        localStorage.setItem(`brs_last_bank_account_${projectId}`, bankAccountId)
      } catch {
        /* localStorage may be unavailable */
      }
    }
  }, [projectId, bankAccountId])
  useEffect(() => {
    if (matchParamsRestoredRef.current || !projectId) return
    try {
      const saved = localStorage.getItem(`brs_match_params_${projectId}`)
      if (!saved) {
        matchParamsRestoredRef.current = true
        return
      }
      const parsed = JSON.parse(saved) as Partial<{ useDate: boolean; useDocRef: boolean; useChequeNo: boolean }>
      setMatchParams({
        useDate: typeof parsed.useDate === 'boolean' ? parsed.useDate : true,
        useDocRef: typeof parsed.useDocRef === 'boolean' ? parsed.useDocRef : true,
        useChequeNo: typeof parsed.useChequeNo === 'boolean' ? parsed.useChequeNo : true,
      })
    } catch {
      /* localStorage may be unavailable */
    } finally {
      matchParamsRestoredRef.current = true
    }
  }, [projectId])
  useEffect(() => {
    if (!projectId || !matchParamsRestoredRef.current) return
    try {
      localStorage.setItem(`brs_match_params_${projectId}`, JSON.stringify(matchParams))
    } catch {
      /* localStorage may be unavailable */
    }
  }, [projectId, matchParams])

  const matchMutation = useMutation({
    mutationFn: (body: { cashBookTransactionId: string; bankTransactionId: string }) =>
      reconcile.createMatch(projectId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconcile', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setSelectedCbIds(new Set())
      setSelectedBankIds(new Set())
      setActionMessage('Match saved successfully.')
    },
  })

  const multiMatchMutation = useMutation({
    mutationFn: (
      body:
        | { cashBookTransactionId: string; bankTransactionIds: string[] }
        | { cashBookTransactionIds: string[]; bankTransactionId: string }
        | { cashBookTransactionIds: string[]; bankTransactionIds: string[] }
    ) => reconcile.createMatchMulti(projectId, body),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reconcile', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setSelectedCbIds(new Set())
      setSelectedBankIds(new Set())
      const count =
        'cashBookTransactionIds' in variables && 'bankTransactionIds' in variables
          ? variables.cashBookTransactionIds.length + variables.bankTransactionIds.length
          : 'bankTransactionIds' in variables
            ? variables.bankTransactionIds.length
            : variables.cashBookTransactionIds.length
      setActionMessage(`Matched ${count} transaction(s).`)
    },
  })

  const unmatchMutation = useMutation({
    mutationFn: (matchId: string) => reconcile.deleteMatch(projectId, matchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconcile', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setActionMessage('Match removed successfully.')
    },
  })

  const evidenceUploadMutation = useMutation({
    mutationFn: ({ file, matchId }: { file: File; matchId: string }) =>
      attachments.upload(projectId, file, 'match_evidence', matchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconcile', projectId] })
      setActionMessage('Evidence uploaded successfully.')
    },
    onError: (err: Error) => {
      setActionMessage(`Upload failed: ${err.message}`)
    },
  })

  const bulkMatchMutation = useMutation({
    mutationFn: (matches: { cashBookTransactionId: string; bankTransactionId: string }[]) =>
      reconcile.createMatchBulk(projectId, { matches }),
    onSuccess: (data: { created: number }) => {
      queryClient.invalidateQueries({ queryKey: ['reconcile', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setBulkSelected(new Set())
      setSelectedCbIds(new Set())
      setSelectedBankIds(new Set())
      setActionMessage(`Matched ${data.created} pair(s).`)
    },
  })

  const matches = useMemo<MatchedPair[]>(
    () => (data?.matches || []) as MatchedPair[],
    [data?.matches]
  )
  const receiptsRaw = useMemo<Tx[]>(() => data?.receipts?.transactions || [], [data?.receipts?.transactions])
  const creditsRaw = useMemo<Tx[]>(() => data?.credits?.transactions || [], [data?.credits?.transactions])
  const paymentsRaw = useMemo<Tx[]>(() => data?.payments?.transactions || [], [data?.payments?.transactions])
  const debitsRaw = useMemo<Tx[]>(() => data?.debits?.transactions || [], [data?.debits?.transactions])

  const matchesForView = useMemo(() => {
    if (view === 'all') return matches
    const receiptIds = new Set(receiptsRaw.map((r) => r.id))
    const creditIds = new Set(creditsRaw.map((c) => c.id))
    const paymentIds = new Set(paymentsRaw.map((p) => p.id))
    const debitIds = new Set(debitsRaw.map((d) => d.id))

    if (view === 'receipts') {
      return matches.filter((m) => receiptIds.has(m.cbTx.id) && creditIds.has(m.bankTx.id))
    }
    return matches.filter((m) => paymentIds.has(m.cbTx.id) && debitIds.has(m.bankTx.id))
  }, [view, matches, receiptsRaw, creditsRaw, paymentsRaw, debitsRaw])

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm font-medium text-gray-500">Loading reconciliation data…</p>
      </div>
    )
  }

  const currency = (data.project as { currency?: string })?.currency || 'GHS'
  const receipts = receiptsRaw
  const credits = creditsRaw
  const payments = paymentsRaw
  const debits = debitsRaw
  const anyTruncated = data.receipts?.truncated || data.credits?.truncated || data.payments?.truncated || data.debits?.truncated

  const matchedCbIds = new Set(data.matchedCashBookIds || data.matchedReceiptIds || [])
  const matchedBankIds = new Set(data.matchedBankIds || data.matchedCreditIds || [])
  const flaggedBankIds = new Set(data.flaggedBankIds || [])

  const sortByDate = (a: Tx, b: Tx) => {
    const da = a.date ? new Date(a.date).getTime() : 0
    const db = b.date ? new Date(b.date).getTime() : 0
    return da - db
  }
  const cbTxs = view === 'all'
    ? [
        ...receipts.map((t: Tx) => ({ ...t, _type: 'receipt' as const })),
        ...payments.map((t: Tx) => ({ ...t, _type: 'payment' as const })),
      ].sort(sortByDate)
    : view === 'receipts'
      ? receipts
      : payments
  const bankTxs = view === 'all'
    ? [
        ...credits.map((t: Tx) => ({ ...t, _type: 'credit' as const })),
        ...debits.map((t: Tx) => ({ ...t, _type: 'debit' as const })),
      ].sort(sortByDate)
    : view === 'receipts'
      ? credits
      : debits

  const suggestions: SuggestedMatch[] =
    view === 'all'
      ? [...(data.suggestions?.receipts || []), ...(data.suggestions?.payments || [])]
      : view === 'receipts'
        ? data.suggestions?.receipts || []
        : data.suggestions?.payments || []

  const splitSuggestions: SuggestedSplitMatch[] =
    view === 'all'
      ? [...(data.suggestions?.split?.receipts || []), ...(data.suggestions?.split?.payments || [])]
      : view === 'receipts'
        ? data.suggestions?.split?.receipts || []
        : data.suggestions?.split?.payments || []

  const highConfidenceSuggestions = suggestions.filter((s) => s.confidence >= 0.95)

  // Build suggestion maps for row tooltips (cbId/bankId -> suggested matches)
  const receiptSugs = (data.suggestions?.receipts || []) as SuggestedMatch[]
  const paymentSugs = (data.suggestions?.payments || []) as SuggestedMatch[]
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
  const fmtAmt = (n: number) => formatAmountNumber(Number.isFinite(n) ? n : 0)
  const formatMatchTooltip = (label: string, t: Tx, conf: number, reason: string) =>
    `${label}: ${formatDateCompact(t.date)} • ${(t.name || t.details || '—').slice(0, 40)} • ${fmtAmt(t.amount)} (${Math.round(conf * 100)}%: ${reason})`

  function getCbRowTooltip(t: Tx & { _type?: 'receipt' | 'payment' }, isReceipt: boolean): string {
    const base = matchedCbIds.has(t.id) ? '' : getUnmatchedReason(t, true)
    const sugs = isReceipt ? cbReceiptToBank.get(t.id) : cbPaymentToBank.get(t.id)
    if (!sugs?.length) return base
    const lines = sugs.slice(0, 3).map((s) => formatMatchTooltip('Suggested bank match', s.bank, s.confidence, s.reason))
    return base ? `${base}\n\n${lines.join('\n')}` : lines.join('\n')
  }
  function getBankRowTooltip(t: Tx & { _type?: 'credit' | 'debit' }, isCredit: boolean): string {
    const base = matchedBankIds.has(t.id) ? '' : getUnmatchedReason(t, false)
    const sugs = isCredit ? bankCreditToCb.get(t.id) : bankDebitToCb.get(t.id)
    if (!sugs?.length) return base
    const lines = sugs.slice(0, 3).map((s) => formatMatchTooltip('Suggested cash book match', s.cb, s.confidence, s.reason))
    return base ? `${base}\n\n${lines.join('\n')}` : lines.join('\n')
  }

  function getUnmatchedReason(t: Tx, isCashBook: boolean): string {
    if (isCashBook) {
      if (view === 'receipts') return 'Uncredited — no matching bank credit'
      return t.chqNo?.trim() ? 'Unpresented cheque — no bank debit with same amount/ref' : 'Unpresented — no matching bank debit'
    }
    if (view === 'receipts') return 'No matching cash book receipt'
    return 'No matching cash book payment'
  }

  const cbArr = Array.from(selectedCbIds)
  const bankArr = Array.from(selectedBankIds)
  const canMatchInView = view !== 'all'
  const hasMultiMatch = features.one_to_many && features.many_to_many
  const canMatch1to1 = canMatchInView && cbArr.length === 1 && bankArr.length === 1
  const canMatch1toMany = canMatchInView && hasMultiMatch && cbArr.length === 1 && bankArr.length >= 2
  const canMatchManyTo1 = canMatchInView && hasMultiMatch && cbArr.length >= 2 && bankArr.length === 1
  const canMatchManyToMany = canMatchInView && hasMultiMatch && cbArr.length >= 2 && bankArr.length >= 2
  const canMatch = canMatch1to1 || canMatch1toMany || canMatchManyTo1 || canMatchManyToMany
  const isStrictPreset = matchParams.useDate && matchParams.useDocRef && matchParams.useChequeNo
  const isAmountDatePreset = matchParams.useDate && !matchParams.useDocRef && !matchParams.useChequeNo
  const isAmountOnlyPreset = !matchParams.useDate && !matchParams.useDocRef && !matchParams.useChequeNo
  const activeModeLabel = isStrictPreset
    ? 'Strict'
    : isAmountDatePreset
      ? 'Amount + Date'
      : isAmountOnlyPreset
        ? 'Amount only'
        : 'Custom'

  const handleMatch = () => {
    if (!canMatch) return
    if (canMatch1to1) {
      matchMutation.mutate({ cashBookTransactionId: cbArr[0]!, bankTransactionId: bankArr[0]! })
    } else if (canMatch1toMany) {
      multiMatchMutation.mutate({ cashBookTransactionId: cbArr[0]!, bankTransactionIds: bankArr })
    } else if (canMatchManyTo1) {
      multiMatchMutation.mutate({ cashBookTransactionIds: cbArr, bankTransactionId: bankArr[0]! })
    } else if (canMatchManyToMany) {
      multiMatchMutation.mutate({ cashBookTransactionIds: cbArr, bankTransactionIds: bankArr })
    }
  }

  const toggleCb = (id: string) => {
    setSelectedCbIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleBank = (id: string) => {
    setSelectedBankIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-8">
      {/* What this page does */}
      <div>
        <p className="text-sm text-gray-600 max-w-2xl leading-relaxed">
          This step <strong>matches your cash book entries</strong> (receipts or payments) to <strong>bank statement entries</strong> (credits or debits).
          Use the suggested matches for speed, or select rows in the tables below and click Match. When you’re done, proceed to Review to finalise.
        </p>
      </div>

      <BrsHelp variant="reconcile" />
      {actionMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-800">
          {actionMessage}
        </div>
      )}

      {anyTruncated && (
        <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-sm text-amber-800">
            Showing first {Math.min(reconcileLimit, 5000) / 4} transactions per category. Some transactions are hidden.
          </p>
          <button
            type="button"
            onClick={() => setReconcileLimit(5000)}
            className="px-4 py-2 text-sm font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors"
          >
            Load more
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-bold text-gray-900 tracking-tight">Reconcile transactions</h2>
        <div className="flex flex-wrap items-center gap-3">
          {bankAccounts.length > 0 && (
            <select
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              className="min-h-[40px] pl-4 pr-10 py-2 border border-gray-200 rounded-xl bg-gray-50/80 text-gray-900 text-sm font-medium focus:ring-2 focus:ring-primary-500 focus:border-primary-500 focus:bg-white outline-none transition-all"
            >
              <option value="">All bank accounts</option>
              {bankAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}
          <div className="flex flex-wrap rounded-xl border border-gray-200 bg-gray-50/50 p-0.5 shadow-sm">
            <button
              onClick={() => setView('receipts')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                view === 'receipts' ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Receipts vs Credits
            </button>
            <button
              onClick={() => setView('payments')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                view === 'payments' ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Payments vs Debits
            </button>
            <button
              onClick={() => setView('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                view === 'all' ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Cash book (all)
            </button>
          </div>
        </div>
      </div>
      <p className="text-sm font-medium text-gray-700">
        <span className="text-primary-600">{data.existingMatches}</span> matches confirmed.
        {view === 'all'
          ? ' Cash book (all) shows receipts and payments together. Switch to Receipts or Payments to match.'
          : canReconcile
            ? ' Select a cash book row and a bank row, then click Match.'
            : ' View-only access.'}
      </p>
      {receipts.length === 0 && (view === 'receipts' || view === 'all') && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">
            No cash book receipts found. Upload your cash book as <strong>Both (receipts + payments)</strong> and map the receipts document with the <strong>amt_received</strong> column.
          </p>
        </div>
      )}
      {payments.length === 0 && (view === 'payments' || view === 'all') && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-800">
            No cash book payments found. Upload your cash book as <strong>Both (receipts + payments)</strong> and map the payments document with the <strong>amt_paid</strong> column.
          </p>
        </div>
      )}
      {canReconcile && (
        <p className="text-xs text-slate-600 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 max-w-2xl">
          <strong>Best practice:</strong> For cheques, match only when the amount (and reference if present) matches the bank.
        </p>
      )}

      {/* Suggested matches with bulk action */}
      {suggestions.length > 0 && canReconcile && (
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-amber-900 tracking-tight mb-1">Suggested matches</h3>
              <p className="text-sm text-amber-800/90">
                {features.bulk_match
                  ? 'Click a suggestion to pre-select, or tick to bulk-select.'
                  : 'Click a suggestion to pre-select, then click Match.'}
              </p>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                showSettings ? 'bg-amber-200 text-amber-900' : 'bg-white/80 text-amber-700 hover:bg-white'
              } border border-amber-200`}
            >
              <Settings className="w-4 h-4" />
              {showSettings ? 'Hide Settings' : 'Matching Settings'}
            </button>
          </div>

          {showSettings && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-white/70 p-4 animate-in fade-in slide-in-from-top-2 duration-200">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-900 mb-3">Matching parameters</p>
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setMatchParams({ useDate: true, useDocRef: true, useChequeNo: true })}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
                    isStrictPreset
                      ? 'border-amber-500 bg-amber-200 text-amber-950'
                      : 'border-amber-200 bg-white text-amber-900 hover:bg-amber-50'
                  }`}
                >
                  Strict
                </button>
                <button
                  type="button"
                  onClick={() => setMatchParams({ useDate: true, useDocRef: false, useChequeNo: false })}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
                    isAmountDatePreset
                      ? 'border-amber-500 bg-amber-200 text-amber-950'
                      : 'border-amber-200 bg-white text-amber-900 hover:bg-amber-50'
                  }`}
                >
                  Amount + Date
                </button>
                <button
                  type="button"
                  onClick={() => setMatchParams({ useDate: false, useDocRef: false, useChequeNo: false })}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-colors ${
                    isAmountOnlyPreset
                      ? 'border-amber-500 bg-amber-200 text-amber-950'
                      : 'border-amber-200 bg-white text-amber-900 hover:bg-amber-50'
                  }`}
                >
                  Amount-only
                </button>
              </div>
              <div className="flex flex-wrap gap-5 text-sm text-amber-900 font-medium">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked disabled className="rounded border-amber-300 text-amber-600 focus:ring-amber-500" />
                  Amount
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={matchParams.useDate}
                    onChange={(e) => setMatchParams((prev) => ({ ...prev, useDate: e.target.checked }))}
                    className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                  />
                  Date
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={matchParams.useDocRef}
                    onChange={(e) => setMatchParams((prev) => ({ ...prev, useDocRef: e.target.checked }))}
                    className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                  />
                  Reference
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={matchParams.useChequeNo}
                    onChange={(e) => setMatchParams((prev) => ({ ...prev, useChequeNo: e.target.checked }))}
                    className="rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                  />
                  Cheque No.
                </label>
              </div>
              <p className="mt-3 text-[11px] text-amber-700 leading-relaxed italic">
                Active mode: <strong>{activeModeLabel}</strong>. Settings apply to suggestions and automated matching.
              </p>
            </div>
          )}
          {features.bulk_match && (
          <div className="flex flex-wrap gap-2 mb-4">
            {highConfidenceSuggestions.length > 0 && (
              <button
                onClick={() => {
                  const pairs = highConfidenceSuggestions.map((s) => ({
                    cashBookTransactionId: s.cashBookTx.id,
                    bankTransactionId: s.bankTx.id,
                  }))
                  bulkMatchMutation.mutate(pairs)
                }}
                disabled={bulkMatchMutation.isPending}
                className="px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium shadow-sm hover:bg-green-700 hover:shadow disabled:opacity-50 transition-all"
                title="Apply only suggestions with 95%+ confidence"
              >
                {bulkMatchMutation.isPending ? 'Matching…' : `Match all high-confidence (95%+) — ${highConfidenceSuggestions.length}`}
              </button>
            )}
            <button
              onClick={() => {
                const pairs = suggestions.slice(0, 50).map((s) => ({
                  cashBookTransactionId: s.cashBookTx.id,
                  bankTransactionId: s.bankTx.id,
                }))
                if (pairs.length) bulkMatchMutation.mutate(pairs)
              }}
              disabled={bulkMatchMutation.isPending}
              className="px-4 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-medium shadow-sm hover:bg-primary-700 hover:shadow disabled:opacity-50 transition-all"
            >
              {bulkMatchMutation.isPending ? 'Matching…' : 'Match all suggested (up to 50)'}
            </button>
            {bulkSelected.size > 0 && (
              <button
                onClick={() => {
                  const pairs = Array.from(bulkSelected).map((i) => ({
                    cashBookTransactionId: suggestions[i].cashBookTx.id,
                    bankTransactionId: suggestions[i].bankTx.id,
                  }))
                  bulkMatchMutation.mutate(pairs)
                }}
                disabled={bulkMatchMutation.isPending}
                className="px-4 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-medium shadow-sm hover:bg-primary-600 disabled:opacity-50 transition-all"
              >
                Match {bulkSelected.size} selected
              </button>
            )}
          </div>
          )}
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {suggestions.slice(0, 50).map((s, i) => (
              <label
                key={i}
                className={`flex items-center gap-3 w-full text-left px-4 py-2.5 rounded-xl border cursor-pointer transition-all ${
                  selectedCbIds.has(s.cashBookTx.id) && selectedBankIds.has(s.bankTx.id)
                    ? 'border-primary-400 bg-primary-50 shadow-sm'
                    : 'border-amber-200/70 hover:bg-amber-100/70'
                }`}
              >
                {features.bulk_match && (
                <input
                  type="checkbox"
                  checked={bulkSelected.has(i)}
                  onChange={(e) => {
                    e.stopPropagation()
                    setBulkSelected((prev) => {
                      const next = new Set(prev)
                      if (next.has(i)) next.delete(i)
                      else next.add(i)
                      return next
                    })
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                )}
                <span
                  className="flex-1 text-sm text-gray-900"
                  onClick={() => {
                    setSelectedCbIds(new Set([s.cashBookTx.id]))
                    setSelectedBankIds(new Set([s.bankTx.id]))
                  }}
                >
                  <span className="font-semibold text-gray-900">{s.cashBookTx.name || s.cashBookTx.details || '—'}</span>
                  <span className="mx-1.5 text-amber-600">↔</span>
                  <span className="text-gray-700">{s.bankTx.name || s.bankTx.details || '—'}</span>
                  <span className="ml-2 text-xs font-medium text-gray-500">
                    {formatAmount(s.cashBookTx.amount, currency)} · {Math.round(s.confidence * 100)}%
                  </span>
                  {s.duplicateWarning && (
                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800" title="Multiple bank transactions match this cash book — verify before matching">
                      Verify
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Split suggestions (1-to-many, many-to-1) */}
      {splitSuggestions.length > 0 && canReconcile && (
        <div className="rounded-xl border border-primary-200/80 bg-primary-50/50 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-0.5 bg-primary-600 text-white text-[10px] font-bold rounded uppercase tracking-wider">Premium</span>
            <h3 className="text-base font-bold text-primary-900 tracking-tight">Split suggestions</h3>
          </div>
          <p className="text-sm text-primary-800/90 mb-4">
            These items appear to be bulk deposits or multi-item payments. Click to select the group.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {splitSuggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => {
                  setSelectedCbIds(new Set(s.cashBookTxs.map((t: Tx) => t.id)))
                  setSelectedBankIds(new Set(s.bankTxs.map((t: Tx) => t.id)))
                }}
                className={`flex flex-col gap-1 w-full text-left px-4 py-3 rounded-xl border transition-all ${
                  s.cashBookTxs.every((t: Tx) => selectedCbIds.has(t.id)) && s.bankTxs.every((t: Tx) => selectedBankIds.has(t.id))
                    ? 'border-primary-400 bg-primary-100 shadow-sm'
                    : 'border-primary-200/50 bg-white hover:bg-primary-50'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="text-[10px] font-bold text-primary-700 uppercase">{s.reason}</span>
                  <span className="text-[10px] font-bold text-gray-500">{Math.round(s.confidence * 100)}% Match</span>
                </div>
                <div className="text-xs text-gray-900">
                   <div className="font-semibold mb-0.5">Book: {s.cashBookTxs.length} item(s)</div>
                   <div className="font-semibold">Bank: {s.bankTxs.length} item(s)</div>
                </div>
                <div className="mt-2 pt-2 border-t border-primary-100 flex justify-between items-center">
                  <span className="text-xs font-bold text-primary-900">{formatAmount(s.cashBookTxs.reduce((sum: number, t: Tx) => sum + t.amount, 0), currency)}</span>
                  <span className="text-[10px] text-primary-600 font-medium italic">Click to match group</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Matched pairs with Unmatch */}
      {matchesForView.length > 0 && (
        <div className="rounded-xl border border-green-200/80 bg-green-50/80 p-5 shadow-sm">
          <h3 className="text-base font-bold text-green-900 tracking-tight mb-1">Confirmed matches</h3>
          <p className="text-sm text-green-800/90 mb-4">{canReconcile ? 'Click Unmatch to undo a match.' : 'View-only. Matches cannot be changed.'}</p>
          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
            {matchesForView.map((m: MatchedPair) => (
              <div
                key={m.matchId}
                className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-green-200/70 bg-white shadow-sm"
              >
                <span className="flex-1 text-sm truncate text-gray-900">
                  <span className="font-semibold">{m.cbTx.name || m.cbTx.details || '—'}</span>
                  <span className="mx-1.5 text-green-600">↔</span>
                  <span>{m.bankTx.name || m.bankTx.details || '—'}</span>
                  <span className="ml-2 text-xs font-medium text-gray-500">{formatAmount(m.cbTx.amount, currency)}</span>
                  {m.attachments && m.attachments.length > 0 && (
                    <span className="ml-2 text-primary-600" title={`Evidence: ${m.attachments[0].filename}`}>📎</span>
                  )}
                </span>
                <div className="flex items-center gap-2">
                  {canReconcile && (
                    <>
                      <button
                        onClick={() => {
                          const input = document.getElementById('match-evidence-input') as HTMLInputElement
                          if (input) {
                            input.dataset.matchId = m.matchId
                            input.click()
                          }
                        }}
                        disabled={evidenceUploadMutation.isPending}
                        className="px-3 py-1.5 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                      >
                        {evidenceUploadMutation.isPending && evidenceUploadMutation.variables?.matchId === m.matchId ? 'Uploading…' : 'Evidence'}
                      </button>
                      <button
                        onClick={() => unmatchMutation.mutate(m.matchId)}
                        disabled={unmatchMutation.isPending}
                        className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        Unmatch
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
          <input
            id="match-evidence-input"
            type="file"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              const matchId = e.target.dataset.matchId
              if (file && matchId) {
                evidenceUploadMutation.mutate({ file, matchId })
              }
              e.target.value = ''
            }}
          />
        </div>
      )}

      {/* Floating Match Action Bar */}
      {canMatch && canReconcile && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-gray-900 text-white rounded-2xl shadow-2xl border border-gray-800 p-2 pl-6 flex items-center gap-6 backdrop-blur-md bg-opacity-90">
            <div className="flex items-center gap-4 py-2">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Selected for match</span>
                <span className="text-sm font-semibold">
                  {cbArr.length} Book ↔ {bankArr.length} Bank
                </span>
              </div>
            </div>
            <div className="h-8 w-px bg-gray-800" />
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSelectedCbIds(new Set())
                  setSelectedBankIds(new Set())
                }}
                className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white transition-colors"
              >
                Clear
              </button>
              <button
                onClick={handleMatch}
                disabled={matchMutation.isPending || multiMatchMutation.isPending}
                className="px-6 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-bold shadow-lg hover:bg-primary-500 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {matchMutation.isPending || multiMatchMutation.isPending ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Matching…
                  </>
                ) : (
                  <>
                    <LinkIcon className="w-4 h-4" />
                    Confirm Match
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proceed to Review */}
      {onProceedToReview && (
        <div className="pt-8 mt-12 border-t border-gray-100 flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-md">
            <h4 className="text-base font-bold text-gray-900 mb-1">Ready to finalise?</h4>
            <p className="text-sm text-gray-500">
              Review your matches and verify un-reconciled items before generating your professional BRS report.
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

      {/* Stacked tables — full width for better readability */}
      <p className="text-sm font-medium text-gray-600 mb-3">
        {view === 'all'
          ? 'Cash book (all) shows receipts and payments together. Rows with 🔗 have suggested matches — hover for tooltip. Switch to Receipts or Payments to select and match.'
          : canReconcile
            ? 'Click rows to select. Rows with 🔗 have suggested matches — hover for tooltip. 1-to-1, 1-to-many, many-to-1, or many-to-many (multiple cash book + multiple bank).'
            : 'View-only. Row selection is disabled.'}
      </p>
      <div className="flex flex-col gap-6">
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <h3 className="px-4 py-3 bg-gray-50 border-b border-gray-200 text-sm font-bold text-gray-900 tracking-tight">
            Cash Book
          </h3>
          <div className="overflow-x-auto overflow-y-auto max-h-[45rem]">
            <table className="min-w-full text-xs sm:text-sm text-gray-900">
              <thead className="bg-gray-100/80 sticky top-0">
                <tr>
                  {view !== 'all' && <th className="px-2 sm:px-3 py-2.5 text-left w-8 text-gray-500 font-medium" />}
                  {view === 'all' && <th className="px-2 sm:px-3 py-2.5 text-left text-gray-600 font-semibold whitespace-nowrap">Type</th>}
                  <th className="px-2 sm:px-3 py-2.5 text-left text-gray-600 font-semibold whitespace-nowrap">Date</th>
                  <th className="px-2 sm:px-3 py-2.5 text-left text-gray-600 font-semibold min-w-[120px]">Name</th>
                  <th className="px-2 sm:px-3 py-2.5 text-left text-gray-600 font-semibold min-w-[180px]">Description</th>
                  <th className="px-2 sm:px-3 py-2.5 text-left text-gray-600 font-semibold whitespace-nowrap">Chq no.</th>
                  <th className="px-2 sm:px-3 py-2.5 text-left text-gray-600 font-semibold whitespace-nowrap">Ref. Doc. No.</th>
                  <th className="px-2 sm:px-3 py-2.5 text-right text-gray-600 font-semibold whitespace-nowrap">Amount Received ({getCurrencySymbol(currency)})</th>
                  <th className="px-2 sm:px-3 py-2.5 text-right text-gray-600 font-semibold whitespace-nowrap">Amount Paid ({getCurrencySymbol(currency)})</th>
                  <th className="px-2 sm:px-3 py-2.5 text-right text-gray-600 font-semibold whitespace-nowrap">Balance ({getCurrencySymbol(currency)})</th>
                  {view !== 'all' && <th className="px-2 sm:px-3 py-2.5 text-left text-gray-500 font-medium min-w-[100px] sm:min-w-[140px]">Note</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(() => {
                  const rows: Array<{ t: Tx & { _type?: 'receipt' | 'payment' }; isReceipt: boolean; runningBalance: number }> = []
                  let runningBalance = 0
                  for (const t of (cbTxs as Array<Tx & { _type?: 'receipt' | 'payment' }>)) {
                    const isReceipt = view === 'all' ? t._type === 'receipt' : view === 'receipts'
                    runningBalance += isReceipt ? Number(t.amount) : -Number(t.amount)
                    rows.push({ t, isReceipt, runningBalance })
                  }
                  return rows.map(({ t, isReceipt, runningBalance }) => (
                      <tr
                        key={t.id}
                        onClick={() => canReconcile && view !== 'all' && toggleCb(t.id)}
                        title={getCbRowTooltip(t, isReceipt)}
                        className={`${canReconcile && view !== 'all' ? 'cursor-pointer' : 'cursor-default'} transition-colors ${
                          selectedCbIds.has(t.id) ? 'bg-primary-50' : canReconcile && view !== 'all' ? 'hover:bg-gray-50' : ''
                        } ${matchedCbIds.has(t.id) ? 'opacity-60' : ''}`}
                      >
                        {view !== 'all' && (
                          <td className="px-2 sm:px-3 py-2 whitespace-nowrap">
                            {selectedCbIds.has(t.id) && <span className="text-primary-600 font-bold">✓</span>}
                          </td>
                        )}
                        {view === 'all' && (
                          <td className="px-2 sm:px-3 py-2 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${isReceipt ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                              {isReceipt ? 'Receipt' : 'Payment'}
                            </span>
                          </td>
                        )}
                        <td className="px-2 sm:px-3 py-2 font-medium text-gray-700 whitespace-nowrap">
                          {formatDateCompact(t.date)}
                          {(isReceipt ? cbReceiptToBank : cbPaymentToBank).has(t.id) && (
                            <span className="ml-1 text-primary-600" title={getCbRowTooltip(t, isReceipt)}>🔗</span>
                          )}
                        </td>
                        <td className="px-2 sm:px-3 py-2 text-gray-900 min-w-[100px]" title={t.name || ''}>
                          {t.name || '—'}
                        </td>
                        <td className="px-2 sm:px-3 py-2 text-gray-700 min-w-[140px]" title={t.details || ''}>
                          {t.details || '—'}
                        </td>
                        <td className="px-2 sm:px-3 py-2 text-gray-600 font-mono text-xs whitespace-nowrap">{t.chqNo || '—'}</td>
                        <td className="px-2 sm:px-3 py-2 text-gray-600 font-mono text-xs whitespace-nowrap">{t.docRef || '—'}</td>
                        <td className="px-2 sm:px-3 py-2 text-right font-semibold text-gray-900 whitespace-nowrap">
                          {isReceipt ? formatAmountNumber(t.amount) : '—'}
                        </td>
                        <td className="px-2 sm:px-3 py-2 text-right font-semibold text-gray-900 whitespace-nowrap">
                          {!isReceipt ? formatAmountNumber(t.amount) : '—'}
                        </td>
                        <td className="px-2 sm:px-3 py-2 text-right text-gray-600 whitespace-nowrap">{formatAmountNumber(runningBalance)}</td>
                        {view !== 'all' && (
                          <td className="px-2 sm:px-3 py-2 text-xs text-amber-700 truncate min-w-0" title={getCbRowTooltip(t, isReceipt)}>
                            {!matchedCbIds.has(t.id) && getUnmatchedReason(t, true)}
                          </td>
                        )}
                      </tr>
                    )
                  )
                })()}
              </tbody>
            </table>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          <h3 className="px-4 py-3 bg-gray-50 border-b border-gray-200 text-sm font-bold text-gray-900 tracking-tight">
            Bank Statement
          </h3>
          <div className="overflow-x-auto overflow-y-auto max-h-[45rem]">
            <table className="min-w-full text-xs sm:text-sm text-gray-900">
              <thead className="bg-gray-100/80 sticky top-0">
                <tr>
                  {view !== 'all' && <th className="px-2 sm:px-3 py-2.5 text-left w-8 text-gray-500 font-medium" />}
                  {view === 'all' && <th className="px-2 sm:px-3 py-2.5 text-left text-gray-600 font-semibold whitespace-nowrap">Type</th>}
                  <th className="px-2 sm:px-3 py-2.5 text-left text-gray-600 font-semibold whitespace-nowrap">Date</th>
                  <th className="px-2 sm:px-3 py-2.5 text-left text-gray-600 font-semibold min-w-[180px]">Description</th>
                  <th className="px-2 sm:px-3 py-2.5 text-left text-gray-600 font-semibold whitespace-nowrap">Chq no.</th>
                  <th className="px-2 sm:px-3 py-2.5 text-left text-gray-600 font-semibold whitespace-nowrap">Ref. Doc. No.</th>
                  <th className="px-2 sm:px-3 py-2.5 text-right text-gray-600 font-semibold whitespace-nowrap">Debit ({getCurrencySymbol(currency)})</th>
                  <th className="px-2 sm:px-3 py-2.5 text-right text-gray-600 font-semibold whitespace-nowrap">Credit ({getCurrencySymbol(currency)})</th>
                  <th className="px-2 sm:px-3 py-2.5 text-right text-gray-600 font-semibold whitespace-nowrap">Balance ({getCurrencySymbol(currency)})</th>
                  {view !== 'all' && <th className="px-2 sm:px-3 py-2.5 text-left text-gray-500 font-medium min-w-[100px] sm:min-w-[140px]">Note</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(() => {
                  const rows: Array<{ t: Tx & { _type?: 'credit' | 'debit' }; amt: number; isCredit: boolean; runningBalance: number }> = []
                  let runningBalance = 0
                  for (const t of (bankTxs as Array<Tx & { _type?: 'credit' | 'debit' }>)) {
                    const amt = Number(t.amount)
                    const isCredit = view === 'all' ? t._type === 'credit' : view === 'receipts'
                    runningBalance += isCredit ? amt : -amt
                    rows.push({ t, amt, isCredit, runningBalance })
                  }
                  return rows.map(({ t, amt, isCredit, runningBalance }) => (
                      <tr
                        key={t.id}
                        onClick={() => canReconcile && view !== 'all' && toggleBank(t.id)}
                        title={getBankRowTooltip(t, view === 'all' ? t._type === 'credit' : view === 'receipts')}
                        className={`${canReconcile && view !== 'all' ? 'cursor-pointer' : 'cursor-default'} transition-colors ${
                          selectedBankIds.has(t.id) ? 'bg-primary-50' : canReconcile && view !== 'all' ? 'hover:bg-gray-50' : ''
                        } ${matchedBankIds.has(t.id) ? 'opacity-60' : ''}`}
                      >
                        {view === 'all' ? (
                          <td className="px-2 sm:px-3 py-2 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${t._type === 'credit' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}`}>
                              {t._type === 'credit' ? 'Credit' : 'Debit'}
                            </span>
                          </td>
                        ) : (
                          <td className="px-2 sm:px-3 py-2 whitespace-nowrap">
                            {selectedBankIds.has(t.id) && <span className="text-primary-600 font-bold">✓</span>}
                          </td>
                        )}
                        <td className="px-2 sm:px-3 py-2 font-medium text-gray-700 whitespace-nowrap">
                          {formatDateCompact(t.date)}
                          {((view === 'all' ? t._type === 'credit' : view === 'receipts') ? bankCreditToCb : bankDebitToCb).has(t.id) && (
                            <span className="ml-1 text-primary-600" title={getBankRowTooltip(t, view === 'all' ? t._type === 'credit' : view === 'receipts')}>🔗</span>
                          )}
                        </td>
                        <td className="px-2 sm:px-3 py-2 text-gray-900 min-w-[140px]" title={t.details || ''}>
                          <span>{t.name || t.details || '—'}</span>
                          {flaggedBankIds.has(t.id) && (
                            <span className="ml-1 px-1.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 rounded" title="Flagged by bank rule">
                              Flagged
                            </span>
                          )}
                        </td>
                        <td className="px-2 sm:px-3 py-2 text-gray-600 font-mono text-xs whitespace-nowrap">{t.chqNo || '—'}</td>
                        <td className="px-2 sm:px-3 py-2 text-gray-600 font-mono text-xs whitespace-nowrap">{t.docRef || '—'}</td>
                        <td className="px-2 sm:px-3 py-2 text-right font-semibold text-gray-900 whitespace-nowrap">
                          {view === 'all' ? (!isCredit ? formatAmountNumber(amt) : '—') : view === 'payments' ? formatAmountNumber(amt) : '—'}
                        </td>
                        <td className="px-2 sm:px-3 py-2 text-right font-semibold text-gray-900 whitespace-nowrap">
                          {view === 'all' ? (isCredit ? formatAmountNumber(amt) : '—') : view === 'receipts' ? formatAmountNumber(amt) : '—'}
                        </td>
                        <td className="px-2 sm:px-3 py-2 text-right text-gray-600 whitespace-nowrap">{formatAmountNumber(runningBalance)}</td>
                        {view !== 'all' && (
                          <td className="px-2 sm:px-3 py-2 text-xs text-amber-700 truncate min-w-0" title={getBankRowTooltip(t, view === 'receipts')}>
                            {!matchedBankIds.has(t.id) && getUnmatchedReason(t, false)}
                          </td>
                        )}
                      </tr>
                    )
                  )
                })()}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Proceed to Review */}
      {onProceedToReview && (
        <div className="pt-6 mt-6 border-t border-gray-200 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm font-medium text-gray-600">
            Done matching? Go to Review to finalise, then generate your report.
          </p>
          <button
            type="button"
            onClick={onProceedToReview}
            className="px-5 py-2.5 bg-primary-600 text-white rounded-xl font-medium shadow-sm hover:bg-primary-700 hover:shadow transition-all"
          >
            Proceed to Review →
          </button>
        </div>
      )}
    </div>
  )
}
