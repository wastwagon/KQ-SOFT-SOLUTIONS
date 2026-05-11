import { useState, useEffect, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  projects,
  documents,
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
import SubscriptionRenewalPanel from '../components/SubscriptionRenewalPanel'
import WorkflowStepIntro from '../components/project/WorkflowStepIntro'
import WorkflowStepSkeleton from '../components/project/WorkflowStepSkeleton'

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

/** For Excel: first worksheet whose merged suggestion includes the date field; otherwise 0. */
async function resolveBestSheetPreview(
  docId: string,
  isCashBook: boolean
): Promise<{ chosenSheet: number; preview: DocumentPreviewResponse }> {
  const pre0 = await documents.preview(docId)
  const names = pre0.sheetNames ?? []
  if (names.length <= 1) return { chosenSheet: 0, preview: pre0 }
  for (let si = 0; si < names.length; si++) {
    const p = si === 0 ? pre0 : await documents.preview(docId, { sheetIndex: si })
    if (suggestedMappingHasDate(p.headers || [], isCashBook, p)) return { chosenSheet: si, preview: p }
  }
  return { chosenSheet: 0, preview: pre0 }
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
  const queryClient = useQueryClient()
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [previewSheetIndex, setPreviewSheetIndex] = useState(0)
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
  })
  const { data: project, error: projectError, isError: projectQueryFailed, isPending: projectPending } = projectQuery

  const previewQuery = useQuery({
    queryKey: ['document-preview', selectedDocId, previewSheetIndex],
    queryFn: () => documents.preview(selectedDocId!, { sheetIndex: previewSheetIndex }),
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

  const [applyingAll, setApplyingAll] = useState(false)
  /** Document IDs included in bulk “apply suggested mapping”. New files default on; existing choices survive list refresh. */
  const [bulkDocIds, setBulkDocIds] = useState<Set<string>>(() => new Set())
  const bulkSelectionDocKeyRef = useRef('')

  const docs = project?.documents || []
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
          mergedWarnings = [...mergedWarnings, ...result.signWarningsPreview].slice(0, 25)
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
    if (si != null && si !== previewSheetIndex) {
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
  }, [preview, selectedDoc, selectedDocId, mapping, previewSheetIndex])

  useEffect(() => {
    if (!selectedDocId) {
      setPreviewSheetIndex(0)
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
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 max-w-xl shadow-sm">
        <p className="font-medium text-red-900">Could not load project</p>
        <p className="mt-1">
          {projectError instanceof Error ? projectError.message : 'Something went wrong.'}
        </p>
        <button
          type="button"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['project', id] })}
          className="mt-3 px-3 py-1.5 text-sm font-medium rounded-xl bg-white border border-red-300 text-red-900 hover:bg-red-100"
        >
          Retry
        </button>
      </div>
    )
  }
  if (projectPending || !project) return <WorkflowStepSkeleton bodyRows={3} />

  const canonicalFields = selectedDoc?.type?.startsWith('cash_book_')
    ? CASH_BOOK_FIELDS
    : BANK_FIELDS

  return (
    <div className="space-y-6">
      <WorkflowStepIntro
        eyebrow="Map"
        title="Column mapping"
        subtitle={
          <>
            <strong>One-time setup.</strong> Uploads can be spreadsheets, PDFs, images, or other supported types—we turn
            each file into a table of rows, read the detected column headers (Date, Amount, Credit, Debit, etc.), and
            suggest how they map. After this, <strong>Reconcile runs automatically</strong>—matching and suggestions are
            done for you. Tick which files to include, then apply suggested mappings in one run, or map each document
            individually if you need to adjust.
          </>
        }
      />
      <p className="text-xs text-slate-600 max-w-2xl rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
        <strong>Required:</strong> Map the <strong>date</strong> column for each document so transactions can be matched correctly.
      </p>
      <p className="text-xs text-blue-700 max-w-2xl rounded-xl bg-blue-50 border border-blue-200 px-3 py-2">
        <strong>Signed amount mode:</strong> if one amount column contains mixed entries, positive amounts are treated as receipts/credits and negative amounts as payments/debits.
      </p>
      {!canMap && (
        <p className="text-sm text-amber-600">You have view-only access. Contact an admin, reviewer, or preparer to map documents.</p>
      )}
      {error && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700 shadow-sm">{error}</div>
      )}
      {mapResult && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
          <p className="text-sm text-slate-700">
            {mapResult.documentsMapped != null && mapResult.documentsMapped > 1 ? (
              <>
                Mapped <strong>{mapResult.documentsMapped}</strong> document(s);{' '}
                <strong>{mapResult.count}</strong> transaction(s) extracted.
              </>
            ) : (
              <>
                Mapping complete: <strong>{mapResult.count}</strong> transaction(s) extracted.
              </>
            )}
            {(mapResult.signWarningsCount || 0) > 0 && (
              <span className="ml-1 text-amber-700">
                {mapResult.signWarningsCount} sign warning(s) found.
              </span>
            )}
          </p>
          {(mapResult.skippedDuplicateRows || 0) > 0 && (
            <p className="text-sm text-slate-600">
              Skipped <strong>{mapResult.skippedDuplicateRows}</strong> duplicate row(s) in the source (same date,
              amount, and narrative as an earlier row).
            </p>
          )}
          {mapResult.signFilterSummary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="rounded border border-green-200 bg-green-50 px-2 py-1">Primary: {mapResult.signFilterSummary.primary ?? 0}</div>
              <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1">Cross-ref: {mapResult.signFilterSummary.cross_reference ?? 0}</div>
              <div className="rounded border border-primary-200 bg-primary-50 px-2 py-1 text-primary-900">Zero: {mapResult.signFilterSummary.zero ?? 0}</div>
              <div className="rounded border border-slate-200 bg-white px-2 py-1">Empty: {mapResult.signFilterSummary.empty ?? 0}</div>
            </div>
          )}
          {(mapResult.signWarningsPreview || []).length > 0 && (
            <div className="border border-amber-200 bg-amber-50 rounded p-2">
              <p className="text-xs font-medium text-amber-800 mb-1">Sign warnings preview</p>
              <ul className="text-xs text-amber-900 space-y-0.5">
                {(mapResult.signWarningsPreview || []).slice(0, 5).map((w, i) => (
                  <li key={i}>Row {w.rowIndex}: {w.amount} ({w.bucket.replace('_', ' ')}) - {w.note}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {canMap && docs.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3 max-w-2xl">
          <div>
            <p className="text-sm font-semibold text-gray-900">Bulk apply — which files?</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Only ticked files are processed (any supported upload—CSV/Excel, PDF, images, etc.). New uploads are ticked
              automatically; untick any file you want to skip or map by hand below.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-xs font-medium">
            <button
              type="button"
              onClick={() => setBulkDocIds(new Set((docs as { id: string }[]).map((d) => d.id)))}
              className="text-primary-700 hover:underline"
            >
              Select all
            </button>
            <button type="button" onClick={() => setBulkDocIds(new Set())} className="text-gray-600 hover:underline">
              Clear selection
            </button>
          </div>
          <ul className="space-y-2 max-h-52 overflow-y-auto border border-gray-100 rounded-xl p-2 bg-gray-50/50">
            {(docs as { id: string; filename: string; type: string }[]).map((d) => (
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
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={applySuggestedToAll}
              disabled={applyingAll || bulkDocIds.size === 0}
              className="px-4 py-2.5 bg-primary-600 text-white rounded-xl font-medium shadow-sm hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {applyingAll ? 'Applying…' : 'Apply suggested mapping to selected'}
            </button>
            <span className="text-xs text-gray-500 max-w-md">
              We detect columns from the extracted table and apply mapping per file. For Excel workbooks with several
              sheets, we use the <strong>first sheet where a date column is detected</strong>; otherwise the first sheet.
              PDFs and scans do not have sheets—open each file below if the preview needs a check. To pick another Excel
              tab, open that file below.
            </span>
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Or select a document to map or adjust
        </label>
        <select
          value={selectedDocId || ''}
          onChange={(e) => {
            worksheetPickSessionRef.current += 1
            worksheetPickResolvedRef.current = null
            setSelectedDocId(e.target.value || null)
            setPreviewSheetIndex(0)
            setMapping({})
          }}
          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-xl bg-white text-gray-900"
        >
          <option value="">Select a document</option>
          {docs.map((d: { id: string; filename: string; type: string }) => (
            <option key={d.id} value={d.id}>
              {d.filename} ({d.type})
            </option>
          ))}
        </select>
      </div>
      {selectedDocId && (
        <>
          {previewLoading ? (
            <p className="text-gray-500">Loading preview...</p>
          ) : previewQueryFailed && previewError && !isSubscriptionInactiveError(previewError) ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 max-w-xl">
              <p className="font-medium text-red-900">Could not load document preview</p>
              <p className="mt-1">
                {previewError instanceof Error ? previewError.message : 'Something went wrong.'}
              </p>
              <button
                type="button"
                onClick={() =>
                  queryClient.invalidateQueries({
                    queryKey: ['document-preview', selectedDocId, previewSheetIndex],
                  })
                }
                className="mt-3 px-3 py-1.5 text-sm font-medium rounded-xl bg-white border border-red-300 text-red-900 hover:bg-red-100"
              >
                Retry
              </button>
            </div>
          ) : preview ? (
            <div className="bg-white shadow rounded-xl p-4 sm:p-6 space-y-4 border border-gray-200">
              <h3 className="font-medium text-gray-900">{preview.filename}</h3>
              {preview.sheetNames && preview.sheetNames.length > 1 && (
                <label className="block max-w-md">
                  <span className="block text-sm font-medium text-gray-700 mb-1">Worksheet (Excel)</span>
                  <p className="text-xs text-gray-500 mb-1.5">
                    When you open a file, we pick the first tab where a date column is detected. You can change the tab
                    here anytime.
                  </p>
                  <select
                    value={previewSheetIndex}
                    onChange={(e) => {
                      const n = parseInt(e.target.value, 10)
                      if (!Number.isNaN(n)) {
                        setPreviewSheetIndex(n)
                        setMapping({})
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-xl bg-white text-gray-900 text-sm"
                  >
                    {preview.sheetNames.map((name, i) => (
                      <option key={i} value={i}>
                        {name?.trim() ? name : `Sheet ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <p className="text-sm text-gray-500">
                {preview.totalRows} rows
                {preview.detectedBankFormat && (
                  <span className="ml-2 px-1.5 py-0.5 text-xs bg-green-100 text-green-800 rounded">
                    {String(preview.detectedBankFormat).charAt(0).toUpperCase() + String(preview.detectedBankFormat).slice(1)} format detected
                  </span>
                )}
              </p>
              {(preview as { pdfTruncated?: boolean }).pdfTruncated && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                  <strong>PDF truncation:</strong> This PDF has {(preview as { pdfTotalPages?: number }).pdfTotalPages} pages. Only the first {(preview as { pdfPagesProcessed?: number }).pdfPagesProcessed} pages were processed (PDF_OCR_MAX_PAGES limit). Some transactions may be missing. Split the PDF or increase the limit for full extraction.
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border border-gray-200">
                  <thead>
                    <tr className="bg-gray-50">
                      {preview.headers.map((h: string, i: number) => (
                        <th key={i} className="px-2 py-1 text-left border border-gray-200 text-gray-900">
                          [{i}] {h || `Col ${i}`}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(preview.rows || []).slice(0, 5).map((row: unknown[], ri: number) => (
                      <tr key={ri} className="border-b border-gray-200">
                        {(row as unknown[]).map((cell, ci) => (
                          <td key={ci} className="px-2 py-1 border border-gray-200 text-gray-900">
                            {cell != null ? String(cell) : 'No value provided'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid gap-4">
                <h4 className="font-medium">Map to canonical fields</h4>
                {canonicalFields.map((field: string) => (
                  <div key={field} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                    <label className="sm:w-40 text-sm font-medium text-gray-700">
                      {field}
                      {liveConfidence[field] && (
                        <span
                          className={`ml-2 px-1.5 py-0.5 rounded text-[10px] uppercase ${
                            liveConfidence[field] === 'high'
                              ? 'bg-green-100 text-green-800'
                              : liveConfidence[field] === 'medium'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {liveConfidence[field]}
                        </span>
                      )}
                    </label>
                    <select
                      value={mapping[field] ?? ''}
                      onChange={(e) => {
                        const v = e.target.value
                        setMapping((m) => {
                          const next = { ...m }
                          if (v === '') delete next[field]
                          else next[field] = parseInt(v, 10)
                          return next
                        })
                      }}
                      className="w-full sm:flex-1 sm:max-w-xs px-3 py-2.5 min-h-[44px] border border-gray-200 rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="">Do not map this field</option>
                      {(preview.headers || []).map((h: string, i: number) => (
                        <option key={i} value={i}>
                          [{i}] {h || `Col ${i}`}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              {canMap && (
              <button
                onClick={() => mapMutation.mutate(selectedDocId)}
                disabled={mapMutation.isPending}
                className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 font-medium"
              >
                {mapMutation.isPending ? 'Applying...' : 'Apply mapping'}
              </button>
              )}
            </div>
          ) : null}
        </>
      )}

      {documentsWithoutTransactions.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-950 max-w-2xl">
          <p className="font-medium">Some files have no extracted transactions yet</p>
          <p className="mt-1 text-amber-900/90">
            {documentsWithoutTransactions.length === 1
              ? `${documentsWithoutTransactions[0]!.filename} is not mapped or produced no rows.`
              : `${documentsWithoutTransactions.length} files still need a successful map (or contain no data).`}{' '}
            Select each in the list above, apply mapping, then continue.
          </p>
        </div>
      )}

      {onProceedToReconcile && (
        <div className="pt-6 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-gray-600">Mapping done? Go to Reconcile to match transactions.</p>
          <button
            type="button"
            onClick={onProceedToReconcile}
            className="px-5 py-2.5 bg-primary-600 text-white rounded-xl font-medium shadow-sm hover:bg-primary-700 hover:shadow transition-all"
          >
            Proceed to Reconcile →
          </button>
        </div>
      )}
    </div>
  )
}
