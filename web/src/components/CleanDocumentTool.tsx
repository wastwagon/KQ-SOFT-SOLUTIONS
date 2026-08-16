import { useId, useState } from 'react'
import { FileSpreadsheet, FileText, Upload, Download } from 'lucide-react'
import PageHeader from './layout/PageHeader'
import Card from './ui/Card'
import Button from './ui/Button'
import {
  cleanTools,
  isSubscriptionInactiveError,
  unlessSubscriptionInactive,
  type CleanDownloadMode,
  type CleanPreviewResult,
  type CleanToolKind,
} from '../lib/api'
import { getStoredDateOrder, setStoredDateOrder, type DateOrder } from '../lib/transactionDateOrder'
import DateOrderToggle from './DateOrderToggle'
import { useToast } from './ui/Toast'
import Alert from './ui/Alert'
import { Table, TableHead, TableBody, TableRow, TableTh, TableTd } from './ui/Table'
import SubscriptionRenewalPanel from './SubscriptionRenewalPanel'

function money(n: number) {
  return n.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function quotaLabel(preview: CleanPreviewResult): string | null {
  const q = preview.cleanExportQuota
  if (!q) return null
  if (q.unlimited) return `${q.used} full exports this month`
  return `${q.used} of ${q.limit} full exports this month`
}

const COPY: Record<
  CleanToolKind,
  { title: string; eyebrow: string; blurb: string; acceptHint: string }
> = {
  'bank-statement': {
    title: 'Clean bank statement',
    eyebrow: 'Tools',
    blurb: 'Same parsers as project uploads. Download a watermarked sample, or a full Excel/PDF on your plan.',
    acceptHint: 'PDF, Excel (.xlsx / .xls / .xlsm), CSV, or image',
  },
  'cash-book': {
    title: 'Clean cash book',
    eyebrow: 'Tools',
    blurb: 'Same cash-book parsers as project uploads. Download a watermarked sample, or a full Excel/PDF on your plan.',
    acceptHint: 'Excel (.xlsx / .xls / .xlsm), CSV, PDF, or image',
  },
}

type DownloadKey = `${CleanDownloadMode}-${'xlsx' | 'pdf'}`

export default function CleanDocumentTool({ kind }: { kind: CleanToolKind }) {
  const copy = COPY[kind]
  const inputId = useId()
  const toast = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<CleanPreviewResult | null>(null)
  const [error, setError] = useState('')
  const [paywall, setPaywall] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [downloading, setDownloading] = useState<DownloadKey | null>(null)
  const [dateOrder, setDateOrder] = useState<DateOrder>(() => getStoredDateOrder())

  async function runPreview(next: File, order: DateOrder = dateOrder, quiet = false) {
    setFile(next)
    if (!quiet) setPreview(null)
    setError('')
    setPaywall(false)
    setParsing(true)
    try {
      const result = await cleanTools.preview(kind, next, order)
      setPreview(result)
      if (!quiet) {
        if (result.rowCount === 0) {
          toast.warning('Parsed, but no transaction rows were found.')
        } else {
          toast.success(`Parsed ${result.rowCount.toLocaleString()} transactions.`)
        }
      }
    } catch (err) {
      if (isSubscriptionInactiveError(err)) {
        setPaywall(true)
        setError(err.message)
      } else {
        unlessSubscriptionInactive(err, (e) => {
          const msg = e instanceof Error ? e.message : 'Failed to parse file'
          setError(msg)
          toast.error(msg)
        })
      }
    } finally {
      setParsing(false)
    }
  }

  function changeDateOrder(next: DateOrder) {
    setDateOrder(next)
    setStoredDateOrder(next)
    if (file) void runPreview(file, next, true)
  }

  async function download(format: 'xlsx' | 'pdf', mode: CleanDownloadMode) {
    if (!file) return
    const key: DownloadKey = `${mode}-${format}`
    setDownloading(key)
    setError('')
    setPaywall(false)
    try {
      const { blob, filename } = await cleanTools.download(kind, file, format, mode, dateOrder)
      triggerBlobDownload(blob, filename)
      toast.success(
        mode === 'sample'
          ? format === 'pdf'
            ? 'Sample PDF downloaded (watermarked).'
            : 'Sample Excel downloaded (watermarked).'
          : format === 'pdf'
            ? 'Full PDF downloaded.'
            : 'Full Excel downloaded.'
      )
      // Refresh quota after full export
      if (mode === 'full') {
        try {
          const refreshed = await cleanTools.preview(kind, file, dateOrder)
          setPreview(refreshed)
        } catch {
          /* keep prior preview */
        }
      }
    } catch (err) {
      if (isSubscriptionInactiveError(err)) {
        setPaywall(true)
        setError(err.message)
      } else {
        unlessSubscriptionInactive(err, (e) => {
          const msg = e instanceof Error ? e.message : 'Download failed'
          setError(msg)
          toast.error(msg)
        })
      }
    } finally {
      setDownloading(null)
    }
  }

  const sampleLimit = preview?.sampleDownloadRowLimit ?? 25
  const fullBlocked =
    !!preview?.cleanExportQuota &&
    !preview.cleanExportQuota.unlimited &&
    (preview.cleanExportQuota.remaining ?? 0) <= 0

  return (
    <div className="space-y-8 w-full">
      <PageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        subtitle={<p className="max-w-3xl">{copy.blurb}</p>}
      />

      {paywall && <SubscriptionRenewalPanel />}

      <Card title="Upload file">
        <p className="text-sm text-gray-600 mb-4">
          Accepted: {copy.acceptHint}. Date order below applies to preview and downloads.
        </p>
        <input
          id={inputId}
          type="file"
          className="sr-only"
          accept=".pdf,.xlsx,.xls,.xlsm,.csv,.png,.jpg,.jpeg,.tiff,.tif,.bmp"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void runPreview(f)
            e.target.value = ''
          }}
        />
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
          }}
          onDrop={(e) => {
            e.preventDefault()
            const f = e.dataTransfer.files?.[0]
            if (f) void runPreview(f)
          }}
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-gray-50/60 px-6 py-10 text-center hover:border-primary-300 hover:bg-primary-50/40 focus-within:border-primary-500"
        >
          <Upload className="h-6 w-6 text-gray-400 mb-2" aria-hidden />
          <p className="text-sm font-medium text-gray-900">
            {parsing ? 'Parsing…' : file ? 'Drop another file or click to replace' : 'Drop a file here or click to choose'}
          </p>
          {file && !parsing && (
            <p className="mt-1 text-sm text-gray-600 truncate max-w-md">
              {file.name}
              <span className="text-gray-400"> · {(file.size / 1024).toFixed(1)} KB</span>
            </p>
          )}
        </label>
        {error && !paywall && (
          <Alert
            tone="error"
            title="Could not parse file"
            className="mt-4"
            onRetry={file ? () => void runPreview(file) : undefined}
          >
            {error}
          </Alert>
        )}
      </Card>

      {preview && (
        <Card title="Parse result">
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-6">
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Rows</dt>
              <dd className="mt-1 text-lg font-semibold text-gray-900">
                {preview.rowCount.toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Parser</dt>
              <dd className="mt-1 font-medium text-gray-900">{preview.parseMethod || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                Debits / payments
              </dt>
              <dd className="mt-1 font-medium text-gray-900">{money(preview.sumDebit)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-gray-500 font-semibold">
                Credits / receipts
              </dt>
              <dd className="mt-1 font-medium text-gray-900">{money(preview.sumCredit)}</dd>
            </div>
          </dl>

          {quotaLabel(preview) && (
            <p className="text-sm text-gray-600 mb-4">{quotaLabel(preview)}</p>
          )}
          {fullBlocked && (
            <Alert tone="warning" title="Full export quota used this month" className="mb-4">
              Sample downloads remain available. Upgrade for more full exports.
            </Alert>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 mb-6 rounded-xl border border-border bg-gray-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-gray-900">Date order for download</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Applies to the preview table and both downloads. Oldest first is the default.
              </p>
            </div>
            <DateOrderToggle
              value={dateOrder}
              onChange={changeDateOrder}
              disabled={parsing || !!downloading}
              ariaLabel="Clean export date order"
            />
          </div>

          <div className="space-y-3 mb-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                Sample (watermarked, up to {sampleLimit} rows)
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="primary"
                  isLoading={downloading === 'sample-xlsx'}
                  disabled={!!downloading || preview.rowCount === 0}
                  onClick={() => void download('xlsx', 'sample')}
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" aria-hidden />
                  Sample Excel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  isLoading={downloading === 'sample-pdf'}
                  disabled={!!downloading || preview.rowCount === 0}
                  onClick={() => void download('pdf', 'sample')}
                >
                  <FileText className="w-4 h-4 mr-2" aria-hidden />
                  Sample PDF
                </Button>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                Full export
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  variant="outline"
                  isLoading={downloading === 'full-xlsx'}
                  disabled={!!downloading || preview.rowCount === 0 || fullBlocked}
                  onClick={() => void download('xlsx', 'full')}
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" aria-hidden />
                  Full Excel
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  isLoading={downloading === 'full-pdf'}
                  disabled={!!downloading || preview.rowCount === 0 || fullBlocked}
                  onClick={() => void download('pdf', 'full')}
                >
                  <FileText className="w-4 h-4 mr-2" aria-hidden />
                  Full PDF
                </Button>
              </div>
            </div>
          </div>

          {preview.sampleRows.length > 0 && (
            <div className="w-full rounded-lg border border-border overflow-hidden">
              <Table className="table-fixed text-xs">
                <TableHead>
                  <tr>
                    {preview.headers.map((h) => {
                      const isDesc = /desc|narration/i.test(h)
                      const isAmount = /debit|credit|balance|amt|amount|payment|receipt/i.test(h)
                      return (
                        <TableTh
                          key={h}
                          className={`normal-case tracking-normal px-3 py-2 ${
                            isDesc ? 'w-[36%]' : isAmount ? 'w-[11%] text-right' : 'w-[10%]'
                          }`}
                        >
                          {h}
                        </TableTh>
                      )
                    })}
                  </tr>
                </TableHead>
                <TableBody>
                  {preview.sampleRows.map((row, i) => (
                    <TableRow key={i} className="align-top">
                      {preview.headers.map((h, j) => {
                        const isAmount = /debit|credit|balance|amt|amount|payment|receipt/i.test(h)
                        const isDesc = /desc|narration/i.test(h)
                        const empty = row[j] == null || row[j] === ''
                        const content =
                          empty
                            ? '—'
                            : typeof row[j] === 'number'
                              ? money(row[j] as number)
                              : String(row[j])
                        return (
                          <TableTd
                            key={j}
                            className={`px-3 py-2 text-xs ${
                              isAmount
                                ? 'text-right whitespace-nowrap tabular-nums'
                                : isDesc
                                  ? 'break-words whitespace-normal'
                                  : 'break-words'
                            }`}
                          >
                            {content}
                          </TableTd>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {preview.rowCount > preview.sampleRows.length && (
                <p className="px-3 py-2 text-xs text-gray-500 border-t border-gray-100 bg-gray-50">
                  Showing first {preview.sampleRows.length} of {preview.rowCount.toLocaleString()}{' '}
                  rows in preview. Sample downloads include up to {sampleLimit} rows with a demo
                  watermark; full downloads include every row and use quota.
                </p>
              )}
            </div>
          )}

          <p className="mt-4 text-xs text-gray-500 flex items-start gap-2">
            <Download className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
            Cleaning validates bank formats. Reconcile against a cash book in a project — that is the
            main BRS product.
          </p>
        </Card>
      )}
    </div>
  )
}
