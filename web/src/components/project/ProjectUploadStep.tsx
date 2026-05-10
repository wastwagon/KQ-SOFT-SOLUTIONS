import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, ChevronDown, FileSpreadsheet, FolderKanban, Landmark, Upload } from 'lucide-react'
import { bankAccounts, uploadBankStatement, uploadCashBook } from '../../lib/api'
import { canUploadDocuments } from '../../lib/permissions'
import { useToast } from '../ui/Toast'

/**
 * Upload step of the project workflow.  Lifted out of ProjectDetail so the
 * 240-line "select file → choose use-as → upload" UI doesn't drown the rest
 * of the page.  Owns its own mutation + progress state.
 */
type CashBookUseAs = 'receipts' | 'payments' | 'both'
type BankUseAs = 'credits' | 'debits' | 'both'

interface ProjectDocument {
  filename: string
  type: string
}

export interface ProjectUploadStepProps {
  projectSlug: string
  documents: ProjectDocument[]
  role: string | null
  /** Called when the user clicks "Proceed to Map →" so the parent can advance. */
  onProceed: () => void
}

export default function ProjectUploadStep({
  projectSlug,
  documents,
  role,
  onProceed,
}: ProjectUploadStepProps) {
  const queryClient = useQueryClient()
  const toast = useToast()

  const canUpload = canUploadDocuments(role)

  const [cbFiles, setCbFiles] = useState<File[]>([])
  const [cbUseAs, setCbUseAs] = useState<CashBookUseAs>('both')
  const [bsFiles, setBsFiles] = useState<File[]>([])
  const [bsUseAs, setBsUseAs] = useState<BankUseAs>('both')
  const [bankAccountId, setBankAccountId] = useState('')
  const [bankAccountName, setBankAccountName] = useState('')
  const [bankAccountNo, setBankAccountNo] = useState('')
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null)

  const cashBookDocs = documents.filter((d) => d.type.startsWith('cash_book_'))
  const bankDocs = documents.filter((d) => d.type.startsWith('bank_'))
  const uniqueCashBookFiles = new Set(cashBookDocs.map((d) => d.filename)).size
  const uniqueBankFiles = new Set(bankDocs.map((d) => d.filename)).size

  const groupedCashBookFiles = groupByFilename(cashBookDocs)
  const groupedBankFiles = groupByFilename(bankDocs)

  const { data: bankAccountsList = [] } = useQuery({
    queryKey: ['bankAccounts', projectSlug],
    queryFn: () => bankAccounts.list(projectSlug),
    enabled: !!projectSlug,
  })

  const uploadCb = useMutation({
    mutationFn: async ({ files, useAs }: { files: File[]; useAs: CashBookUseAs }) => {
      const types: ('receipts' | 'payments')[] =
        useAs === 'both' ? ['receipts', 'payments'] : [useAs]
      const total = files.length * types.length
      setProgress({ current: 0, total })
      let n = 0
      for (const file of files) {
        for (const type of types) {
          n += 1
          setProgress({ current: n, total })
          await uploadCashBook(projectSlug, file, type)
        }
      }
      setProgress(null)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectSlug] })
      setCbFiles([])
      toast.success('Cash book uploaded', 'Map columns next so we can read your data.')
    },
    onError: (err) => {
      setProgress(null)
      toast.error('Cash book upload failed', err instanceof Error ? err.message : undefined)
    },
  })

  const uploadBs = useMutation({
    mutationFn: async ({
      files,
      useAs,
      bankAccountId: accId,
      accountName,
      accountNo,
    }: {
      files: File[]
      useAs: BankUseAs
      bankAccountId?: string
      accountName?: string
      accountNo?: string
    }) => {
      const types: ('credits' | 'debits')[] =
        useAs === 'both' ? ['credits', 'debits'] : [useAs]
      const total = files.length * types.length
      setProgress({ current: 0, total })
      let n = 0
      const opts = {
        bankAccountId: accId || undefined,
        accountName: accountName || undefined,
        accountNo: accountNo || undefined,
      }
      for (const file of files) {
        for (const type of types) {
          n += 1
          setProgress({ current: n, total })
          await uploadBankStatement(projectSlug, file, type, opts)
        }
      }
      setProgress(null)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectSlug] })
      queryClient.invalidateQueries({ queryKey: ['bankAccounts', projectSlug] })
      setBsFiles([])
      setBankAccountNo('')
      setBankAccountName('')
      toast.success('Bank statement uploaded', 'Map columns next so we can read your data.')
    },
    onError: (err) => {
      setProgress(null)
      toast.error('Bank statement upload failed', err instanceof Error ? err.message : undefined)
    },
  })

  const isUploading = uploadCb.isPending || uploadBs.isPending
  const accounts = bankAccountsList as { id: string; name: string }[]

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-primary-100 bg-primary-50/50 p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700"
          >
            <FolderKanban className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-gray-900">
              Upload documents
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-gray-600">
              To begin reconciliation, upload your <strong>Cash Book</strong> and{' '}
              <strong>Bank Statement</strong>. If a single document contains both
              receipts and payments, choose &quot;Both&quot;. We will detect and
              suggest column mappings in the next step.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Hint dotColor="bg-primary-500" text="Cash book date required" />
              <Hint dotColor="bg-blue-500" text="Excel, CSV, PDF, and images supported" />
            </div>
          </div>
        </div>
        {!canUpload && (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            View-only access. Contact an administrator to upload documents.
          </p>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <UploadCard
          icon={FileSpreadsheet}
          title="Cash book"
          uploadedCount={uniqueCashBookFiles}
          totalDocCount={cashBookDocs.length}
          uploadedHint="receipts and payments"
          canUpload={canUpload}
        >
          {canUpload && (
            <>
              <SelectField
                label="Use as"
                value={cbUseAs}
                onChange={(v) => setCbUseAs(v as CashBookUseAs)}
                options={[
                  { value: 'both', label: 'Both (receipts + payments) — one document' },
                  { value: 'receipts', label: 'Receipts only' },
                  { value: 'payments', label: 'Payments only' },
                ]}
              />
              <FilePickerRow
                files={cbFiles}
                onFiles={setCbFiles}
                buttonLabel={progressLabel('Upload', uploadCb.isPending, progress)}
                disabled={cbFiles.length === 0 || isUploading}
                onSubmit={() => uploadCb.mutate({ files: cbFiles, useAs: cbUseAs })}
              />
            </>
          )}
        </UploadCard>

        <UploadCard
          icon={Landmark}
          title="Bank statement"
          uploadedCount={uniqueBankFiles}
          totalDocCount={bankDocs.length}
          uploadedHint="credits and debits"
          canUpload={canUpload}
        >
          {canUpload && (
            <>
              <div className="space-y-2">
                {accounts.length > 0 && (
                  <SelectField
                    label="Bank account"
                    value={bankAccountId}
                    onChange={setBankAccountId}
                    options={[
                      { value: '', label: 'New / unspecified account' },
                      ...accounts.map((a) => ({ value: a.id, label: a.name })),
                    ]}
                  />
                )}
                {bankAccountId === '' && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input
                      type="text"
                      placeholder="Account name (optional)"
                      value={bankAccountName}
                      onChange={(e) => setBankAccountName(e.target.value)}
                      className="min-h-[40px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    />
                    <input
                      type="text"
                      placeholder="Account number (optional)"
                      value={bankAccountNo}
                      onChange={(e) => setBankAccountNo(e.target.value)}
                      className="min-h-[40px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                    />
                  </div>
                )}
              </div>
              <SelectField
                label="Use as"
                value={bsUseAs}
                onChange={(v) => setBsUseAs(v as BankUseAs)}
                options={[
                  { value: 'both', label: 'Both (credits + debits) — one statement' },
                  { value: 'credits', label: 'Credits only' },
                  { value: 'debits', label: 'Debits only' },
                ]}
              />
              <FilePickerRow
                files={bsFiles}
                onFiles={setBsFiles}
                buttonLabel={progressLabel('Upload', uploadBs.isPending, progress)}
                disabled={bsFiles.length === 0 || isUploading}
                onSubmit={() =>
                  uploadBs.mutate({
                    files: bsFiles,
                    useAs: bsUseAs,
                    bankAccountId: bankAccountId || undefined,
                    accountName: bankAccountId ? undefined : bankAccountName || undefined,
                    accountNo: bankAccountId ? undefined : bankAccountNo || undefined,
                  })
                }
              />
            </>
          )}
          {!canUpload && bankDocs.length === 0 && (
            <p className="text-xs text-gray-500">No bank statement uploaded.</p>
          )}
        </UploadCard>
      </div>

      {cashBookDocs.length + bankDocs.length > 0 && (
        <details className="group rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-gray-500 transition-colors group-open:text-gray-700">
            Uploaded files
          </summary>
          <ul className="mt-3 space-y-1.5 text-sm text-gray-600">
            {groupedCashBookFiles.map(([filename, types]) => {
              const hasReceipts = types.has('cash_book_receipts')
              const hasPayments = types.has('cash_book_payments')
              const label =
                hasReceipts && hasPayments
                  ? 'receipts + payments'
                  : hasReceipts
                    ? 'receipts'
                    : 'payments'
              return (
                <li key={`cb-${filename}`} className="break-words">
                  <span className="font-medium text-gray-700">Cash book</span>{' '}
                  <span className="text-gray-500">({label})</span>
                  <span className="text-gray-400"> · </span>
                  {filename}
                </li>
              )
            })}
            {groupedBankFiles.map(([filename, types]) => {
              const hasCredits = types.has('bank_credits')
              const hasDebits = types.has('bank_debits')
              const label =
                hasCredits && hasDebits ? 'credits + debits' : hasCredits ? 'credits' : 'debits'
              return (
                <li key={`bank-${filename}`} className="break-words">
                  <span className="font-medium text-gray-700">Bank</span>{' '}
                  <span className="text-gray-500">({label})</span>
                  <span className="text-gray-400"> · </span>
                  {filename}
                </li>
              )
            })}
          </ul>
        </details>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-gray-600">
          {cashBookDocs.length + bankDocs.length > 0
            ? 'Documents uploaded. Map columns next, then reconcile.'
            : 'Upload at least one cash book and one bank statement to continue.'}
        </p>
        <button
          type="button"
          onClick={onProceed}
          disabled={cashBookDocs.length === 0 || bankDocs.length === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary-600/20 transition-colors hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
        >
          Proceed to Map
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

function groupByFilename(
  docs: ProjectDocument[]
): Array<[string, Set<string>]> {
  const map = new Map<string, Set<string>>()
  for (const d of docs) {
    if (!map.has(d.filename)) map.set(d.filename, new Set())
    map.get(d.filename)!.add(d.type)
  }
  return Array.from(map)
}

function progressLabel(
  defaultLabel: string,
  isPending: boolean,
  progress: { current: number; total: number } | null
): string {
  if (!isPending) return defaultLabel
  if (progress && progress.total > 0) return `${progress.current}/${progress.total}`
  return 'Uploading…'
}

function Hint({ dotColor, text }: { dotColor: string; text: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-lg border border-primary-100 bg-white px-3 py-1.5 text-xs font-medium text-primary-700">
      <span className={`h-2 w-2 rounded-full ${dotColor}`} aria-hidden="true" />
      {text}
    </span>
  )
}

function UploadCard({
  icon: Icon,
  title,
  uploadedCount,
  totalDocCount,
  uploadedHint,
  canUpload,
  children,
}: {
  icon: typeof FolderKanban
  title: string
  uploadedCount: number
  totalDocCount: number
  uploadedHint: string
  canUpload: boolean
  children: React.ReactNode
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-600"
        >
          <Icon className="h-4.5 w-4.5" />
        </span>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {uploadedCount > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-green-700 ring-1 ring-green-100">
            {uploadedCount} file{uploadedCount === 1 ? '' : 's'}
          </span>
        )}
      </div>
      {children}
      {uploadedCount > 0 && (
        <p className="border-t border-gray-100 pt-3 text-xs text-gray-500">
          ✓ {uploadedCount} file{uploadedCount === 1 ? '' : 's'} uploaded
          {totalDocCount > uploadedCount
            ? ` (one document used for ${uploadedHint})`
            : ''}
        </p>
      )}
      {!canUpload && uploadedCount === 0 && (
        <p className="text-xs text-gray-500">Nothing uploaded yet.</p>
      )}
    </div>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </span>
      <span className="relative block">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[40px] w-full appearance-none rounded-lg border border-gray-200 bg-white pl-3 pr-9 py-2 text-sm text-gray-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          aria-hidden="true"
        />
      </span>
    </label>
  )
}

function FilePickerRow({
  files,
  onFiles,
  buttonLabel,
  disabled,
  onSubmit,
}: {
  files: File[]
  onFiles: (files: File[]) => void
  buttonLabel: string
  disabled: boolean
  onSubmit: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="file"
        multiple
        accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg,.tiff"
        onChange={(e) => onFiles(Array.from(e.target.files || []))}
        className="text-xs text-gray-500 file:mr-2 file:cursor-pointer file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-1.5 file:text-xs file:text-primary-700"
      />
      {files.length > 0 && (
        <span className="text-xs text-gray-500">
          {files.length} file{files.length === 1 ? '' : 's'}
        </span>
      )}
      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-50"
      >
        <Upload className="h-3.5 w-3.5" aria-hidden="true" />
        {buttonLabel}
      </button>
    </div>
  )
}
