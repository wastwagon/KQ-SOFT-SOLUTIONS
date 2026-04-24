import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { projects, documents, type MapDocumentResponse } from '../lib/api'

const CASH_BOOK_FIELDS = ['date', 'name', 'details', 'doc_ref', 'chq_no', 'accode', 'amt_received', 'amt_paid']
const BANK_FIELDS = ['transaction_date', 'description', 'credit', 'debit']

/** Normalise header for matching: lowercase, collapse spaces/underscores */
function norm(h: string): string {
  return (h || '').toLowerCase().replace(/[\s_]+/g, ' ').trim()
}

/** Phase 2: Broader header detection — same logic for single-doc and Apply to all */
function buildSuggestedMapping(
  headers: string[],
  isCashBook: boolean,
  existingSuggested: Record<string, number> = {}
): Record<string, number> {
  const out = { ...existingSuggested }
  const H = headers.map(norm)

  const find = (patterns: RegExp[]): number => {
    const i = H.findIndex((h) => patterns.some((p) => p.test(h)))
    return i >= 0 ? i : -1
  }

  if (isCashBook) {
    if (out.date == null) {
      const i = find([/^date$/, /transaction\s*date/, /value\s*date/, /txn\s*date/, /posting\s*date/, /transaction_date/])
      if (i >= 0) out.date = i
    }
    if (out.name == null) {
      const i = find([/^name$/, /description/, /particulars/, /narrative/, /payee/, /party/])
      if (i >= 0) out.name = i
    }
    if (out.details == null) {
      const i = find([/^details$/, /particulars/, /narrative/, /memo/, /remarks/])
      if (i >= 0) out.details = i
    }
    if (out.doc_ref == null) {
      const i = find([/^doc_ref$/, /^ref$/, /reference/, /doc\s*ref/])
      if (i >= 0) out.doc_ref = i
    }
    if (out.chq_no == null) {
      const i = find([/^chq_no$/, /chq\s*no/, /cheque\s*no/, /cheque\s*number/, /chq$/])
      if (i >= 0) out.chq_no = i
    }
    if (out.accode == null) {
      const i = find([/^accode$/, /account\s*code/, /ac\s*code/, /code/])
      if (i >= 0) out.accode = i
    }
    if (out.amt_received == null) {
      const i = find([/amt_received/, /amount\s*received/, /receipts?/, /received/, /credit/, /cr\b/, /deposit/])
      if (i >= 0) out.amt_received = i
    }
    if (out.amt_paid == null) {
      const i = find([/amt_paid/, /amount\s*paid/, /payments?/, /paid/, /debit/, /dr\b/, /withdrawal/])
      if (i >= 0) out.amt_paid = i
    }
    if (out.amt_received == null && out.amt_paid == null) {
      const i = find([/^amount$/, /^amt$/, /total/])
      if (i >= 0) {
        out.amt_received ??= i
        out.amt_paid ??= i
      }
    }
  } else {
    if (out.transaction_date == null && out.date == null) {
      const i = find([/^date$/, /transaction\s*date/, /value\s*date/, /txn\s*date/, /posting\s*date/, /transaction_date/])
      if (i >= 0) out.transaction_date = i
    }
    if (out.description == null) {
      const i = find([/^description$/, /particulars/, /narrative/, /details/, /memo/, /remarks/])
      if (i >= 0) out.description = i
    }
    if (out.credit == null) {
      const i = find([/^credit$/, /^cr\b/, /deposits?/, /in(?:ward)?/])
      if (i >= 0) out.credit = i
    }
    if (out.debit == null) {
      const i = find([/^debit$/, /^dr\b/, /withdrawals?/, /out(?:ward)?/])
      if (i >= 0) out.debit = i
    }
    if (out.credit == null && out.debit == null) {
      const i = find([/^amount$/, /^amt$/, /total/])
      if (i >= 0) {
        out.credit ??= i
        out.debit ??= i
      }
    }
  }

  return out
}

type MappingConfidence = 'high' | 'medium' | 'low'

/** Heuristic confidence for the currently selected column per canonical field (updates as user changes mapping). */
function confidenceForMappedField(field: string, headerText: string): MappingConfidence {
  const h = norm(headerText)
  if (!h) return 'low'
  const STRONG: Record<string, RegExp[]> = {
    date: [/^date$/, /transaction\s*date/, /value\s*date/, /posting\s*date/],
    transaction_date: [/^date$/, /transaction\s*date/, /value\s*date/, /posting\s*date/],
    description: [/^description$/, /particulars/, /narrative/, /details/, /memo/, /remarks/],
    name: [/^name$/, /payee/, /party/, /description/],
    details: [/^details$/, /particulars/, /narrative/, /memo/, /remarks/],
    doc_ref: [/^doc ref$/, /^doc_ref$/, /^ref$/, /reference/, /voucher/],
    chq_no: [/^chq no$/, /^chq_no$/, /cheque\s*no/, /cheque\s*number/],
    accode: [/^accode$/, /account\s*code/, /ac\s*code/],
    amt_received: [/amt\s*received/, /amount\s*received/, /receipts?/, /^received$/, /^credit$/, /\bcr\b/],
    amt_paid: [/amt\s*paid/, /amount\s*paid/, /payments?/, /^paid$/, /^debit$/, /\bdr\b/],
    credit: [/^credit$/, /\bcr\b/, /deposits?/],
    debit: [/^debit$/, /\bdr\b/, /withdrawals?/],
  }
  const SOFT: Record<string, RegExp[]> = {
    doc_ref: [/ref/, /receipt/, /number/],
    chq_no: [/chq/, /cheque/, /number/],
    amt_received: [/received/, /credit/, /deposit/, /amount/, /amt/],
    amt_paid: [/paid/, /debit/, /withdrawal/, /amount/, /amt/],
    credit: [/credit/, /deposit/, /amount/, /amt/],
    debit: [/debit/, /withdrawal/, /amount/, /amt/],
  }
  const strong = (STRONG[field] || []).some((p) => p.test(h))
  if (strong) return 'high'
  const soft = (SOFT[field] || [/amount/, /date/, /desc/, /ref/, /details/]).some((p) => p.test(h))
  return soft ? 'medium' : 'low'
}

type ProjectMapProps = { projectId: string; canMap?: boolean; onProceedToReconcile?: () => void }

export default function ProjectMap({ projectId, canMap = true, onProceedToReconcile }: ProjectMapProps) {
  const id = projectId
  const queryClient = useQueryClient()
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
  const [mapping, setMapping] = useState<Record<string, number>>({})
  const [error, setError] = useState('')
  const [mapResult, setMapResult] = useState<MapDocumentResponse | null>(null)

  const { data: project } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projects.get(id!),
    enabled: !!id,
  })

  const { data: preview, isLoading: previewLoading } = useQuery({
    queryKey: ['document-preview', selectedDocId],
    queryFn: () => documents.preview(selectedDocId!),
    enabled: !!selectedDocId,
  })

  const mapMutation = useMutation({
    mutationFn: (docId: string) =>
      documents.map(docId, { mapping, sheetIndex: 0 }),
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
    onError: (err) => setError(err instanceof Error ? err.message : 'Mapping failed'),
  })

  const [applyingAll, setApplyingAll] = useState(false)
  const docs = project?.documents || []
  const selectedDoc = docs.find((d: { id: string }) => d.id === selectedDocId)
  async function applySuggestedToAll() {
    if (!docs.length) return
    setError('')
    setApplyingAll(true)
    let done = 0
    try {
      let totalWarnings = 0
      for (const doc of docs as { id: string; type: string }[]) {
        const pre = await documents.preview(doc.id)
        const headers = pre.headers || []
        const isCashBook = doc.type.startsWith('cash_book_')
        const existing = (pre.suggestedMapping && Object.keys(pre.suggestedMapping).length > 0)
          ? { ...pre.suggestedMapping }
          : {}
        const suggested = buildSuggestedMapping(headers, isCashBook, existing)
        const result = await documents.map(doc.id, { mapping: suggested, sheetIndex: 0 })
        totalWarnings += result.signWarningsCount || 0
        done++
      }
      queryClient.invalidateQueries({ queryKey: ['project', id] })
      queryClient.invalidateQueries({ queryKey: ['subscription', 'usage'] })
      setMapResult({
        count: done,
        signWarningsCount: totalWarnings,
      })
      onProceedToReconcile?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply to all')
    } finally {
      setApplyingAll(false)
    }
  }

  useEffect(() => {
    if (preview && !Object.keys(mapping).length && selectedDoc) {
      const headers = preview.headers || []
      const isCashBook = (selectedDoc as { type?: string }).type?.startsWith('cash_book_') ?? false
      const existing = (preview.suggestedMapping && Object.keys(preview.suggestedMapping).length > 0)
        ? { ...preview.suggestedMapping }
        : {}
      const suggested = buildSuggestedMapping(headers, isCashBook, existing)
      setMapping(suggested)
    }
  }, [preview, selectedDoc, mapping])

  const liveConfidence = useMemo(() => {
    if (!preview?.headers) return {} as Record<string, MappingConfidence>
    const headers = preview.headers as string[]
    const out: Record<string, MappingConfidence> = {}
    for (const [field, idx] of Object.entries(mapping)) {
      const header = headers[idx] ?? ''
      out[field] = confidenceForMappedField(field, header)
    }
    return out
  }, [preview, mapping])

  if (!id || !project) return <div>Loading...</div>

  const canonicalFields = selectedDoc?.type?.startsWith('cash_book_')
    ? CASH_BOOK_FIELDS
    : BANK_FIELDS

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Column mapping</h2>
      <p className="text-sm text-gray-600 max-w-2xl">
        <strong>One-time setup.</strong> We read your column headers (Date, Amount, Credit, Debit, etc.) and suggest how they map. After this, <strong>Reconcile runs automatically</strong>—matching and suggestions are done for you. Use the button below to apply suggested mappings to all documents in one go, or map each document individually if you need to adjust.
      </p>
      <p className="text-xs text-slate-600 max-w-2xl rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
        <strong>Required:</strong> Map the <strong>date</strong> column for each document so transactions can be matched correctly.
      </p>
      <p className="text-xs text-blue-700 max-w-2xl rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
        <strong>Signed amount mode:</strong> if one amount column contains mixed entries, positive amounts are treated as receipts/credits and negative amounts as payments/debits.
      </p>
      {!canMap && (
        <p className="text-sm text-amber-600">You have view-only access. Contact an admin, reviewer, or preparer to map documents.</p>
      )}
      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>
      )}
      {mapResult && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2">
          <p className="text-sm text-slate-700">
            Mapping complete: <strong>{mapResult.count}</strong> transaction(s) extracted.
            {(mapResult.signWarningsCount || 0) > 0 && (
              <span className="ml-1 text-amber-700">
                {mapResult.signWarningsCount} sign warning(s) found.
              </span>
            )}
          </p>
          {mapResult.signFilterSummary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="rounded border border-green-200 bg-green-50 px-2 py-1">Primary: {mapResult.signFilterSummary.primary ?? 0}</div>
              <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1">Cross-ref: {mapResult.signFilterSummary.cross_reference ?? 0}</div>
              <div className="rounded border border-orange-200 bg-orange-50 px-2 py-1">Zero: {mapResult.signFilterSummary.zero ?? 0}</div>
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
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={applySuggestedToAll}
            disabled={applyingAll}
            className="px-4 py-2.5 bg-primary-600 text-white rounded-xl font-medium shadow-sm hover:bg-primary-700 disabled:opacity-50"
          >
            {applyingAll ? 'Applying to all…' : 'Apply suggested mapping to all documents'}
          </button>
          <span className="text-xs text-gray-500">
            One click — we detect columns from your file headers and apply mapping to every document.
          </span>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Or select a document to map or adjust
        </label>
        <select
          value={selectedDocId || ''}
          onChange={(e) => {
            setSelectedDocId(e.target.value || null)
            setMapping({})
          }}
          className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900"
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
          ) : preview ? (
            <div className="bg-white shadow rounded-lg p-4 sm:p-6 space-y-4 border border-gray-200">
              <h3 className="font-medium text-gray-900">{preview.filename}</h3>
              <p className="text-sm text-gray-500">
                {preview.totalRows} rows
                {preview.detectedBankFormat && (
                  <span className="ml-2 px-1.5 py-0.5 text-xs bg-green-100 text-green-800 rounded">
                    {String(preview.detectedBankFormat).charAt(0).toUpperCase() + String(preview.detectedBankFormat).slice(1)} format detected
                  </span>
                )}
              </p>
              {(preview as { pdfTruncated?: boolean }).pdfTruncated && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
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
                      className="w-full sm:flex-1 sm:max-w-xs px-3 py-2.5 min-h-[44px] border border-gray-200 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary-500"
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
                className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium"
              >
                {mapMutation.isPending ? 'Applying...' : 'Apply mapping'}
              </button>
              )}
            </div>
          ) : null}
        </>
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
