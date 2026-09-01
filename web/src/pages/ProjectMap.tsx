import { useState, useEffect, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  projects,
  documents,
  report,
  settings,
  type MapDocumentResponse,
  type DocumentPreviewResponse,
  type SignBucket,
  isSubscriptionInactiveError,
  unlessSubscriptionInactive,
} from '../lib/api'
import {
  buildSmartSuggestedMapping,
  getMappingConfidence,
  type MappingConfidence,
} from '@brs/suggested-mapping'
import { useAuth } from '../store/auth'
import { canExportReport, isProjectEditable } from '../lib/permissions'
import ProjectLockedBanner from '../components/project/ProjectLockedBanner'
import { useToast } from '../components/ui/Toast'
import { useConfirm } from '../components/ui/ConfirmDialog'
import Button from '../components/ui/Button'
import Alert from '../components/ui/Alert'
import Badge from '../components/ui/Badge'
import Card from '../components/ui/Card'
import Select from '../components/ui/Select'
import { Table, TableHead, TableBody, TableRow, TableTh, TableTd } from '../components/ui/Table'
import { PageBodySkeleton } from '../components/ui/Skeleton'
import SubscriptionRenewalPanel from '../components/SubscriptionRenewalPanel'
import WorkflowStepIntro from '../components/project/WorkflowStepIntro'
import WorkflowStepSkeleton from '../components/project/WorkflowStepSkeleton'
import { getMappingIssues, fieldLabel } from '../lib/mappingHints'
import { DEFAULT_PDF_OCR_MAX_PAGES, SIGN_WARNINGS_PREVIEW_MAX } from '../lib/importLimits'

function confidenceTone(level: MappingConfidence): 'success' | 'warning' | 'neutral' {
  if (level === 'high') return 'success'
  if (level === 'medium') return 'warning'
  return 'neutral'
}

const CASH_BOOK_FIELDS = ['date', 'name', 'details', 'doc_ref', 'chq_no', 'accode', 'amt_received', 'amt_paid']
const BANK_FIELDS = ['transaction_date', 'description', 'credit', 'debit']

type PreviewLike = Pick<DocumentPreviewResponse, 'headers' | 'suggestedMapping'>

function mergedSuggestedFromPreview(
  headers: string[],
  isCashBook: boolean,
  pre: PreviewLike
): Record<string, number> {
  const existing =
    pre.suggestedMapping && Object.keys(pre.suggestedMapping).length > 0
      ? { ...pre.suggestedMapping }
      : {}
  return buildSmartSuggestedMapping(headers || [], isCashBook, existing)
}

function suggestedMappingHasDate(headers: string[], isCashBook: boolean, pre: PreviewLike): boolean {
  const sug = mergedSuggestedFromPreview(headers, isCashBook, pre)
  const dateField = isCashBook ? 'date' : 'transaction_date'
  return sug[dateField] != null
}

/** For Excel: server-picked worksheet when omitted; else first sheet with date column. */
async function resolveBestSheetPreview(
  docId: string,
  _isCashBook: boolean
): Promise<{ chosenSheet: number; preview: DocumentPreviewResponse }> {
  const pre = await documents.preview(docId)
  return { chosenSheet: pre.sheetIndex ?? 0, preview: pre }
}

/** Same as {@link resolveBestSheetPreview} but reuses an already-fetched sheet-0 preview (fewer round trips). */
async function resolveBestSheetFromPre0(
  docId: string,
  isCashBook: boolean,
  pre0: DocumentPreviewResponse
): Promise<number> {
  const names = pre0.sheetNames ?? []
  if (names.length <= 1) return 0
  if (suggestedMappingHasDate(pre0.headers || [], isCashBook, pre0)) return 0
  for (let si = 1; si < names.length; si++) {
    const p = await documents.preview(docId, { sheetIndex: si })
    if (suggestedMappingHasDate(p.headers || [], isCashBook, p)) return si
  }
  return 0
}

type ProjectMapProps = { projectId: string; canMap?: boolean; onProceedToReconcile?: () => void }

export default function ProjectMap({ projectId, canMap = true, onProceedToReconcile }: ProjectMapProps) {
  const id = projectId
  const role = useAuth((s) => s.role)
  const toast = useToast()
  const confirm = useConfirm()
  const queryClient = useQueryClient()
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [previewSheetIndex, setPreviewSheetIndex] = useState(0)
  const [sheetIndexExplicit, setSheetIndexExplicit] = useState(false)
  const [mapping, setMapping] = useState<Record<string, number>>({})
  const [error, setError] = useState('')
  const [mapResult, setMapResult] = useState<MapDocumentResponse | null>(null)
  /** Bumps when the user picks another document so stale worksheet auto-pick async exits early. */
  const worksheetPickSessionRef = useRef(0)
  /** Prevents re-running Excel worksheet scans for the same document when nothing changes. */
  const worksheetPickResolvedRef = useRef<string | null>(null)

  const projectQuery = useQuery({
    queryKey: ['project', id],
    queryFn: () => projects.get(id!),
    enabled: !!id,
    refetchInterval: (q) => {
      const docs = (q.state.data as { documents?: { parseStatus?: string }[] } | undefined)?.documents
      if (!docs?.length) return false
      const inflight = docs.some((d) => d.parseStatus === 'pending' || d.parseStatus === 'processing')
      return inflight ? 2000 : false
    },
  })
  const { data: project, error: projectError, isError: projectQueryFailed, isPending: projectPending } = projectQuery

  const previewQuery = useQuery({
    queryKey: ['document-preview', selectedDocId, previewSheetIndex, sheetIndexExplicit],
    queryFn: () =>
      documents.preview(
        selectedDocId!,
        sheetIndexExplicit ? { sheetIndex: previewSheetIndex } : undefined
      ),
    enabled: !!selectedDocId,
  })
  const {
    data: preview,
    isLoading: previewLoading,
    error: previewError,
    isError: previewQueryFailed,
  } = previewQuery

  const paywallBlocked =
    isSubscriptionInactiveError(projectError) || isSubscriptionInactiveError(previewError)

  const mapMutation = useMutation({
    mutationFn: (docId: string) =>
      documents.map(docId, { mapping, sheetIndex: previewSheetIndex }),
    onSuccess: (data: MapDocumentResponse) => {
      queryClient.invalidateQueries({ queryKey: ['project', id] })
      queryClient.invalidateQueries({ queryKey: ['subscription', 'usage'] })
      setSelectedDocId(null)
      setMapping({})
      setError('')
      setMapResult(data)
      const warnings = data.signWarningsCount || 0
      if (warnings === 0) setError('')
    },
    onError: (err) =>
      unlessSubscriptionInactive(err, (e) =>
        setError(e instanceof Error ? e.message : 'Mapping failed')
      ),
  })

  const changeTypeMutation = useMutation({
    mutationFn: (family: 'cash_book' | 'bank_statement') => {
      if (!selectedDocId) throw new Error('No document selected')
      return documents.changeType(selectedDocId, family)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project', id] })
      queryClient.invalidateQueries({ queryKey: ['document-preview', selectedDocId] })
      setMapping({})
      setError('')
      toast.success(
        'Document type updated',
        `Now ${data.to.replace(/_/g, ' ')}. Remap columns if this file was already mapped (${data.clearedTransactions} transactions cleared).`
      )
    },
    onError: (err) =>
      unlessSubscriptionInactive(err, (e) =>
        toast.error('Could not change type', e instanceof Error ? e.message : undefined)
      ),
  })

  const forgetLayoutMutation = useMutation({
    mutationFn: (memoryId: string) => settings.forgetLayoutMemory(memoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-preview', selectedDocId] })
      toast.success('Saved layout forgotten', 'Similar uploads will use heuristics until you map again.')
    },
    onError: (err) =>
      unlessSubscriptionInactive(err, (e) =>
        toast.error('Could not forget layout', e instanceof Error ? e.message : undefined)
      ),
  })

  const [applyingAll, setApplyingAll] = useState(false)
  /** Document IDs included in bulk “apply suggested mapping”. New files default on; existing choices survive list refresh. */
  const [bulkDocIds, setBulkDocIds] = useState<Set<string>>(() => new Set())
  const bulkSelectionDocKeyRef = useRef('')

  const docs = project?.documents || []
  const parseJobsInflight = useMemo(
    () =>
      (docs as { parseStatus?: string }[]).filter(
        (d) => d.parseStatus === 'pending' || d.parseStatus === 'processing'
      ).length,
    [docs]
  )
  const hasBankDocuments = useMemo(
    () =>
      (docs as { type: string }[]).some((d) => d.type === 'bank_credits' || d.type === 'bank_debits'),
    [docs]
  )
  const selectedDoc = docs.find((d: { id: string }) => d.id === selectedDocId)

  useEffect(() => {
    const idList = (docs as { id: string }[]).map((d) => d.id)
    const key = idList.slice().sort().join(',')
    if (key === bulkSelectionDocKeyRef.current) return
    const oldKey = bulkSelectionDocKeyRef.current
    bulkSelectionDocKeyRef.current = key
    const oldIds = new Set(oldKey ? oldKey.split(',') : [])
    setBulkDocIds((prevSelected) => {
      if (oldKey === '') return new Set(idList)
      const next = new Set<string>()
      for (const id of idList) {
        if (!oldIds.has(id)) next.add(id)
        else if (prevSelected.has(id)) next.add(id)
      }
      return next
    })
  }, [docs])

  async function applySuggestedToAll() {
    if (!docs.length) return
    const selectedDocs = (docs as { id: string; type: string; filename?: string }[]).filter((d) =>
      bulkDocIds.has(d.id)
    )
    if (selectedDocs.length === 0) {
      setError('Select at least one document in the list below, or use “Select all”.')
      return
    }
    setError('')
    setApplyingAll(true)
    let done = 0
    try {
      let totalWarnings = 0
      let totalSkippedDup = 0
      let totalTransactions = 0
      const signBuckets: Record<SignBucket, number> = {
        primary: 0,
        cross_reference: 0,
        zero: 0,
        empty: 0,
      }
      let mergedWarnings: NonNullable<MapDocumentResponse['signWarningsPreview']> = []
      for (const doc of selectedDocs) {
        const isCashBook = doc.type.startsWith('cash_book_')
        const { chosenSheet, preview: pre } = await resolveBestSheetPreview(doc.id, isCashBook)
        const suggested = mergedSuggestedFromPreview(pre.headers || [], isCashBook, pre)
        const result = await documents.map(doc.id, { mapping: suggested, sheetIndex: chosenSheet })
        totalTransactions += result.count
        totalWarnings += result.signWarningsCount || 0
        totalSkippedDup += result.skippedDuplicateRows || 0
        const s = result.signFilterSummary
        if (s) {
          for (const k of ['primary', 'cross_reference', 'zero', 'empty'] as const) {
            signBuckets[k] += s[k] ?? 0
          }
        }
        if (result.signWarningsPreview?.length) {
          mergedWarnings = [...mergedWarnings, ...result.signWarningsPreview].slice(0, SIGN_WARNINGS_PREVIEW_MAX)
        }
        done++
      }
      queryClient.invalidateQueries({ queryKey: ['project', id] })
      queryClient.invalidateQueries({ queryKey: ['subscription', 'usage'] })
      setMapResult({
        count: totalTransactions,
        documentsMapped: done,
        signWarningsCount: totalWarnings,
        signFilterSummary: signBuckets,
        signWarningsPreview: mergedWarnings.length ? mergedWarnings : undefined,
        skippedDuplicateRows: totalSkippedDup > 0 ? totalSkippedDup : undefined,
      })
      onProceedToReconcile?.()
    } catch (err) {
      unlessSubscriptionInactive(err, (e) => {
        const base = e instanceof Error ? e.message : 'Failed to apply suggested mapping'
        setError(
          done > 0
            ? `${base} (${done} file(s) in your selection were mapped before this error — refresh the page or map the rest individually.)`
            : base
        )
      })
    } finally {
      setApplyingAll(false)
    }
  }

  useEffect(() => {
    if (!preview || selectedDocId !== preview.documentId) return
    const si = preview.sheetIndex
    if (si != null && si !== previewSheetIndex && !sheetIndexExplicit) {
      setPreviewSheetIndex(si)
      setMapping({})
      return
    }
    if (!Object.keys(mapping).length && selectedDoc) {
      const headers = preview.headers || []
      const isCashBook = (selectedDoc as { type?: string }).type?.startsWith('cash_book_') ?? false
      const suggested = mergedSuggestedFromPreview(headers, isCashBook, preview)
      setMapping(suggested)
    }
  }, [preview, selectedDoc, selectedDocId, mapping, previewSheetIndex, sheetIndexExplicit])

  useEffect(() => {
    if (!selectedDocId) {
      setPreviewSheetIndex(0)
      setSheetIndexExplicit(false)
      worksheetPickResolvedRef.current = null
    }
  }, [selectedDocId])

  /** Excel: when opening a file, jump to the first worksheet where a date column is suggested (same rule as bulk apply). */
  useEffect(() => {
    if (!selectedDocId || !preview || preview.documentId !== selectedDocId) return
    if (previewLoading) return
    if (worksheetPickResolvedRef.current === selectedDocId) return

    const names = preview.sheetNames
    if (!names || names.length <= 1) {
      worksheetPickResolvedRef.current = selectedDocId
      return
    }
    if (previewSheetIndex !== 0) {
      worksheetPickResolvedRef.current = selectedDocId
      return
    }

    const docMeta = (docs as { id: string; type: string }[]).find((d) => d.id === selectedDocId)
    if (!docMeta) return
    const isCashBook = docMeta.type.startsWith('cash_book_')
    if (suggestedMappingHasDate(preview.headers || [], isCashBook, preview)) {
      worksheetPickResolvedRef.current = selectedDocId
      return
    }

    const session = worksheetPickSessionRef.current
    let cancelled = false
    ;(async () => {
      const best = await resolveBestSheetFromPre0(selectedDocId, isCashBook, preview)
      if (cancelled || session !== worksheetPickSessionRef.current) return
      if (best !== 0) {
        setMapping({})
        setPreviewSheetIndex(best)
      }
      worksheetPickResolvedRef.current = selectedDocId
    })()
    return () => {
      cancelled = true
    }
  }, [selectedDocId, docs, preview, previewSheetIndex, previewLoading])

  const liveConfidence = useMemo(() => {
    if (!preview?.headers) return {} as Record<string, MappingConfidence>
    return getMappingConfidence(preview.headers as string[], mapping)
  }, [preview, mapping])

  const mappingIssues = useMemo(() => {
    if (!preview?.headers || !selectedDoc?.type) return []
    const fromPreview = (preview as { mappingDiagnostics?: { severity: string; message: string; fix?: string; field?: string }[] }).mappingDiagnostics ?? []
    const live = getMappingIssues(selectedDoc.type, preview.headers as string[], mapping)
    const seen = new Set<string>()
    return [...fromPreview, ...live].filter((item) => {
      const key = `${item.severity}:${item.field}:${item.message}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [preview, mapping, selectedDoc?.type])

  const documentsWithoutTransactions = useMemo(() => {
    return (
      docs as {
        id: string
        filename: string
        type: string
        _count?: { transactions?: number }
      }[]
    ).filter(
      (d) =>
        d._count != null &&
        typeof d._count.transactions === 'number' &&
        d._count.transactions === 0
    )
  }, [docs])

  if (!id) return <WorkflowStepSkeleton />
  if (paywallBlocked) {
    return (
      <div className="py-6">
        <SubscriptionRenewalPanel />
      </div>
    )
  }
  if (projectQueryFailed) {
    return (
      <Alert
        tone="error"
        title="Could not load project"
        onRetry={() => queryClient.invalidateQueries({ queryKey: ['project', id] })}
      >
        {projectError instanceof Error ? projectError.message : 'Something went wrong.'}
      </Alert>
    )
  }
  if (projectPending || !project) return <WorkflowStepSkeleton bodyRows={3} />

  const projectLocked = !isProjectEditable(project.status)
  const mappingDisabled = !canMap || projectLocked

  const canonicalFields = selectedDoc?.type?.startsWith('cash_book_')
    ? CASH_BOOK_FIELDS
    : BANK_FIELDS

  return (
    <div className="space-y-6">
      <WorkflowStepIntro
        eyebrow="Map"
        title="Map columns"
        subtitle="Match each file’s headers to date and amount columns, then apply. Tick files for a bulk run, or map one document at a time. Reconcile starts after mapping."
      />
      <Alert tone="info" title="Date column is required">
        Confirm date and amount columns before applying. If one amount column mixes signs, positives are
        treated as receipts or credits and negatives as payments or debits.
      </Alert>
      {projectLocked && (
        <ProjectLockedBanner projectId={id} status={project.status} role={role} />
      )}
      {!canMap && (
        <Alert tone="info" title="View only">
          Contact an admin, reviewer, or preparer to map documents.
        </Alert>
      )}
      {parseJobsInflight > 0 && (
        <Alert tone="info" title="Background parse">
          {parseJobsInflight} file{parseJobsInflight === 1 ? ' is' : 's are'} still parsing or
          auto-mapping. This page refreshes automatically — map manually if a file stays unmapped
          after it finishes.
        </Alert>
      )}
      {error && (
        <Alert tone="error" title="Mapping failed">
          {error}
        </Alert>
      )}
      {mapResult && (
        <Alert
          tone="success"
          title={
            mapResult.documentsMapped != null && mapResult.documentsMapped > 1
              ? `Mapped ${mapResult.documentsMapped} documents`
              : 'Mapping complete'
          }
          action={
            hasBankDocuments && canExportReport(role) ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void (async () => {
                    try {
                      await report.exportExcel(projectId, { scope: 'mapped_bank' })
                      toast.success('Excel ready', 'Mapped bank statement download should start automatically.')
                    } catch (err) {
                      unlessSubscriptionInactive(err, (e) =>
                        toast.error('Export failed', e instanceof Error ? e.message : undefined)
                      )
                    }
                  })()
                }}
              >
                Download mapped bank Excel
              </Button>
            ) : undefined
          }
        >
          <p>
            <strong>{mapResult.count}</strong> transaction{mapResult.count === 1 ? '' : 's'} extracted.
            {hasBankDocuments && canExportReport(role) && (
              <span className="block mt-1 text-xs opacity-90">
                Credits and debits you have mapped, as Excel — also available under Report → Export.
              </span>
            )}
          </p>
          {(mapResult.importStats ||
            (mapResult.skippedDuplicateRows || 0) > 0 ||
            mapResult.signFilterSummary) && (
            <details className="mt-2">
              <summary className="cursor-pointer text-xs font-medium">Import details</summary>
              <div className="mt-2 space-y-1 text-xs">
                {mapResult.importStats && (
                  <p>
                    Source rows: <strong>{mapResult.importStats.sourceRowCount}</strong> → imported{' '}
                    <strong>{mapResult.importStats.importedCount}</strong>
                    {(mapResult.importStats.skippedZeroAmountRows > 0 ||
                      mapResult.importStats.skippedDuplicateRows > 0) && (
                      <>
                        {' '}
                        (skipped {mapResult.importStats.skippedZeroAmountRows} zero-amount,{' '}
                        {mapResult.importStats.skippedDuplicateRows} duplicate
                        {mapResult.importStats.previousMappedCount > 0
                          ? `; replaced ${mapResult.importStats.previousMappedCount} previously mapped`
                          : ''}
                        )
                      </>
                    )}
                    . If imported count is far below your statement, check PDF page limits or column mapping.
                  </p>
                )}
                {!mapResult.importStats && (mapResult.skippedDuplicateRows || 0) > 0 && (
                  <p>
                    Skipped <strong>{mapResult.skippedDuplicateRows}</strong> duplicate row(s) in the source
                    (same date, amount, and narrative as an earlier row).
                  </p>
                )}
                {mapResult.signFilterSummary && (
                  <p>
                    Sign buckets: {mapResult.signFilterSummary.primary ?? 0} primary ·{' '}
                    {mapResult.signFilterSummary.cross_reference ?? 0} cross-ref ·{' '}
                    {mapResult.signFilterSummary.zero ?? 0} zero · {mapResult.signFilterSummary.empty ?? 0}{' '}
                    empty
                  </p>
                )}
              </div>
            </details>
          )}
        </Alert>
      )}
      {mapResult && (mapResult.signWarningsPreview || []).length > 0 && (
        <Alert
          tone="warning"
          title={`${mapResult.signWarningsCount || (mapResult.signWarningsPreview || []).length} sign warning(s)`}
        >
          <ul className="mt-1 space-y-0.5">
            {(mapResult.signWarningsPreview || []).slice(0, 5).map((w, i) => (
              <li key={i}>
                Row {w.rowIndex}: {w.amount} ({w.bucket.replace('_', ' ')}) — {w.note}
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {canMap && !projectLocked && docs.length > 0 && (
        <Card
          className="max-w-2xl"
          title="Bulk apply — which files?"
          sublabel="Only ticked files are processed (any supported upload—CSV/Excel, PDF, images, etc.). New uploads are ticked automatically; untick any file you want to skip or map by hand below."
        >
          <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-xs font-medium">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-primary-700 hover:text-primary-800"
              onClick={() => setBulkDocIds(new Set((docs as { id: string }[]).map((d) => d.id)))}
            >
              Select all
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setBulkDocIds(new Set())}>
              Clear selection
            </Button>
          </div>
          <ul className="space-y-2 max-h-52 overflow-y-auto border border-gray-100 rounded-xl p-2 bg-gray-50/50">
            {(
              docs as {
                id: string
                filename: string
                type: string
                parseStatus?: string
                parseStatusMessage?: string | null
              }[]
            ).map((d) => (
              <li key={d.id} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  checked={bulkDocIds.has(d.id)}
                  onChange={(e) => {
                    setBulkDocIds((prev) => {
                      const next = new Set(prev)
                      if (e.target.checked) next.add(d.id)
                      else next.delete(d.id)
                      return next
                    })
                  }}
                  aria-label={`Include ${d.filename} in bulk mapping`}
                />
                <span className="min-w-0 flex-1">
                  <span className="text-gray-900 break-words">{d.filename}</span>
                  <span className="text-gray-500 text-xs"> ({d.type})</span>
                  {d.parseStatus === 'pending' && (
                    <Badge tone="brand" size="sm" className="ml-2 uppercase tracking-wide">
                      Queued
                    </Badge>
                  )}
                  {d.parseStatus === 'processing' && (
                    <Badge tone="brand" size="sm" className="ml-2 uppercase tracking-wide">
                      Parsing…
                    </Badge>
                  )}
                  {d.parseStatus === 'failed' && (
                    <Badge
                      tone="danger"
                      size="sm"
                      className="ml-2 uppercase tracking-wide"
                      title={d.parseStatusMessage || 'Parse failed'}
                    >
                      Failed
                    </Badge>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button
              type="button"
              onClick={applySuggestedToAll}
              disabled={bulkDocIds.size === 0}
              isLoading={applyingAll}
            >
              Apply suggested mapping to selected
            </Button>
            <details className="text-xs text-gray-500 max-w-md">
              <summary className="cursor-pointer font-medium text-gray-600">How bulk apply picks sheets</summary>
              <p className="mt-1.5 leading-relaxed">
                We detect columns from the extracted table and apply mapping per file. For Excel workbooks
                with several sheets, we automatically use the <strong>best transaction sheet</strong>{' '}
                (detail rows with date + amount columns). PDFs and scans do not have sheets — open each file
                below if the preview needs a check. To pick another Excel tab, open that file below.
              </p>
            </details>
          </div>
          </div>
        </Card>
      )}

      <div className="max-w-md">
        <Select
          label="Or select a document to map or adjust"
          value={selectedDocId || ''}
          onChange={(e) => {
            worksheetPickSessionRef.current += 1
            worksheetPickResolvedRef.current = null
            setSelectedDocId(e.target.value || null)
            setPreviewSheetIndex(0)
            setSheetIndexExplicit(false)
            setMapping({})
          }}
        >
          <option value="">Select a document</option>
          {docs.map((d: { id: string; filename: string; type: string; parseStatus?: string }) => (
            <option key={d.id} value={d.id}>
              {d.filename} ({d.type})
              {d.parseStatus === 'pending' || d.parseStatus === 'processing'
                ? ' — parsing…'
                : d.parseStatus === 'failed'
                  ? ' — parse failed'
                  : ''}
            </option>
          ))}
        </Select>
      </div>
      {selectedDocId && (
        <>
          {previewLoading ? (
            <PageBodySkeleton label="Loading preview" />
          ) : previewQueryFailed && previewError && !isSubscriptionInactiveError(previewError) ? (
            <Alert
              tone="error"
              title="Could not load document preview"
              onRetry={() =>
                queryClient.invalidateQueries({
                  queryKey: ['document-preview', selectedDocId, previewSheetIndex],
                })
              }
            >
              {previewError instanceof Error ? previewError.message : 'Something went wrong.'}
            </Alert>
          ) : preview ? (
            <Card title={preview.filename}>
              <div className="space-y-4">
              {preview.sheetNames && preview.sheetNames.length > 1 && (
                <div className="max-w-md">
                  <Select
                    label="Worksheet (Excel)"
                    hint="We pick the best transaction sheet automatically. You can change the tab here anytime."
                    value={previewSheetIndex}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10)
                      if (!Number.isNaN(n)) {
                        setSheetIndexExplicit(true)
                        setPreviewSheetIndex(n)
                        setMapping({})
                      }
                    }}
                  >
                    {preview.sheetNames.map((name, i) => (
                      <option key={i} value={i}>
                        {name?.trim() ? name : `Sheet ${i + 1}`}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              <p className="text-sm text-gray-500 flex flex-wrap items-center gap-2">
                <span>{preview.totalRows} rows</span>
                {preview.parseMethod && (
                  <Badge tone="brand" size="sm">
                    {preview.parseMethod.replace(/_/g, ' ')}
                  </Badge>
                )}
                {preview.detectedBankFormat && (
                  <Badge tone="success" size="sm">
                    {String(preview.detectedBankFormat).charAt(0).toUpperCase() +
                      String(preview.detectedBankFormat).slice(1)}{' '}
                    format detected
                  </Badge>
                )}
              </p>
              {preview.parseSummary &&
                (preview.parseSummary.sumDebit != null || preview.parseSummary.sumCredit != null) && (
                  <p className="text-xs text-gray-500">
                    Parsed totals — debits:{' '}
                    {preview.parseSummary.sumDebit != null
                      ? preview.parseSummary.sumDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })
                      : '—'}
                    ; credits:{' '}
                    {preview.parseSummary.sumCredit != null
                      ? preview.parseSummary.sumCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })
                      : '—'}
                  </p>
                )}
              {(preview as { pdfTruncated?: boolean }).pdfTruncated && (
                <Alert tone="warning" title="PDF truncation">
                  This PDF has {(preview as { pdfTotalPages?: number }).pdfTotalPages} pages. Only the first{' '}
                  {(preview as { pdfPagesProcessed?: number }).pdfPagesProcessed} pages were processed (default
                  limit {DEFAULT_PDF_OCR_MAX_PAGES}; set PDF_OCR_MAX_PAGES to raise). Some transactions may be
                  missing. Split the PDF or increase the limit for full extraction.
                </Alert>
              )}
              {typeof preview.parseQualityScore === 'number' &&
                (preview.parseQualityScore < 70 || preview.ocrRetried) && (
                <Alert
                  tone={preview.parseQualityScore < 55 ? 'warning' : 'info'}
                  title={`Parse quality: ${preview.parseQualityScore}/100${preview.ocrRetried ? ' (OCR retry used)' : ''}`}
                >
                  {preview.parseQualityNotes?.length
                    ? preview.parseQualityNotes.slice(0, 2).join(' · ')
                    : null}
                  {preview.parseQualityScore < 55
                    ? ' Review the preview carefully — consider uploading the Excel export if available.'
                    : ''}
                </Alert>
              )}
              {preview.layoutMemoryApplied && (
                <Alert
                  tone="success"
                  title="Saved layout applied"
                  action={
                    canMap &&
                    isProjectEditable(project?.status) &&
                    preview.layoutMemoryApplied.id ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        title="Stop suggesting this saved column map for similar uploads. Does not unmap this file."
                        isLoading={forgetLayoutMutation.isPending}
                        onClick={async () => {
                          const ok = await confirm({
                            title: 'Forget this saved layout?',
                            description:
                              'This saved column map will no longer be suggested for similar uploads. The current file stays mapped. Map again to save a new layout.',
                            confirmLabel: 'Forget layout',
                            tone: 'warning',
                          })
                          if (ok) forgetLayoutMutation.mutate(preview.layoutMemoryApplied!.id!)
                        }}
                      >
                        Forget layout
                      </Button>
                    ) : undefined
                  }
                >
                  {preview.layoutMemoryApplied.exact
                    ? 'Using your organisation’s column map for this exact header layout'
                    : `Using a similar saved column map (${Math.round(preview.layoutMemoryApplied.similarity * 100)}% match) to fill missing columns only`}
                  {preview.layoutMemoryApplied.fields.length
                    ? ` — ${preview.layoutMemoryApplied.fields.join(', ')}`
                    : ''}
                  {preview.layoutMemoryApplied.useCount > 1
                    ? ` (used ${preview.layoutMemoryApplied.useCount}×)`
                    : ''}
                  . Adjust if needed; applying mapping updates the saved layout for next time. Forget
                  layout only removes that memory — it does not unmap this file.
                </Alert>
              )}
              {preview.typeInference?.mismatch && (
                <Alert
                  tone="warning"
                  title="Document type may be wrong"
                  action={
                    canMap &&
                    isProjectEditable(project?.status) &&
                    preview.typeInference.family !== 'unknown' ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        isLoading={changeTypeMutation.isPending}
                        onClick={async () => {
                          const family =
                            preview.typeInference!.family === 'cash_book' ? 'cash_book' : 'bank_statement'
                          const label = family === 'cash_book' ? 'cash book' : 'bank statement'
                          const ok = await confirm({
                            title: `Switch to ${label}?`,
                            description:
                              'This remaps the document type and clears any mapped transactions for this file. You will need to map columns again.',
                            confirmLabel: `Switch to ${label}`,
                            tone: 'warning',
                          })
                          if (ok) changeTypeMutation.mutate(family)
                        }}
                      >
                        Switch to{' '}
                        {preview.typeInference.family === 'cash_book' ? 'cash book' : 'bank statement'}
                      </Button>
                    ) : undefined
                  }
                >
                  This file looks like a{' '}
                  {preview.typeInference.family === 'cash_book' ? 'cash book' : 'bank statement'} (
                  {preview.typeInference.confidence} confidence), but it was uploaded under the other card.
                  {preview.typeInference.reasons?.length
                    ? ` Evidence: ${preview.typeInference.reasons.slice(0, 2).join('; ')}.`
                    : ''}
                </Alert>
              )}
              {preview.tglErpLayout && (
                <Alert tone="info" title="TGL / IBIS cash book — original column titles">
                  Column names match your Excel export (Transaction Date, Description, Amount,
                  Foreign Currency Amount, TGL Account Code, etc.). Amount columns use{' '}
                  <strong>signed values</strong>: negative = receipt, positive = payment. For a euro
                  bank account, map Amount received/paid to <strong>Foreign Currency Amount</strong>{' '}
                  — not Amount (cedi equivalent).
                </Alert>
              )}
              {preview.hasForeignCurrencyColumns && !preview.tglErpLayout && (
                <Alert tone="info" title="Multi-currency cash book">
                  Columns include cedi equivalents (amount received / amount paid) and foreign amounts
                  (Foreign Currency Amount, plus currency code / exchange rate). For a euro bank
                  account, map amounts to the <strong>Foreign Currency Amount</strong> column — not the
                  cedi Amount column.
                  {preview.projectCurrency && preview.projectCurrency.toUpperCase() !== 'GHS' && (
                    <>
                      {' '}
                      Project currency is <strong>{preview.projectCurrency}</strong>, so Foreign Currency
                      Amount is suggested by default.
                    </>
                  )}
                </Alert>
              )}
              {preview.hasForeignCurrencyColumns && preview.tglErpLayout && preview.projectCurrency &&
                preview.projectCurrency.toUpperCase() !== 'GHS' && (
                <Alert tone="info" title={`Project currency: ${preview.projectCurrency}`}>
                  Foreign Currency Amount is suggested for Amount received/paid (euro/USD). Amount is
                  the cedi (GHS) equivalent — use only if reconciling in cedis.
                </Alert>
              )}
              <div className="rounded-xl border border-border overflow-hidden">
                <Table>
                  <TableHead>
                    <TableRow>
                      {preview.headers.map((h: string, i: number) => (
                        <TableTh key={i} className="px-3 py-2.5 whitespace-nowrap">
                          [{i}] {h || `Col ${i}`}
                        </TableTh>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(preview.rows || []).slice(0, 5).map((row: unknown[], ri: number) => (
                      <TableRow key={ri}>
                        {(row as unknown[]).map((cell, ci) => (
                          <TableTd key={ci} className="px-3 py-2.5 whitespace-nowrap text-gray-900">
                            {cell != null ? String(cell) : 'No value provided'}
                          </TableTd>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {mappingIssues.some((issue) => issue.severity === 'error') && (
                <Alert
                  tone="error"
                  title="Fix required before matching"
                >
                  <ul className="space-y-1">
                    {mappingIssues
                      .filter((issue) => issue.severity === 'error')
                      .map((issue, i) => (
                        <li key={i}>
                          {issue.field ? `${fieldLabel(issue.field)}: ` : ''}
                          {issue.message}
                          {issue.fix ? ` ${issue.fix}` : ''}
                        </li>
                      ))}
                  </ul>
                </Alert>
              )}
              {mappingIssues.some((issue) => issue.severity !== 'error') && (
                <Alert
                  tone={
                    mappingIssues.some((issue) => issue.severity === 'warning') ? 'warning' : 'info'
                  }
                  title={
                    mappingIssues.some((issue) => issue.severity === 'warning')
                      ? 'Check these mappings'
                      : 'Mapping tips'
                  }
                >
                  <ul className="space-y-1">
                    {mappingIssues
                      .filter((issue) => issue.severity !== 'error')
                      .map((issue, i) => (
                        <li key={i}>
                          <span className="font-medium">
                            {issue.severity === 'warning' ? 'Check' : 'Tip'}
                            {issue.field ? ` (${fieldLabel(issue.field)})` : ''}:{' '}
                          </span>
                          {issue.message}
                          {issue.fix ? ` ${issue.fix}` : ''}
                        </li>
                      ))}
                  </ul>
                </Alert>
              )}
              <div className="grid gap-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-medium text-gray-900">Match columns</h4>
                  {Object.keys(mapping).length > 0 && (
                    <Badge tone="brand" size="sm">
                      {Object.keys(mapping).length} field
                      {Object.keys(mapping).length === 1 ? '' : 's'} mapped
                    </Badge>
                  )}
                </div>
                {canonicalFields.map((field: string) => (
                  <div
                    key={field}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-xl bg-gray-50/80 border border-gray-100 px-3 py-2.5"
                  >
                    <div className="sm:w-44 flex items-center gap-2 flex-wrap">
                      <label htmlFor={`map-field-${field}`} className="text-sm font-medium text-gray-700">
                        {fieldLabel(field)}
                      </label>
                      {liveConfidence[field] && (
                        <Badge tone={confidenceTone(liveConfidence[field]!)} size="sm" className="uppercase">
                          {liveConfidence[field]}
                        </Badge>
                      )}
                    </div>
                    <div className="w-full sm:flex-1 sm:max-w-xs">
                      <Select
                        id={`map-field-${field}`}
                        value={mapping[field] ?? ''}
                        disabled={mappingDisabled}
                        onChange={(e) => {
                          const v = e.target.value
                          setMapping((m) => {
                            const next = { ...m }
                            if (v === '') delete next[field]
                            else next[field] = parseInt(v, 10)
                            return next
                          })
                        }}
                      >
                        <option value="">Do not map this field</option>
                        {(preview.headers || []).map((h: string, i: number) => (
                          <option key={i} value={i}>
                            [{i}] {h || `Col ${i}`}
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
              {!mappingDisabled && (
                <Button
                  onClick={() => mapMutation.mutate(selectedDocId)}
                  isLoading={mapMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  Apply mapping
                </Button>
              )}
              </div>
            </Card>
          ) : null}
        </>
      )}

      {documentsWithoutTransactions.length > 0 && (
        <Alert tone="warning" title="Some files have no extracted transactions yet" className="max-w-2xl">
          {documentsWithoutTransactions.length === 1
            ? `${documentsWithoutTransactions[0]!.filename} is not mapped or produced no rows.`
            : `${documentsWithoutTransactions.length} files still need a successful map (or contain no data).`}{' '}
          Select each in the list above, apply mapping, then continue.
        </Alert>
      )}

      {onProceedToReconcile && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-600">Mapping done? Go to Reconcile to match transactions.</p>
          <Button type="button" onClick={onProceedToReconcile}>
            Proceed to Reconcile
          </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
