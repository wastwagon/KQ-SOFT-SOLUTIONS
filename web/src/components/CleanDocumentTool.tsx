import { useId, useRef, useState } from 'react'
import { FileSpreadsheet, FileText, Upload, Download } from 'lucide-react'
import PageHeader from './layout/PageHeader'
import Card from './ui/Card'
import Button from './ui/Button'
import {
  cleanTools,
  isSubscriptionInactiveError,
  unlessSubscriptionInactive,
  type CleanPreviewResult,
  type CleanToolKind,
} from '../lib/api'
import { useToast } from './ui/Toast'
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

const COPY: Record<
  CleanToolKind,
  { title: string; eyebrow: string; blurb: string; acceptHint: string }
> = {
  'bank-statement': {
    title: 'Clean bank statement',
    eyebrow: 'Tools',
    blurb:
      'Upload a bank statement PDF or Excel file to extract transactions with the BRS parsers. Rows are ordered newest date first. Download a cleaned Excel or PDF for other uses — no reconciliation project required.',
    acceptHint: 'PDF, Excel (.xlsx / .xls / .xlsm), CSV, or image',
  },
  'cash-book': {
    title: 'Clean cash book',
    eyebrow: 'Tools',
    blurb:
      'Upload a cash book Excel, CSV, or PDF to normalise receipts and payments into a clean transaction table. Rows are ordered newest date first. Download Excel or PDF — no reconciliation project required.',
    acceptHint: 'Excel (.xlsx / .xls / .xlsm), CSV, PDF, or image',
  },
}

export default function CleanDocumentTool({ kind }: { kind: CleanToolKind }) {
  const copy = COPY[kind]
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const toast = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<CleanPreviewResult | null>(null)
  const [error, setError] = useState('')
  const [paywall, setPaywall] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [downloading, setDownloading] = useState<'xlsx' | 'pdf' | null>(null)

  async function runPreview(next: File) {
    setFile(next)
    setPreview(null)
    setError('')
    setPaywall(false)
    setParsing(true)
    try {
      const result = await cleanTools.preview(kind, next)
      setPreview(result)
      if (result.rowCount === 0) {
        toast.warning('Parsed, but no transaction rows were found.')
      } else {
        toast.success(`Parsed ${result.rowCount.toLocaleString()} transactions.`)
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

  async function download(format: 'xlsx' | 'pdf') {
    if (!file) return
    setDownloading(format)
    setError('')
    setPaywall(false)
    try {
      const blob = await cleanTools.download(kind, file, format)
      const stem = file.name.replace(/\.[^.]+$/, '') || 'cleaned'
      const suffix = kind === 'cash-book' ? 'cash-book' : 'bank-statement'
      triggerBlobDownload(blob, `${stem}-${suffix}-cleaned.${format === 'pdf' ? 'pdf' : 'xlsx'}`)
      toast.success(format === 'pdf' ? 'PDF downloaded.' : 'Excel downloaded.')
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

  return (
    <div className="space-y-8 w-full">
      <PageHeader
        eyebrow={copy.eyebrow}
        title={copy.title}
        subtitle={<p className="max-w-3xl">{copy.blurb}</p>}
      />

      {paywall && <SubscriptionRenewalPanel />}

      <Card title="Upload file" className="shadow-sm">
        <p className="text-sm text-gray-600 mb-4">
          Accepted: {copy.acceptHint}. Parsing uses the same engines as project uploads.
        </p>
        <input
          ref={inputRef}
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
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="primary"
            isLoading={parsing}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="w-4 h-4 mr-2" aria-hidden />
            {file ? 'Choose another file' : 'Choose file'}
          </Button>
          {file && (
            <p className="text-sm text-gray-700 truncate max-w-md">
              <span className="font-medium">{file.name}</span>
              <span className="text-gray-500"> · {(file.size / 1024).toFixed(1)} KB</span>
            </p>
          )}
        </div>
        {error && !paywall && (
          <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </Card>

      {preview && (
        <Card title="Parse result" className="shadow-sm">
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

          <div className="flex flex-wrap gap-3 mb-6">
            <Button
              type="button"
              variant="primary"
              isLoading={downloading === 'xlsx'}
              disabled={!!downloading || preview.rowCount === 0}
              onClick={() => void download('xlsx')}
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" aria-hidden />
              Download Excel
            </Button>
            <Button
              type="button"
              variant="outline"
              isLoading={downloading === 'pdf'}
              disabled={!!downloading || preview.rowCount === 0}
              onClick={() => void download('pdf')}
            >
              <FileText className="w-4 h-4 mr-2" aria-hidden />
              Download PDF
            </Button>
          </div>

          {preview.sampleRows.length > 0 && (
            <div className="w-full rounded-lg border border-border overflow-x-auto md:overflow-visible">
              <table className="w-full table-fixed text-xs text-left">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    {preview.headers.map((h) => {
                      const isDesc = /desc|narration/i.test(h)
                      const isAmount = /debit|credit|balance|amt|amount|payment|receipt/i.test(h)
                      return (
                        <th
                          key={h}
                          className={`px-3 py-2 font-semibold ${
                            isDesc ? 'w-[36%]' : isAmount ? 'w-[11%] text-right' : 'w-[10%]'
                          }`}
                        >
                          {h}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {preview.sampleRows.map((row, i) => (
                    <tr key={i} className="border-t border-gray-100 align-top">
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
                          <td
                            key={j}
                            className={`px-3 py-2 text-gray-800 ${
                              isAmount
                                ? 'text-right whitespace-nowrap tabular-nums'
                                : isDesc
                                  ? 'break-words whitespace-normal'
                                  : 'break-words'
                            }`}
                          >
                            {content}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.rowCount > preview.sampleRows.length && (
                <p className="px-3 py-2 text-xs text-gray-500 border-t border-gray-100 bg-gray-50">
                  Showing first {preview.sampleRows.length} of {preview.rowCount.toLocaleString()}{' '}
                  rows. Download Excel or PDF for the full extract.
                </p>
              )}
            </div>
          )}

          <p className="mt-4 text-xs text-gray-500 flex items-start gap-2">
            <Download className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden />
            Cleaned files are for review and other workflows. To reconcile against a cash book, create
            a project and upload there instead.
          </p>
        </Card>
      )}
    </div>
  )
}
