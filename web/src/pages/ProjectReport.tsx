import { useState, useEffect, useRef, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../store/auth'
import { report, projects, attachments, subscription, currency as currencyApi, getLogoDisplayUrl, type BrsStatement, type ReportResponse } from '../lib/api'
import { canSubmitForReview, canApprove, canUploadDocuments, canDeleteAttachment, canReopenProject, canExportReport } from '../lib/permissions'
import { formatDate, formatDateBRSTitle } from '../lib/format'
import BrsHelp from '../components/BrsHelp'

interface ProjectReportProps {
  projectId: string
  onGoToReview?: () => void
  onReopen?: () => void
  onRollForward?: (newProjectId: string) => void
  canExport?: boolean
  canReopen?: boolean
}

export default function ProjectReport({ projectId, onGoToReview, onReopen, onRollForward, canExport = true, canReopen = true }: ProjectReportProps) {
  const queryClient = useQueryClient()
  const role = useAuth((s) => s.role)
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState('')
  const [attachmentType, setAttachmentType] = useState<'bank_statement' | 'approval' | 'other'>('other')
  const [showUndoConfirm, setShowUndoConfirm] = useState(false)
  const [undoReason, setUndoReason] = useState('')
  const [bankAccountId, setBankAccountId] = useState<string>('')
  const bankAccountRestoredRef = useRef(false)
  const [editingComments, setEditingComments] = useState(false)
  const [editNarrative, setEditNarrative] = useState('')
  const [editBankStatementClosingBalance, setEditBankStatementClosingBalance] = useState<string>('')
  const [editPreparerComment, setEditPreparerComment] = useState('')
  const [editReviewerComment, setEditReviewerComment] = useState('')
  const [reportLogoLoadFailed, setReportLogoLoadFailed] = useState(false)
  const [displayCurrency, setDisplayCurrency] = useState<'GHS' | 'USD' | 'EUR' | ''>('')
  const [signedAmountMode, setSignedAmountMode] = useState(false)
  const [showDiagnostics, setShowDiagnostics] = useState(false)

  const { data: usageData } = useQuery({
    queryKey: ['subscription', 'usage'],
    queryFn: subscription.getUsage,
  })
  const features = (usageData?.features || {}) as Record<string, boolean>
  const { data, isLoading } = useQuery<ReportResponse>({
    queryKey: ['report', projectId, bankAccountId || null],
    queryFn: () => report.get(projectId, bankAccountId ? { bankAccountId } : undefined),
    enabled: !!projectId,
  })
  const { data: attachmentsList = [] } = useQuery({
    queryKey: ['attachments', projectId],
    queryFn: () => attachments.list(projectId),
    enabled: !!projectId,
  })
  const projectCurrency = (data?.currency as string) || 'GHS'
  const effectiveDisplayCurrency = displayCurrency || projectCurrency
  const needsConversion = effectiveDisplayCurrency !== projectCurrency
  const { data: ratesData } = useQuery({
    queryKey: ['currency', 'rates'],
    queryFn: () => currencyApi.getRates(),
    enabled: needsConversion,
  })

  const reportLogoUrl = data?.organization?.branding?.logoUrl
  useEffect(() => {
    setReportLogoLoadFailed(false)
  }, [reportLogoUrl])

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

  const totalTransactions = data?.summary?.totalTransactions ?? 0
  const isLargeReport = totalTransactions > 200

  const handleExport = async (format: 'excel' | 'pdf') => {
    if (isLargeReport && !window.confirm(`This report has ${totalTransactions} transactions. Export may take 30-60 seconds. Continue?`)) return
    setExportError('')
    setExporting(true)
    try {
      await (format === 'pdf' ? report.exportPdf : report.exportExcel)(projectId, bankAccountId || undefined, signedAmountMode)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const reopenMutation = useMutation({
    mutationFn: () => projects.reopen(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      onReopen?.()
    },
  })
  const undoReconciliationMutation = useMutation({
    mutationFn: (reason?: string) => projects.undoReconciliation(projectId, reason),
    onSuccess: () => {
      setShowUndoConfirm(false)
      setUndoReason('')
      queryClient.invalidateQueries({ queryKey: ['report', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      onReopen?.()
    },
  })

  const submitMutation = useMutation({
    mutationFn: () => projects.submit(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
  const approveMutation = useMutation({
    mutationFn: () => projects.approve(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })
  const attachmentUploadMutation = useMutation({
    mutationFn: (payload: { file: File; type: 'bank_statement' | 'approval' | 'other' }) =>
      attachments.upload(projectId, payload.file, payload.type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments', projectId] })
    },
  })
  const attachmentDeleteMutation = useMutation({
    mutationFn: (id: string) => attachments.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attachments', projectId] })
    },
  })
  const rollForwardMutation = useMutation({
    mutationFn: () => projects.create({
      name: `${data?.project?.name || 'BRS'} (next period)`,
      rollForwardFromProjectId: projectId,
    }),
    onSuccess: (newProject: { id: string; slug?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      onRollForward?.(newProject.slug ?? newProject.id)
    },
  })
  const updateCommentsMutation = useMutation({
    mutationFn: (body: { reportNarrative?: string; preparerComment?: string; reviewerComment?: string; bankStatementClosingBalance?: number | null }) =>
      projects.updateReportComments(projectId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report', projectId] })
      setEditingComments(false)
    },
  })
  const startEditingComments = () => {
    const proj = data?.project
    setEditNarrative(proj?.reportNarrative ?? data?.narrative ?? '')
    setEditBankStatementClosingBalance(proj?.bankStatementClosingBalance != null ? String(proj.bankStatementClosingBalance) : '')
    setEditPreparerComment(proj?.preparerComment ?? '')
    setEditReviewerComment(proj?.reviewerComment ?? '')
    setEditingComments(true)
  }

  useEffect(() => {
    if (data) {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    }
  }, [data, projectId, queryClient])
  const preHasSignAnomaly = !!data?.sourceFilterLogic && [
    data.sourceFilterLogic.cashBookReceipts,
    data.sourceFilterLogic.cashBookPayments,
    data.sourceFilterLogic.bankStatementDebits,
    data.sourceFilterLogic.bankStatementCredits,
  ].some((s) => (s?.cross_reference ?? 0) > 0 || (s?.zero ?? 0) > 0 || (s?.empty ?? 0) > 0)
  useEffect(() => {
    if (preHasSignAnomaly) setShowDiagnostics(true)
  }, [preHasSignAnomaly])

  if (isLoading || !data) return <div className="text-gray-600">Loading report...</div>

  const currency = (data?.currency as string) || 'GHS'
  const rates = ratesData?.rates ?? { GHS: 1, USD: 0.0925, EUR: 0.0796 }
  const convertAmt = (amt: number): number => {
    if (effectiveDisplayCurrency === currency) return amt
    const fromRate = rates[currency as keyof typeof rates] ?? 1
    const toRate = rates[effectiveDisplayCurrency as keyof typeof rates] ?? 1
    return (amt * toRate) / fromRate
  }
  const fmtBaseReportAmt = (n: number) => {
    const v = convertAmt(n)
    return v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }
  const fmtBrWorkbookMagnitudeAmt = (n: number) => fmtBaseReportAmt(Math.abs(n))
  const fmtDateTime = (d: string | null | undefined) => {
    if (!d) return '—'
    const x = new Date(d)
    if (Number.isNaN(x.getTime())) return '—'
    return x.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Africa/Accra',
    })
  }
  const fmtSignedReportAmt = (n: number, opts?: { forceNegative?: boolean }) => {
    const forceNegative = !!opts?.forceNegative
    const base = fmtBaseReportAmt(Math.abs(n))
    if (!signedAmountMode) return fmtBaseReportAmt(n)
    if (forceNegative) return `-${base}`
    if (n > 0) return `+${base}`
    if (n < 0) return `-${base}`
    return base
  }
  const fmt = (d: string) => formatDate(d)
  const brsStatement = data.brsStatement as BrsStatement | undefined
  const selectedBankAccountName = data.selectedBankAccountName
  const selectedBankAccountNo = data.selectedBankAccountNo
  const bankAccountHeaderLine = data.bankAccountHeaderLine
  const reconciliationDate = data.project?.reconciliationDate
  const secondaryColor = data?.organization?.branding?.secondaryColor as string | undefined
  const primaryColor = data?.organization?.branding?.primaryColor as string | undefined
  const hasBranding = !!(primaryColor || secondaryColor)
  const matchedPairs = data.matchedPairs || []
  const matchedReceiptsVsCredits = data.matchedReceiptsVsCredits || []
  const matchedPaymentsVsDebits = data.matchedPaymentsVsDebits || []
  const unmatchedReceipts = data.unmatchedReceipts || []
  const unmatchedPayments = data.unmatchedPayments || []
  const broughtForwardItems = data.broughtForwardItems || []
  const broughtForwardLodgments = data.broughtForwardLodgments || []
  const localAsAtUncreditedTotal = unmatchedReceipts.reduce((s, t) => s + t.amount, 0)
  const localAsAtUnpresentedTotal = unmatchedPayments.reduce((s, t) => s + t.amount, 0)
  const localPostPeriodLodgmentsTotal = broughtForwardLodgments.reduce((s, t) => s + t.amount, 0)
  const localPostPeriodChequesTotal = broughtForwardItems.reduce((s, t) => s + t.amount, 0)
  const additionalInformation = data.additionalInformation
  const asAtUncreditedTotal = additionalInformation?.asAtReconciliationPosition?.uncreditedLodgmentsOrUnclearedDeposits ?? localAsAtUncreditedTotal
  const asAtUnpresentedTotal = additionalInformation?.asAtReconciliationPosition?.unpresentedChequesOrUnclearedPayments ?? localAsAtUnpresentedTotal
  const postPeriodLodgmentsTotal = additionalInformation?.postPeriodMovement?.broughtForwardUncreditedLodgments ?? localPostPeriodLodgmentsTotal
  const postPeriodChequesTotal = additionalInformation?.postPeriodMovement?.broughtForwardUnpresentedCheques ?? localPostPeriodChequesTotal
  const sourceFilterLogic = data.sourceFilterLogic
  const profileLabels = data.reportLanguageProfile?.labels
  const hasSignAnomaly = !!sourceFilterLogic && [
    sourceFilterLogic.cashBookReceipts,
    sourceFilterLogic.cashBookPayments,
    sourceFilterLogic.bankStatementDebits,
    sourceFilterLogic.bankStatementCredits,
  ].some((s) => (s?.cross_reference ?? 0) > 0 || (s?.zero ?? 0) > 0 || (s?.empty ?? 0) > 0)
  const canViewDiagnosticsByRole = ['admin', 'reviewer', 'preparer'].includes(role || '')
  const canViewDiagnostics = canViewDiagnosticsByRole || hasSignAnomaly
  const completionTimestamp = data.reportCompletedAt || data.project?.approvedAt || data.project?.reviewedAt || data.project?.preparedAt || data.generatedAt
  const printTimestamp = new Date().toISOString()
  const accountReferenceLine =
    bankAccountHeaderLine ||
    (selectedBankAccountName && selectedBankAccountNo
      ? `${selectedBankAccountName} Account Number ${selectedBankAccountNo}`
      : selectedBankAccountName
        ? `${selectedBankAccountName}`
        : selectedBankAccountNo
          ? `Account Number ${selectedBankAccountNo}`
          : null)
  const organizationDisplayName = (data.organization?.name || 'KQ SOFT SOLUTIONS').replace(/KQ-SOFT/gi, 'KQ SOFT')

  const labels = {
    openingBankStatementBalance: profileLabels?.openingBankStatementBalance || 'Opening bank statement balance',
    closingBankStatementBalance: profileLabels?.closingBankStatementBalance || 'Closing balance per bank statement',
    addUncreditedLodgments: profileLabels?.addUncreditedLodgments || 'Add: Uncredited lodgments / uncleared deposits',
    addBankOnlyDebitsWorkbookLine:
      profileLabels?.addBankOnlyDebitsNotInCashBookLine ??
      profileLabels?.lessBankOnlyDebits ??
      'Add: Bank-only debits not in cash book',
    deductBankOnlyCreditsWorkbookLine:
      profileLabels?.deductBankOnlyCreditsNotInCashBookLine ??
      profileLabels?.addBankOnlyCredits ??
      'Deduct: Bank-only credits not in cash book',
    addBankOnlyCredits: profileLabels?.addBankOnlyCredits || 'Deduct: Bank-only credits not in cash book',
    lessBankOnlyDebits: profileLabels?.lessBankOnlyDebits || 'Add: Bank-only debits not in cash book',
    lessUnpresentedCheques: profileLabels?.lessUnpresentedCheques || 'Less: Unpresented cheques',
    cashBookBalanceEnd: profileLabels?.cashBookBalanceEnd || 'Cash book balance at end of period',
    additionalInformationTitle: profileLabels?.additionalInformationTitle || 'Additional information (Ghana BRS language profile)',
    asAtReconciliationPosition: profileLabels?.asAtReconciliationPosition || 'As-at reconciliation position',
    postPeriodMovement: profileLabels?.postPeriodMovement || 'Post-period movement (carried forward)',
    uncreditedLodgmentsOrUnclearedDeposits: profileLabels?.uncreditedLodgmentsOrUnclearedDeposits || 'UNCREDITED LODGMENTS',
    bankOnlyCreditsNotInCashBook: profileLabels?.bankOnlyCreditsNotInCashBook || 'Bank-only credits not in cash book',
    bankOnlyDebitsNotInCashBook: profileLabels?.bankOnlyDebitsNotInCashBook || 'Bank-only debits not in cash book',
    unpresentedChequesOrUnclearedPayments: profileLabels?.unpresentedChequesOrUnclearedPayments || 'UNPRESENTED CHEQUES',
    broughtForwardUncreditedLodgments: profileLabels?.broughtForwardUncreditedLodgments || 'Brought-forward uncredited lodgments',
    broughtForwardUnpresentedCheques: profileLabels?.broughtForwardUnpresentedCheques || 'Brought-forward unpresented cheques',
    workbookCompositionTimingUncreditedCurrent:
      profileLabels?.workbookCompositionTimingUncreditedCurrent || 'Thereof — current-period timing uncredited',
    workbookCompositionTimingUncreditedPrior:
      profileLabels?.workbookCompositionTimingUncreditedPrior || 'Thereof — brought-forward timing uncredited (prior period)',
    workbookCompositionUnpresentedCurrent:
      profileLabels?.workbookCompositionUnpresentedCurrent || 'Thereof — current-period unpresented cheques',
    workbookCompositionUnpresentedPrior:
      profileLabels?.workbookCompositionUnpresentedPrior || 'Thereof — brought-forward unpresented cheques (prior period)',
    workbookCompositionBankCreditsCurrent:
      profileLabels?.workbookCompositionBankCreditsCurrent || 'Thereof — current-period bank-only credits',
    workbookCompositionBankCreditsPrior:
      profileLabels?.workbookCompositionBankCreditsPrior || 'Thereof — brought-forward bank-only credits (prior period)',
  }

  const showExtendedSections = false

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-4 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          {bankAccounts.length > 0 && (
            <select
              value={bankAccountId}
              onChange={(e) => setBankAccountId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm"
            >
              <option value="">All bank accounts</option>
              {bankAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}
          <select
            value={displayCurrency}
            onChange={(e) => setDisplayCurrency(e.target.value as 'GHS' | 'USD' | 'EUR' | '')}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm"
            title="Display amounts in another currency (converted for display only)"
          >
            <option value="">Display: {currency}</option>
            {currency !== 'GHS' && <option value="GHS">Display: GHS</option>}
            {currency !== 'USD' && <option value="USD">Display: USD</option>}
            {currency !== 'EUR' && <option value="EUR">Display: EUR</option>}
          </select>
          <label className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm text-gray-700">
            <input
              type="checkbox"
              checked={signedAmountMode}
              onChange={(e) => setSignedAmountMode(e.target.checked)}
            />
            Show +/- amounts
          </label>
          {canExport && (
            <>
          <button
            onClick={() => handleExport('excel')}
            disabled={exporting}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {exporting ? 'Exporting...' : 'Export Excel'}
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={exporting}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-gray-700 bg-white"
          >
            Export PDF
          </button>
            </>
          )}
          <button
            onClick={handlePrint}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 bg-white"
          >
            Print / Save as PDF
          </button>
          {canSubmitForReview(role) && data?.project?.status === 'reconciling' && (
            <button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
              className="px-4 py-2 border border-blue-300 text-blue-800 rounded-lg hover:bg-blue-50 disabled:opacity-50"
              title="Submit for review (locks editing)"
            >
              {submitMutation.isPending ? 'Submitting...' : 'Submit for review'}
            </button>
          )}
          {canApprove(role) && data?.project?.status === 'submitted_for_review' && (
            <button
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              title="Approve BRS"
            >
              {approveMutation.isPending ? 'Approving...' : 'Approve'}
            </button>
          )}
          {onGoToReview && (
            <button
              onClick={onGoToReview}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              ← Back to Review
            </button>
          )}
          {onRollForward && canReopen && (
            <div className="flex flex-col gap-1">
              <button
                onClick={() => rollForwardMutation.mutate()}
                disabled={rollForwardMutation.isPending}
                className="px-4 py-2 border border-blue-300 text-blue-800 rounded-lg hover:bg-blue-50 disabled:opacity-50 w-fit"
                title="Uses this report as the previous period BRS; new project will carry forward unpresented cheques"
              >
                {rollForwardMutation.isPending ? 'Creating...' : 'Create next period (roll forward)'}
              </button>
              <p className="text-xs text-gray-500 max-w-sm">Uses this report as the <strong>previous period BRS</strong>; unpresented cheques are carried forward to the new project.</p>
            </div>
          )}
          {onReopen && canReopen && canReopenProject(role) && (
            <>
              <button
                onClick={() => reopenMutation.mutate()}
                disabled={reopenMutation.isPending}
                className="px-4 py-2 border border-amber-300 text-amber-800 rounded-lg hover:bg-amber-50 disabled:opacity-50"
                title="Reopen to make more changes to matches"
              >
                {reopenMutation.isPending ? 'Reopening...' : 'Reopen for editing'}
              </button>
              {(data?.summary?.matchedCount || 0) > 0 && (
                <button
                  onClick={() => setShowUndoConfirm(true)}
                  disabled={undoReconciliationMutation.isPending}
                  className="px-4 py-2 border border-red-300 text-red-800 rounded-lg hover:bg-red-50 disabled:opacity-50"
                  title="Undo reconciliation — clear all matches and reset sign-off"
                >
                  {undoReconciliationMutation.isPending ? 'Undoing...' : 'Undo reconciliation'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
      {exportError && (
        <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm print:hidden">{exportError}</div>
      )}

      {/* Phase 8: Undo reconciliation confirmation */}
      {showUndoConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 print:hidden">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Undo reconciliation</h3>
            <p className="text-sm text-gray-600 mb-4">
              This will clear all matches and reset sign-off. You will need to re-match transactions. This action cannot be undone.
            </p>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
            <input
              type="text"
              value={undoReason}
              onChange={(e) => setUndoReason(e.target.value)}
              placeholder="e.g. Data correction required"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setShowUndoConfirm(false); setUndoReason('') }}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => undoReconciliationMutation.mutate(undoReason.trim() || undefined)}
                disabled={undoReconciliationMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {undoReconciliationMutation.isPending ? 'Undoing...' : 'Confirm undo'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="print:hidden">
        <BrsHelp variant="report" />
      </div>
      {/* Five reports: explicit list for audit / presentation */}
      <p className="text-sm text-slate-600 print:hidden mb-2">
        This report contains: <strong>1.</strong> BRS Statement · <strong>2.</strong> Summary · <strong>3.</strong> Missing Cheques · <strong>4.</strong> Discrepancy · <strong>5.</strong> Supporting Documents
      </p>
      {/* Quick links to dedicated reports */}
      <nav className="flex flex-wrap gap-2 print:hidden">
        <a href="#brs-statement" className="px-3 py-1.5 text-sm rounded-lg bg-primary-100 text-primary-800 hover:bg-primary-200 font-medium">
          BRS Statement
        </a>
        <a href="#brs-summary" className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200">
          BRS Summary
        </a>
        <a href="#missing-cheques-report" className="px-3 py-1.5 text-sm rounded-lg bg-blue-50 text-blue-800 hover:bg-blue-100">
          Missing Cheques Report
        </a>
        <a href="#discrepancy-report" className="px-3 py-1.5 text-sm rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100">
          Discrepancy Report
        </a>
        <a href="#supporting-documents" className="px-3 py-1.5 text-sm rounded-lg bg-slate-50 text-slate-800 hover:bg-slate-100">
          Supporting Documents
        </a>
      </nav>

      <div id="brs-report" className="bg-white rounded-lg border border-slate-200 print:bg-white print:border-slate-300 overflow-x-auto min-w-0 font-sans print:text-black text-slate-800 shadow-sm">
        {/* Header — letterhead-style for premium/enterprise */}
        <div className="border-b border-slate-200 pb-4 mb-4">
          {data.organization?.branding?.logoUrl && !reportLogoLoadFailed && (
            <img
              src={getLogoDisplayUrl(data.organization.branding.logoUrl)}
              alt=""
              className="h-12 object-contain mb-2 max-w-[200px]"
              onError={() => setReportLogoLoadFailed(true)}
            />
          )}
          <h1
            className={`text-xl font-bold ${hasBranding ? '' : 'text-slate-800'}`}
            style={primaryColor ? { color: primaryColor } : undefined}
          >
            {organizationDisplayName}
          </h1>
          {data.organization?.branding?.letterheadAddress && (
            <p className="text-sm text-slate-600 mt-1">{data.organization.branding.letterheadAddress}</p>
          )}
          <p className="text-lg font-medium text-slate-700 mt-1">{data.project?.name}</p>
          {(data?.project?.status === 'completed') && (() => {
            const p = data.project
            return p?.approvedBy && p?.approvedAt ? (
              <div className="mt-2 px-3 py-1.5 rounded-lg bg-green-100 border border-green-300 inline-block print:bg-green-50 print:border-green-400">
                <span className="font-semibold text-green-800 print:text-green-900">Final report</span>
                <span className="text-green-700 print:text-green-800 text-sm ml-2">Approved {fmt(p.approvedAt)}</span>
              </div>
            ) : null
          })()}
          <p className="text-sm text-slate-500 mt-1">
            Generated {formatDate(data.generatedAt, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })} • {data.currency}
          </p>
          {data.reportLanguageProfile && (
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs text-primary-800">
              <span className="font-medium">{data.reportLanguageProfile?.label}</span>
              <span className="text-primary-600">({data.reportLanguageProfile?.code || 'GHANA_BRS_V1'})</span>
            </div>
          )}
          <div className="mt-2 text-xs text-slate-700 bg-gradient-to-r from-slate-50 to-white border border-slate-200 rounded-md px-3 py-2 shadow-sm">
            <p>
              Reconciled as at: <strong>{formatDateBRSTitle(reconciliationDate)}</strong>. Transactions posted after this reconciliation date are treated as post-period movements and are not part of the as-at matching position.
            </p>
            <p className="mt-1 text-sm font-medium text-slate-800">
              Report completed: <strong>{fmtDateTime(completionTimestamp)}</strong> · Print timestamp: <strong>{fmtDateTime(printTimestamp)}</strong>
            </p>
          </div>
          {(() => {
            const p = data.project
            if (!p?.preparedBy && !p?.reviewedBy && !p?.approvedBy) return null
            return (
              <div className="mt-4 pt-4 border-t border-slate-200 space-y-1 text-sm text-slate-600">
                {p.preparedBy && p.preparedAt && (
                  <p>Prepared by: <strong>{p.preparedBy.name || '—'}</strong> • {fmt(p.preparedAt)}</p>
                )}
                {p.reviewedBy && p.reviewedAt && (
                  <p>Reviewed by: <strong>{p.reviewedBy.name || '—'}</strong> • {fmt(p.reviewedAt)}</p>
                )}
                {p.approvedBy && p.approvedAt && (
                  <p>Approved by: <strong>{p.approvedBy.name || '—'}</strong> • {fmt(p.approvedAt)}</p>
                )}
              </div>
            )
          })()}
        </div>

        {/* BRS statement — two-column workbook layout (spreadsheet/manual style) */}
        {brsStatement && (
          <div id="brs-statement" className="mb-8 rounded-lg border border-slate-200 bg-white p-6 print:border-slate-300 print:bg-white">
            <p className="text-[15px] leading-snug text-slate-900">{organizationDisplayName}</p>
            <p className="mt-6 text-[15px] font-bold leading-snug text-slate-900">
              Bank Reconciliation Statement as at {formatDateBRSTitle(reconciliationDate)}
            </p>
            {accountReferenceLine ? (
              <p className="mt-3 text-[15px] font-bold leading-snug text-slate-900">{accountReferenceLine}</p>
            ) : null}
            <div className="mt-8 overflow-auto">
              <table className="w-full max-w-xl border-collapse text-sm text-slate-900">
                <tbody className="align-top">
                  <tr className="border-t border-b border-slate-200">
                    <td className="py-2 pr-6 text-slate-900">{labels.closingBankStatementBalance}</td>
                    <td className="py-2 pl-2 text-right text-base font-bold tabular-nums text-slate-900">
                      {fmtBaseReportAmt(brsStatement.bankClosingBalance)}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-2 pr-6 text-slate-900">{labels.addUncreditedLodgments}</td>
                    <td className="py-2 pl-2 text-right tabular-nums text-slate-900">
                      {fmtBrWorkbookMagnitudeAmt(brsStatement.uncreditedLodgmentsTimingTotal ?? brsStatement.uncreditedLodgmentsTotal)}
                    </td>
                  </tr>
                  {(brsStatement.timingUncreditedBroughtForwardPrior ?? 0) > 0.005 &&
                    typeof brsStatement.timingUncreditedCurrentPeriod === 'number' && (
                    <>
                      <tr className="border-b border-slate-100 bg-slate-50/80 print:bg-white">
                        <td className="py-1.5 pr-6 pl-3 text-xs text-slate-600">{labels.workbookCompositionTimingUncreditedCurrent}</td>
                        <td className="py-1.5 pl-2 text-right text-xs tabular-nums text-slate-700">
                          {fmtBrWorkbookMagnitudeAmt(brsStatement.timingUncreditedCurrentPeriod)}
                        </td>
                      </tr>
                      <tr className="border-b border-slate-200 bg-slate-50/80 print:bg-white">
                        <td className="py-1.5 pr-6 pl-3 text-xs text-slate-600">{labels.workbookCompositionTimingUncreditedPrior}</td>
                        <td className="py-1.5 pl-2 text-right text-xs tabular-nums text-slate-700">
                          {fmtBrWorkbookMagnitudeAmt(brsStatement.timingUncreditedBroughtForwardPrior ?? 0)}
                        </td>
                      </tr>
                    </>
                  )}
                  <tr className="border-b border-slate-200">
                    <td className="py-2 pr-6 text-slate-900">{labels.lessUnpresentedCheques}</td>
                    <td className="py-2 pl-2 text-right tabular-nums text-slate-900">
                      {fmtBrWorkbookMagnitudeAmt(brsStatement.unpresentedChequesTotal)}
                    </td>
                  </tr>
                  {(brsStatement.unpresentedBroughtForwardPrior ?? 0) > 0.005 &&
                    typeof brsStatement.unpresentedCurrentCashBookPeriod === 'number' && (
                    <>
                      <tr className="border-b border-slate-100 bg-slate-50/80 print:bg-white">
                        <td className="py-1.5 pr-6 pl-3 text-xs text-slate-600">{labels.workbookCompositionUnpresentedCurrent}</td>
                        <td className="py-1.5 pl-2 text-right text-xs tabular-nums text-slate-700">
                          {fmtBrWorkbookMagnitudeAmt(brsStatement.unpresentedCurrentCashBookPeriod)}
                        </td>
                      </tr>
                      <tr className="border-b border-slate-200 bg-slate-50/80 print:bg-white">
                        <td className="py-1.5 pr-6 pl-3 text-xs text-slate-600">{labels.workbookCompositionUnpresentedPrior}</td>
                        <td className="py-1.5 pl-2 text-right text-xs tabular-nums text-slate-700">
                          {fmtBrWorkbookMagnitudeAmt(brsStatement.unpresentedBroughtForwardPrior ?? 0)}
                        </td>
                      </tr>
                    </>
                  )}
                  <tr className="border-b border-slate-200">
                    <td className="py-2 pr-6 text-slate-900">{labels.addBankOnlyDebitsWorkbookLine}</td>
                    <td className="py-2 pl-2 text-right tabular-nums text-slate-900">
                      {fmtBrWorkbookMagnitudeAmt(brsStatement.bankOnlyDebitsNotInCashBookTotal ?? 0)}
                    </td>
                  </tr>
                  <tr className="border-b border-slate-200">
                    <td className="py-2 pr-6 text-slate-900">{labels.deductBankOnlyCreditsWorkbookLine}</td>
                    <td className="py-2 pl-2 text-right tabular-nums text-slate-900">
                      {fmtBrWorkbookMagnitudeAmt(brsStatement.bankOnlyCreditsNotInCashBookTotal ?? 0)}
                    </td>
                  </tr>
                  {(brsStatement.bankOnlyCreditsBroughtForwardPrior ?? 0) > 0.005 &&
                    typeof brsStatement.bankOnlyCreditsCurrentPeriod === 'number' && (
                    <>
                      <tr className="border-b border-slate-100 bg-slate-50/80 print:bg-white">
                        <td className="py-1.5 pr-6 pl-3 text-xs text-slate-600">{labels.workbookCompositionBankCreditsCurrent}</td>
                        <td className="py-1.5 pl-2 text-right text-xs tabular-nums text-slate-700">
                          {fmtBrWorkbookMagnitudeAmt(brsStatement.bankOnlyCreditsCurrentPeriod)}
                        </td>
                      </tr>
                      <tr className="border-b border-slate-200 bg-slate-50/80 print:bg-white">
                        <td className="py-1.5 pr-6 pl-3 text-xs text-slate-600">{labels.workbookCompositionBankCreditsPrior}</td>
                        <td className="py-1.5 pl-2 text-right text-xs tabular-nums text-slate-700">
                          {fmtBrWorkbookMagnitudeAmt(brsStatement.bankOnlyCreditsBroughtForwardPrior ?? 0)}
                        </td>
                      </tr>
                    </>
                  )}
                  <tr className="border-b border-slate-400">
                    <td className="py-2 pr-6 text-base font-bold text-slate-900">{labels.cashBookBalanceEnd}</td>
                    <td className="py-2 pl-2 text-right text-base font-bold tabular-nums text-slate-900">
                      {fmtBaseReportAmt(brsStatement.workbookScheduleDerivedCashBook ?? 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            {Math.abs(brsStatement.workbookScheduleTieOutVariance ?? 0) > 0.02 ? (
              <div className="mt-4 max-w-xl rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 print:bg-amber-50 print:border-amber-400">
                Workbook tie-out: declared cash book minus schedule =
                {' '}
                <strong>{fmtBaseReportAmt(brsStatement.workbookScheduleTieOutVariance ?? 0)}</strong>.
                Large variances usually mean duplicate cash-book exposure, mismatched reconciliation date, or a missing /
                overstated closing balance inputs — review mappings and extracted balances.
              </div>
            ) : null}
            <p className="mt-6 max-w-xl text-xs leading-relaxed text-slate-700">
              Note: timing items are transactions already in the cash book but not yet reflected by the bank at the
              reconciliation date. Bank-only items are transactions on the bank statement not yet recorded in the cash book.
              {((brsStatement.timingUncreditedBroughtForwardPrior ?? 0) > 0.005 ||
                (brsStatement.unpresentedBroughtForwardPrior ?? 0) > 0.005 ||
                (brsStatement.bankOnlyCreditsBroughtForwardPrior ?? 0) > 0.005) ?
                (
                  <>
                    {' '}
                    Rows labelled &quot;brought forward&quot; roll unmatched balances from the immediately preceding
                    reconciliation period (roll-forward project); they are part of the same workbook schedule, not
                    additional charges.
                  </>
                ) :
                null}
            </p>
            <div className="mt-8 max-w-xl space-y-4 text-sm text-slate-900 print:mt-10">
              <p>Checked By: _________________________________________</p>
              <p>Signed off By: _________________________________________</p>
              <p>Date: _________________________________________</p>
            </div>
          </div>
        )}

        {/* D1: Narrative (executive summary) */}
        {(data.narrative || editingComments) && (
          <div id="report-narrative" className="mb-6 p-4 rounded-lg border border-slate-200 bg-slate-50/50">
            <h3 className={`text-sm font-semibold mb-2 ${hasBranding ? '' : 'text-slate-700'}`} style={secondaryColor ? { color: secondaryColor } : undefined}>Summary</h3>
            {editingComments ? (
              <textarea
                value={editNarrative}
                onChange={(e) => setEditNarrative(e.target.value)}
                placeholder="Optional executive summary (e.g. This reconciliation shows…)"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-900 placeholder-slate-500 focus:ring-2 focus:ring-primary-500 min-h-[80px]"
                rows={3}
              />
            ) : (
              <p className="text-sm text-slate-700">{data.narrative}</p>
            )}
          </div>
        )}

        {/* D2: Bank statement closing balance, Preparer / Reviewer comments */}
        {((data?.project?.bankStatementClosingBalance != null) || data.preparerComment || data.reviewerComment || editingComments) && (
          <div className="mb-6 p-4 rounded-lg border border-slate-200 bg-slate-50/50 space-y-3">
            <h3 className={`text-sm font-semibold mb-2 ${hasBranding ? '' : 'text-slate-700'}`} style={secondaryColor ? { color: secondaryColor } : undefined}>Notes</h3>
            {editingComments ? (
              <>
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">As per bank statement (optional) — for audit comparison</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editBankStatementClosingBalance}
                    onChange={(e) => setEditBankStatementClosingBalance(e.target.value)}
                    placeholder="e.g. 3950.50"
                    className="w-full max-w-xs px-3 py-2 border border-border rounded-lg text-sm bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">Preparer note (optional)</label>
                  <textarea
                    value={editPreparerComment}
                    onChange={(e) => setEditPreparerComment(e.target.value)}
                    placeholder="Preparer notes…"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-primary-500 min-h-[60px]"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">Reviewer note (optional)</label>
                  <textarea
                    value={editReviewerComment}
                    onChange={(e) => setEditReviewerComment(e.target.value)}
                    placeholder="Reviewer notes…"
                    className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-primary-500 min-h-[60px]"
                    rows={2}
                  />
                </div>
                <div className="flex gap-2 print:hidden">
                  <button
                    type="button"
                    onClick={() => updateCommentsMutation.mutate({
                      reportNarrative: editNarrative || undefined,
                      preparerComment: editPreparerComment || undefined,
                      reviewerComment: editReviewerComment || undefined,
                      bankStatementClosingBalance: editBankStatementClosingBalance.trim() === '' ? null : (Number.isFinite(parseFloat(editBankStatementClosingBalance)) ? parseFloat(editBankStatementClosingBalance) : null),
                    })}
                    disabled={updateCommentsMutation.isPending}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
                  >
                    {updateCommentsMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingComments(false)}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg border border-border text-gray-700 hover:bg-surface"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-2 text-sm text-slate-700">
                {data.preparerComment && <p><span className="font-medium text-slate-600">Preparer:</span> {data.preparerComment}</p>}
                {data.reviewerComment && <p><span className="font-medium text-slate-600">Reviewer:</span> {data.reviewerComment}</p>}
              </div>
            )}
          </div>
        )}

        {canExportReport(role) && !editingComments && (
          <div className="mb-6 print:hidden">
            <button
              type="button"
              onClick={startEditingComments}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Edit summary & notes
            </button>
          </div>
        )}

        {/* Summary */}
        {showExtendedSections && <div id="brs-summary" className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 scroll-mt-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm text-green-700 font-medium">Matched</p>
            <p className="text-lg font-bold text-green-800">{data.summary?.matchedCount || 0}</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-700 font-medium">Unmatched receipts</p>
            <p className="text-lg font-bold text-amber-800">{data.summary?.unmatchedReceipts || 0}</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-700 font-medium">Unmatched payments</p>
            <p className="text-lg font-bold text-amber-800">{data.summary?.unmatchedPayments || 0}</p>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
            <p className="text-sm text-slate-700 font-medium">Currency</p>
            <p className="text-lg font-bold text-slate-800">{effectiveDisplayCurrency}</p>
          </div>
        </div>}
        {showExtendedSections && !!sourceFilterLogic && canViewDiagnostics && (
          <div className="mb-6 rounded-lg border border-slate-200 p-4 bg-slate-50/60">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium text-slate-800">Source filter logic (sign diagnostics)</h3>
              <button
                type="button"
                onClick={() => setShowDiagnostics((v) => !v)}
                className="text-xs px-2 py-1 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                {showDiagnostics ? 'Hide diagnostics' : 'Show diagnostics'}
              </button>
            </div>
            {!showDiagnostics ? (
              <p className="text-xs text-slate-600 mt-2">Hidden for cleaner report view. Expand to inspect sign/data quality diagnostics.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm mt-3">
                {[
                  { label: 'Cash book receipts', stats: sourceFilterLogic.cashBookReceipts },
                  { label: 'Cash book payments', stats: sourceFilterLogic.cashBookPayments },
                  { label: 'Bank statement debits', stats: sourceFilterLogic.bankStatementDebits },
                  { label: 'Bank statement credits', stats: sourceFilterLogic.bankStatementCredits },
                ].map(({ label, stats }, i) => (
                  <div key={i} className="rounded border border-slate-200 bg-white p-3">
                    <p className="font-medium text-slate-700 mb-1">{label}</p>
                    <p className="text-xs text-slate-600">Primary: {stats?.primary ?? 0} · Cross-ref: {stats?.cross_reference ?? 0} · Zero: {stats?.zero ?? 0} · Empty: {stats?.empty ?? 0}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {showExtendedSections && <div className="mb-6 rounded-xl border border-primary-200 bg-primary-50/40 p-4 print:bg-white print:border-slate-300">
          <h3 className="font-semibold text-primary-900 mb-2">{labels.additionalInformationTitle}</h3>
          <p className="text-sm text-primary-800 mb-3">
            This section separates the reconciliation position as at the reconciliation date from post-period movement carried into this report.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-primary-100 bg-white p-3 overflow-auto">
              <p className="font-medium text-primary-900 mb-2">{labels.asAtReconciliationPosition}</p>
              <p className="text-xs text-primary-700 mb-2">
                As-at totals show differences existing on the reconciliation date.
              </p>
              <table className="min-w-full text-sm text-primary-900">
                <thead className="bg-primary-50 print:bg-slate-100">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Description</th>
                    <th className="px-2 py-1.5 text-right">Amount ({effectiveDisplayCurrency})</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-primary-100">
                    <td className="px-2 py-1.5">{labels.uncreditedLodgmentsOrUnclearedDeposits}</td>
                    <td className="px-2 py-1.5 text-right font-semibold">{fmtSignedReportAmt(asAtUncreditedTotal)}</td>
                  </tr>
                  <tr className="border-t border-primary-100 bg-primary-50/40 print:bg-white">
                    <td className="px-2 py-1.5">{labels.unpresentedChequesOrUnclearedPayments}</td>
                    <td className="px-2 py-1.5 text-right font-semibold">{fmtSignedReportAmt(-Math.abs(asAtUnpresentedTotal), { forceNegative: true })}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="rounded-lg border border-primary-100 bg-white p-3 overflow-auto">
              <p className="font-medium text-primary-900 mb-2">{labels.postPeriodMovement}</p>
              <p className="text-xs text-primary-700 mb-2">
                Post-period movement shows prior-period items carried into this period.
              </p>
              <table className="min-w-full text-sm text-primary-900">
                <thead className="bg-primary-50 print:bg-slate-100">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Description</th>
                    <th className="px-2 py-1.5 text-right">Amount ({effectiveDisplayCurrency})</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-primary-100">
                    <td className="px-2 py-1.5">{labels.broughtForwardUncreditedLodgments}</td>
                    <td className="px-2 py-1.5 text-right font-semibold">{fmtSignedReportAmt(postPeriodLodgmentsTotal)}</td>
                  </tr>
                  <tr className="border-t border-primary-100 bg-primary-50/40 print:bg-white">
                    <td className="px-2 py-1.5">{labels.broughtForwardUnpresentedCheques}</td>
                    <td className="px-2 py-1.5 text-right font-semibold">{fmtSignedReportAmt(-Math.abs(postPeriodChequesTotal), { forceNegative: true })}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>}


        {/* Phase 6: Missing Cheques Report — single section id for anchor linking */}
        <div id="missing-cheques-report" className="mb-6 scroll-mt-4">
          {features.missing_cheques_report ? (
            <>
              <h3 className="text-base font-semibold mb-3 text-blue-900">Missing Cheques Report (Unpresented cheques with ageing)</h3>
              {(data.missingChequesWithAgeing || []).length > 0 ? (
                <>
                  {data.missingChequesAgeingSummary && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                      {(['band0_30', 'band31_60', 'band61_90', 'band90_plus'] as const).map((k) => {
                        const s = data.missingChequesAgeingSummary?.[k]
                        if (!s || s.count === 0) return null
                        const labels: Record<string, string> = { band0_30: '0–30 days', band31_60: '31–60 days', band61_90: '61–90 days', band90_plus: '90+ days' }
                        return (
                          <div key={k} className="bg-blue-50 border border-blue-200 rounded-lg p-2 print:bg-white print:border-slate-300">
                            <p className="text-xs text-blue-700">{labels[k]}</p>
                            <p className="text-sm font-bold text-blue-900">{s.count} cheques • {fmtSignedReportAmt(s.total)}</p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                  <div className="border border-blue-200 rounded-lg overflow-auto max-h-48 print:border-slate-300">
                    <table className="min-w-full text-sm text-slate-900">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="px-2 py-1.5 text-left">Date</th>
                          <th className="px-2 py-1.5 text-left">Cheque No</th>
                          <th className="px-2 py-1.5 text-left">Name</th>
                          <th className="px-2 py-1.5 text-right">Amount ({effectiveDisplayCurrency})</th>
                          <th className="px-2 py-1.5 text-right">Days Outstanding</th>
                          <th className="px-2 py-1.5 text-center">Ageing Band</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.missingChequesWithAgeing || []).map((t, i) => (
                          <tr key={i} className={`border-t border-slate-200 ${i % 2 === 1 ? 'bg-slate-50/60' : ''}`}>
                            <td className="px-2 py-1.5">{fmt(t.date)}</td>
                            <td className="px-2 py-1.5 font-mono text-gray-600">{t.chqNo || '—'}</td>
                            <td className="px-2 py-1.5 truncate max-w-[120px]" title={t.name}>{t.name}</td>
                            <td className="px-2 py-1.5 text-right font-medium">{fmtSignedReportAmt(t.amount)}</td>
                            <td className="px-2 py-1.5 text-right">{t.daysOutstanding}</td>
                            <td className="px-2 py-1.5 text-center">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                t.ageingBand === '0–30' ? 'bg-green-100 text-green-800' :
                                t.ageingBand === '31–60' ? 'bg-amber-100 text-amber-800' :
                                t.ageingBand === '61–90' ? 'bg-primary-100 text-primary-800' :
                                'bg-red-100 text-red-800'
                              }`}>{t.ageingBand} days</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500">No unpresented cheques.</p>
              )}
            </>
          ) : (
            <>
              <h3 className="text-base font-semibold mb-3 text-blue-900">Missing Cheques Report</h3>
              <p className="text-sm text-amber-600">Missing cheques report requires Standard plan or higher. Upgrade to see unpresented cheques with ageing bands.</p>
            </>
          )}
        </div>



        {/* Exceptions — BRS sections */}
        <div className="flex flex-col gap-6">
          {/* 1. Uncredited Lodgments: final format uses cash-book receipts only */}
          <div className="rounded-xl border border-green-200 bg-green-50/30 p-5 print:bg-white print:border-slate-300">
            <h3 className="font-semibold mb-3 text-green-900">1. UNCREDITED LODGMENTS</h3>
            <p className="text-sm text-green-800 mb-4">
              Items to add to bank balance: unmatched receipts in cash book (deposits not yet credited by bank).
            </p>
          <div>
            <h4 className="text-sm font-medium mb-2 text-gray-800">1a. Unmatched receipts in cash book (deposits not yet in bank)</h4>
            <div className="border border-slate-200 rounded-lg overflow-auto max-h-48">
              <table className="min-w-full text-sm text-slate-900">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Date</th>
                    <th className="px-2 py-1.5 text-left">Details</th>
                    <th className="px-2 py-1.5 text-right">Amount ({effectiveDisplayCurrency})</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.unmatchedReceipts || []).length === 0 ? (
                    <tr><td colSpan={3} className="px-2 py-4 text-center text-gray-500">None</td></tr>
                  ) : (
                    (data.unmatchedReceipts || []).map((t, i: number) => (
                      <tr key={i} className={`border-t border-slate-200 ${i % 2 === 1 ? 'bg-slate-50/60' : ''}`}>
                        <td className="px-2 py-1.5">{fmt(t.date)}</td>
                        <td className="px-2 py-1.5 truncate max-w-[220px]" title={`${t.name || ''} ${t.details || ''}`}>{t.name || t.details || '—'}</td>
                        <td className="px-2 py-1.5 text-right font-medium">{fmtSignedReportAmt(t.amountReceived ?? t.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {(data.unmatchedReceipts || []).length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 bg-slate-50/80">
                      <td colSpan={2} className="px-2 py-1.5 font-semibold text-slate-700">Subtotal (unmatched receipts)</td>
                      <td className="px-2 py-1.5 text-right font-semibold text-slate-900">{fmtSignedReportAmt((data.unmatchedReceipts || []).reduce((s: number, t: { amount: number }) => s + t.amount, 0))}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-green-200">
            <div className="border border-slate-200 rounded-lg overflow-auto">
              <table className="min-w-full text-sm text-slate-900">
                <tbody>
                  <tr className="border-t-2 border-green-300 bg-green-50/70">
                    <td colSpan={2} className="px-2 py-1.5 font-bold text-green-900">TOTAL UNCREDITED LODGMENTS (FOR BRS ADD LINE)</td>
                    <td className="px-2 py-1.5 text-right font-bold text-green-900">
                      {fmtBrWorkbookMagnitudeAmt(brsStatement?.uncreditedLodgmentsTimingTotal ?? brsStatement?.uncreditedLodgmentsTotal ?? 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          </div>

          {/* 2. Unpresented Cheques: Unmatched payments (cash book) + Brought forward */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-5 print:bg-white print:border-slate-300">
            <h3 className="font-semibold mb-3 text-blue-900">2. UNPRESENTED CHEQUES</h3>
            <p className="text-sm text-blue-800 mb-4">
              Items to deduct from bank balance: unmatched payments in cash book (cheques issued not yet presented) and brought-forward unpresented cheques from previous period.
            </p>
          <div>
            <h4 className="text-sm font-medium mb-2 text-gray-800">2a. Unmatched payments in cash book (payments not yet in bank)</h4>
            <div className="border border-slate-200 rounded-lg overflow-auto max-h-48">
              <table className="min-w-full text-sm text-slate-900">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Date</th>
                    <th className="px-2 py-1.5 text-left">Details</th>
                    <th className="px-2 py-1.5 text-right">Amount ({effectiveDisplayCurrency})</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.unmatchedPayments || []).length === 0 ? (
                    <tr><td colSpan={3} className="px-2 py-4 text-center text-gray-500">None</td></tr>
                  ) : (
                    (data.unmatchedPayments || []).map((t, i: number) => (
                      <tr key={i} className={`border-t border-slate-200 ${i % 2 === 1 ? 'bg-slate-50/60' : ''}`}>
                        <td className="px-2 py-1.5">{fmt(t.date)}</td>
                        <td className="px-2 py-1.5 truncate max-w-[220px]" title={`${t.name || ''} ${t.details || ''}`}>{t.name || t.details || '—'}</td>
                        <td className="px-2 py-1.5 text-right font-medium">{fmtSignedReportAmt(t.amountPaid ?? t.amount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {(data.unmatchedPayments || []).length > 0 && (
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 bg-slate-50/80">
                      <td colSpan={2} className="px-2 py-1.5 font-semibold text-slate-700">Subtotal (unmatched payments)</td>
                      <td className="px-2 py-1.5 text-right font-semibold text-slate-900">{fmtSignedReportAmt((data.unmatchedPayments || []).reduce((s: number, t: { amount: number }) => s + t.amount, 0))}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
          {(data.broughtForwardItems || []).length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2 text-gray-800">2b. Brought forward from previous period BRS</h4>
              <p className="text-xs text-gray-600 mb-2">Shown in the table above (Brought forward unpresented cheques section)</p>
              <div className="border border-slate-200 rounded-lg overflow-auto">
                <table className="min-w-full text-sm text-slate-900">
                  <tbody>
                    <tr className="border-t-2 border-slate-300 bg-slate-50/80">
                      <td colSpan={2} className="px-2 py-1.5 font-semibold text-slate-700">Subtotal (brought forward)</td>
                      <td className="px-2 py-1.5 text-right font-semibold text-slate-900">{fmtSignedReportAmt((data.broughtForwardItems || []).reduce((s: number, t: { amount: number }) => s + t.amount, 0))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-blue-200">
            <div className="border border-slate-200 rounded-lg overflow-auto">
              <table className="min-w-full text-sm text-slate-900">
                <tbody>
                  <tr className="border-t-2 border-blue-300 bg-blue-50/70">
                    <td colSpan={2} className="px-2 py-1.5 font-bold text-blue-900">Total Unpresented Cheques (for BRS Less line — magnitude)</td>
                    <td className="px-2 py-1.5 text-right font-bold text-blue-900">
                      {fmtBrWorkbookMagnitudeAmt(brsStatement?.unpresentedChequesTotal ?? 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          </div>
          {/* 3. Bank-only items */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-5 print:bg-white print:border-slate-300">
            <h3 className="font-semibold mb-3 text-amber-900">3. BANK-ONLY ITEMS</h3>
            <p className="text-sm text-amber-800 mb-4">
              Transactions appearing on the bank statement that are not yet recorded in the cash book.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium mb-2 text-gray-800">3a. Bank-only debits (Add)</h4>
                <div className="border border-slate-200 rounded-lg overflow-auto max-h-48">
                  <table className="min-w-full text-sm text-slate-900">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-2 py-1.5 text-left">Date</th>
                        <th className="px-2 py-1.5 text-left">Description</th>
                        <th className="px-2 py-1.5 text-right">Amount ({effectiveDisplayCurrency})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.unmatchedDebits || []).length === 0 ? (
                        <tr><td colSpan={3} className="px-2 py-4 text-center text-gray-500">None</td></tr>
                      ) : (
                        (data.unmatchedDebits || []).map((t: any, i: number) => (
                          <tr key={i} className={`border-t border-slate-200 ${i % 2 === 1 ? 'bg-slate-50/60' : ''}`}>
                            <td className="px-2 py-1.5">{fmt(t.date)}</td>
                            <td className="px-2 py-1.5 truncate max-w-[180px]" title={t.description}>{t.description}</td>
                            <td className="px-2 py-1.5 text-right font-medium">{fmtSignedReportAmt(t.amount)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium mb-2 text-gray-800">3b. Bank-only credits (Deduct)</h4>
                <div className="border border-slate-200 rounded-lg overflow-auto max-h-48">
                  <table className="min-w-full text-sm text-slate-900">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-2 py-1.5 text-left">Date</th>
                        <th className="px-2 py-1.5 text-left">Description</th>
                        <th className="px-2 py-1.5 text-right">Amount ({effectiveDisplayCurrency})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(data.unmatchedCredits || []).length === 0 ? (
                        <tr><td colSpan={3} className="px-2 py-4 text-center text-gray-500">None</td></tr>
                      ) : (
                        (data.unmatchedCredits || []).map((t: any, i: number) => (
                          <tr key={i} className={`border-t border-slate-200 ${i % 2 === 1 ? 'bg-slate-50/60' : ''}`}>
                            <td className="px-2 py-1.5">{fmt(t.date)}</td>
                            <td className="px-2 py-1.5 truncate max-w-[180px]" title={t.description}>{t.description}</td>
                            <td className="px-2 py-1.5 text-right font-medium">{fmtSignedReportAmt(t.amount)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Phase 7: Supporting documents */}
        <div id="supporting-documents" className="mt-6 scroll-mt-4">
          <h3 className={`font-semibold mb-2 ${hasBranding ? '' : 'text-slate-700'}`} style={secondaryColor ? { color: secondaryColor } : undefined}>Supporting documents</h3>
          <p className="text-sm text-gray-500 mb-3">
            Bank statement PDFs, approval scans, and other attachments. (Source data for the BRS comes from the Upload step: cash book and bank statement files.)
          </p>
          {canUploadDocuments(role) && (
            <div className="mb-4 print:hidden">
              <label className="block text-sm font-medium text-gray-700 mb-1">Upload attachment</label>
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  value={attachmentType}
                  onChange={(e) => setAttachmentType(e.target.value as 'bank_statement' | 'approval' | 'other')}
                  className="px-3 py-2 border border-border rounded-lg bg-white text-gray-900 text-sm focus:ring-2 focus:ring-primary-500"
                >
                  <option value="other">Type: Other</option>
                  <option value="bank_statement">Type: Bank statement</option>
                  <option value="approval">Type: Approval</option>
                </select>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.tiff"
                  className="text-sm text-gray-600 file:mr-2 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-primary-100 file:text-primary-700 hover:file:bg-primary-200"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    attachmentUploadMutation.mutate({ file, type: attachmentType })
                    e.target.value = ''
                  }}
                  disabled={attachmentUploadMutation.isPending}
                />
                {attachmentUploadMutation.isPending && <span className="text-sm text-gray-500">Uploading...</span>}
              </div>
            </div>
          )}
          {attachmentsList.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No supporting documents attached.</p>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-auto shadow-card">
              <table className="min-w-full text-sm text-slate-900">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left text-slate-700 font-medium tracking-wider">Filename</th>
                    <th className="px-3 py-2 text-left text-slate-700 font-medium tracking-wider">Type</th>
                    <th className="px-3 py-2 text-left text-slate-700 font-medium tracking-wider">Uploaded</th>
                    <th className="px-3 py-2 text-right text-slate-700 font-medium tracking-wider print:hidden">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {attachmentsList.map((a: { id: string; filename: string; type: string; createdAt: string; user?: { name?: string } }, i: number) => (
                    <tr key={a.id} className={`border-t border-slate-200 ${i % 2 === 1 ? 'bg-slate-50/60' : ''}`}>
                      <td className="px-3 py-2 truncate max-w-[200px]" title={a.filename}>{a.filename}</td>
                      <td className="px-3 py-2 capitalize">{a.type.replace('_', ' ')}</td>
                      <td className="px-3 py-2 text-slate-600">{fmt(a.createdAt)}</td>
                      <td className="px-3 py-2 text-right print:hidden">
                        <button
                          type="button"
                          onClick={() => attachments.download(a.id, a.filename).catch((err) => setExportError(err instanceof Error ? err.message : 'Download failed'))}
                          className="text-primary-600 hover:text-primary-700 font-medium"
                        >
                          Download
                        </button>
                        {canDeleteAttachment(role) && (
                          <>
                            <span className="mx-2 text-gray-300">|</span>
                            <button
                              type="button"
                              onClick={() => attachmentDeleteMutation.mutate(a.id)}
                              disabled={attachmentDeleteMutation.isPending}
                              className="text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* INTERNAL AUDIT WORKING PAPERS */}
        <div className="mt-12 pt-8 border-t-2 border-dashed border-slate-300 print:mt-8 print:pt-4">
          <h2 className="text-xl font-bold mb-4 text-slate-800 flex items-center gap-2">
            <span className="p-1 bg-slate-100 rounded">📋</span>
            INTERNAL AUDIT WORKING PAPERS (DIAGNOSTICS)
          </h2>
          <p className="text-sm text-slate-600 mb-6 italic">
            This section contains internal reconciliation working papers, matched audit logs, and diagnostic reports. It is intended for internal review and audit trail validation.
          </p>

          {/* Matched pairs */}
          <div className="mb-8">
            <h3 className="text-base font-semibold mb-3 text-slate-900">Matched transactions (Audit Log)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
              <div className="text-xs rounded border border-green-200 bg-green-50 px-2 py-1 text-green-800">
                Receipts vs credits matched: {matchedReceiptsVsCredits.length}
              </div>
              <div className="text-xs rounded border border-blue-200 bg-blue-50 px-2 py-1 text-blue-800">
                Payments vs debits matched: {matchedPaymentsVsDebits.length}
              </div>
            </div>
            <div className="border border-slate-200 rounded-lg overflow-auto max-h-64 shadow-sm bg-white">
              <table className="min-w-full text-sm text-slate-900">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-slate-700">Cash book</th>
                    <th className="px-3 py-2 text-right text-slate-700">CB Amt ({effectiveDisplayCurrency})</th>
                    <th className="px-3 py-2 text-left text-slate-700">Bank</th>
                    <th className="px-3 py-2 text-right text-slate-700">Bank Amt ({effectiveDisplayCurrency})</th>
                    <th className="px-3 py-2 text-right text-slate-700">Var. ({effectiveDisplayCurrency})</th>
                  </tr>
                </thead>
                <tbody>
                  {matchedPairs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-gray-500 italic">No matched transactions in this period.</td>
                    </tr>
                  ) : (
                    matchedPairs.map((p, i: number) => (
                      <tr key={i} className={`border-t border-slate-100 ${i % 2 === 1 ? 'bg-slate-50/30' : ''}`}>
                        <td className="px-3 py-2 max-w-[200px] truncate" title={`${fmt(p.cbDate)} • ${p.cbName}`}>
                          {fmt(p.cbDate)} • {p.cbName}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {fmtSignedReportAmt((p.cbAmountReceived ?? p.cbAmountPaid ?? p.cbAmount ?? 0) as number)}
                        </td>
                        <td className="px-3 py-2 max-w-[200px] truncate" title={`${fmt(p.bankDate)} • ${p.bankDescription}`}>
                          {fmt(p.bankDate)} • {p.bankDescription}
                        </td>
                        <td className="px-3 py-2 text-right font-medium">{fmtSignedReportAmt(p.bankAmount)}</td>
                        <td className="px-3 py-2 text-right font-medium text-amber-700">
                          {fmtSignedReportAmt(Math.abs(((p.cbAmountReceived ?? p.cbAmountPaid ?? p.cbAmount ?? 0) as number) - p.bankAmount))}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Phase 6: Reconciliation Discrepancy Report */}
          <div id="discrepancy-report-audit" className="mb-8 scroll-mt-4">
            <h3 className="text-base font-semibold mb-3 text-amber-900">Reconciliation Discrepancy Report</h3>
            {features.discrepancy_report ? (
              (data?.discrepancies || []).length > 0 ? (
                <>
                  <p className="text-sm text-gray-500 mb-2">Matched pairs with amount or date variance detected during reconciliation.</p>
                  <div className="border border-amber-200 rounded-lg overflow-auto max-h-64 shadow-sm bg-white">
                    <table className="min-w-full text-sm text-slate-900">
                      <thead className="bg-amber-50">
                        <tr>
                          <th className="px-2 py-1.5 text-left">Cash book</th>
                          <th className="px-2 py-1.5 text-right">CB Amt ({effectiveDisplayCurrency})</th>
                          <th className="px-2 py-1.5 text-left">Bank</th>
                          <th className="px-2 py-1.5 text-right">Bank Amt ({effectiveDisplayCurrency})</th>
                          <th className="px-2 py-1.5 text-right text-amber-800 font-bold">Variance ({effectiveDisplayCurrency})</th>
                          <th className="px-2 py-1.5 text-right text-gray-600">Date diff</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(data.discrepancies || []).map((d: any, i: number) => (
                          <tr key={i} className={`border-t border-amber-100 ${i % 2 === 1 ? 'bg-amber-50/20' : ''}`}>
                            <td className="px-2 py-1.5 truncate max-w-[150px]" title={d.cbName}>{fmt(d.cbDate)} • {d.cbName}</td>
                            <td className="px-2 py-1.5 text-right">{fmtSignedReportAmt(d.cbAmountReceived ?? d.cbAmountPaid ?? d.cbAmount ?? 0)}</td>
                            <td className="px-2 py-1.5 truncate max-w-[150px]" title={d.bankDescription}>{fmt(d.bankDate)} • {d.bankDescription}</td>
                            <td className="px-2 py-1.5 text-right">{fmtSignedReportAmt(d.bankAmount)}</td>
                            <td className="px-2 py-1.5 text-right font-bold text-amber-700">{fmtSignedReportAmt(d.amountVariance)}</td>
                            <td className="px-2 py-1.5 text-right text-gray-600">{d.dateVarianceDays?.toFixed(0) ?? 0} days</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500 italic">No amount or date variances in matched pairs.</p>
              )
            ) : (
              <p className="text-sm text-amber-600 italic">Discrepancy report requires Standard plan or higher.</p>
            )}
          </div>

          {/* Reversal candidates */}
          <div className="mb-6">
            <h3 className="text-base font-semibold mb-3 text-primary-900">Reversal candidates</h3>
            {(data.reversalCandidates || []).length > 0 ? (
              <div className="border border-primary-100 rounded-lg overflow-auto max-h-48 shadow-sm bg-white">
                <table className="min-w-full text-sm text-slate-900">
                  <thead className="bg-primary-50">
                    <tr>
                      <th className="px-2 py-1.5 text-left">Reference key</th>
                      <th className="px-2 py-1.5 text-left">Stream</th>
                      <th className="px-2 py-1.5 text-right">Amount ({effectiveDisplayCurrency})</th>
                      <th className="px-2 py-1.5 text-left">Incoming entry</th>
                      <th className="px-2 py-1.5 text-left">Outgoing entry</th>
                      <th className="px-2 py-1.5 text-right">Day diff</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.reversalCandidates || []).map((r: any, i: number) => (
                      <tr key={i} className={`border-t border-primary-50 ${i % 2 === 1 ? 'bg-primary-50/10' : ''}`}>
                        <td className="px-2 py-1.5 font-mono text-xs">{r.reference}</td>
                        <td className="px-2 py-1.5 text-xs">{r.stream === 'cash_book' ? 'Cash book' : 'Bank'}</td>
                        <td className="px-2 py-1.5 text-right font-medium">{fmtSignedReportAmt(r.amount)}</td>
                        <td className="px-2 py-1.5">{r.incomingDate ? `${fmt(r.incomingDate)} • ${r.incomingNarration || '—'}` : '—'}</td>
                        <td className="px-2 py-1.5">{r.outgoingDate ? `${fmt(r.outgoingDate)} • ${r.outgoingNarration || '—'}` : '—'}</td>
                        <td className="px-2 py-1.5 text-right">{r.dayDiff}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No reversal candidates detected.</p>
            )}
          </div>
        </div>

        {data.organization?.branding?.footer && (
          <div className="mt-8 pt-4 border-t border-slate-200 text-center text-sm text-slate-600">
            {data.organization.branding.footer as string}
          </div>
        )}
        <div className="mt-6 pt-4 border-t border-slate-200 text-center text-xs text-slate-500 print:text-slate-600">
          Generated {formatDate(data.generatedAt, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })} · Currency: {currency}
          {typeof data.currency === 'string' && (
            <span> · For audit purposes retain supporting documents.</span>
          )}
        </div>
      </div>
    </div>
  )
}
