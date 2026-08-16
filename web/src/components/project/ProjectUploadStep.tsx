import { useId, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, FileSpreadsheet, FolderKanban, Landmark, Upload } from 'lucide-react'
import {
  bankAccounts,
  uploadBankStatement,
  uploadCashBook,
  isSubscriptionInactiveError,
  unlessSubscriptionInactive,
} from '../../lib/api'
import { PROJECT_UPLOAD_LIMITS_SUMMARY, validateProjectUploadFiles } from '../../lib/uploadConstraints'
import { canUploadDocuments } from '../../lib/permissions'
import { useToast } from '../ui/Toast'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import Badge from '../ui/Badge'
import Card from '../ui/Card'
import Input from '../ui/Input'
import Select from '../ui/Select'
import SubscriptionRenewalPanel from '../SubscriptionRenewalPanel'
import WorkflowStepIntro from './WorkflowStepIntro'
import WorkflowStepSkeleton from './WorkflowStepSkeleton'

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

  const bankAccountsQuery = useQuery({
    queryKey: ['bankAccounts', projectSlug],
    queryFn: () => bankAccounts.list(projectSlug),
    enabled: !!projectSlug,
  })
  const { data: bankAccountsList = [], isLoading: bankAccountsLoading, isError: bankAccountsQueryFailed } =
    bankAccountsQuery
  const paywallBlocked = isSubscriptionInactiveError(bankAccountsQuery.error)
  const bankAccountsLoadFailed = !paywallBlocked && bankAccountsQueryFailed

  const uploadCb = useMutation({
    mutationFn: async ({ files, useAs }: { files: File[]; useAs: CashBookUseAs }) => {
      const types: ('receipts' | 'payments')[] =
        useAs === 'both' ? ['receipts', 'payments'] : [useAs]
      const total = files.length * types.length
      setProgress({ current: 0, total })
      let n = 0
      const corrections: string[] = []
      for (const file of files) {
        for (const type of types) {
          n += 1
          setProgress({ current: n, total })
          const result = await uploadCashBook(projectSlug, file, type)
          const corrected = result?.autoMap?.typeCorrected as
            | { from: string; to: string }
            | undefined
          if (corrected) {
            corrections.push(
              `${file.name}: treated as ${formatDocType(corrected.to)} (was uploaded as cash book)`
            )
          }
        }
      }
      setProgress(null)
      return { corrections }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project', projectSlug] })
      setCbFiles([])
      if (data?.corrections?.length) {
        toast.success(
          'Cash book uploaded — type adjusted',
          data.corrections.slice(0, 2).join(' · ')
        )
      } else {
        toast.success(
          'Cash book uploaded',
          'Parsing may continue in the background — open Map when ready.'
        )
      }
    },
    onError: (err) => {
      setProgress(null)
      unlessSubscriptionInactive(err, (e) =>
        toast.error('Cash book upload failed', e instanceof Error ? e.message : undefined)
      )
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
      const corrections: string[] = []
      const opts = {
        bankAccountId: accId || undefined,
        accountName: accountName || undefined,
        accountNo: accountNo || undefined,
      }
      for (const file of files) {
        for (const type of types) {
          n += 1
          setProgress({ current: n, total })
          const result = await uploadBankStatement(projectSlug, file, type, opts)
          const corrected = result?.autoMap?.typeCorrected as
            | { from: string; to: string }
            | undefined
          if (corrected) {
            corrections.push(
              `${file.name}: treated as ${formatDocType(corrected.to)} (was uploaded as bank statement)`
            )
          }
        }
      }
      setProgress(null)
      return { corrections }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['project', projectSlug] })
      queryClient.invalidateQueries({ queryKey: ['bankAccounts', projectSlug] })
      setBsFiles([])
      setBankAccountNo('')
      setBankAccountName('')
      if (data?.corrections?.length) {
        toast.success(
          'Bank statement uploaded — type adjusted',
          data.corrections.slice(0, 2).join(' · ')
        )
      } else {
        toast.success(
          'Bank statement uploaded',
          'Parsing may continue in the background — open Map when ready.'
        )
      }
    },
    onError: (err) => {
      setProgress(null)
      unlessSubscriptionInactive(err, (e) =>
        toast.error('Bank statement upload failed', e instanceof Error ? e.message : undefined)
      )
    },
  })

  const isUploading = uploadCb.isPending || uploadBs.isPending
  const accounts = bankAccountsList as { id: string; name: string }[]

  if (paywallBlocked) {
    return (
      <div className="space-y-6">
        <SubscriptionRenewalPanel />
      </div>
    )
  }

  if (bankAccountsLoadFailed) {
    const err = bankAccountsQuery.error
    return (
      <div className="space-y-6">
        <Alert
          tone="error"
          title="Could not load bank accounts"
          onRetry={() => queryClient.invalidateQueries({ queryKey: ['bankAccounts', projectSlug] })}
        >
          {err instanceof Error ? err.message : 'Something went wrong.'}
        </Alert>
      </div>
    )
  }

  if (bankAccountsLoading) {
    return <WorkflowStepSkeleton bodyRows={2} />
  }

  return (
    <div className="space-y-6">
      <WorkflowStepIntro
        eyebrow="Upload"
        title="Upload documents"
        subtitle="Upload a cash book and a bank statement (Excel, CSV, PDF, or image). Choose Both if one file has receipts and payments. Map columns next."
      />
      <p className="text-xs text-gray-500">{PROJECT_UPLOAD_LIMITS_SUMMARY}</p>
      {!canUpload && (
        <Alert tone="info" title="View only">
          Contact an administrator to upload documents.
        </Alert>
      )}

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
                isUploading={uploadCb.isPending}
                progress={uploadCb.isPending ? progress : null}
                disabled={cbFiles.length === 0 || isUploading}
                ariaLabel="Cash book files"
                onSubmit={() => {
                  const v = validateProjectUploadFiles(cbFiles)
                  if (!v.ok) {
                    toast.error('Cannot upload', v.message)
                    return
                  }
                  uploadCb.mutate({ files: cbFiles, useAs: cbUseAs })
                }}
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
                    <Input
                      type="text"
                      placeholder="Account name (optional)"
                      value={bankAccountName}
                      onChange={(e) => setBankAccountName(e.target.value)}
                    />
                    <Input
                      type="text"
                      placeholder="Account number (optional)"
                      value={bankAccountNo}
                      onChange={(e) => setBankAccountNo(e.target.value)}
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
                isUploading={uploadBs.isPending}
                progress={uploadBs.isPending ? progress : null}
                disabled={bsFiles.length === 0 || isUploading}
                ariaLabel="Bank statement files"
                onSubmit={() => {
                  const v = validateProjectUploadFiles(bsFiles)
                  if (!v.ok) {
                    toast.error('Cannot upload', v.message)
                    return
                  }
                  uploadBs.mutate({
                    files: bsFiles,
                    useAs: bsUseAs,
                    bankAccountId: bankAccountId || undefined,
                    accountName: bankAccountId ? undefined : bankAccountName || undefined,
                    accountNo: bankAccountId ? undefined : bankAccountNo || undefined,
                  })
                }}
              />
            </>
          )}
          {!canUpload && bankDocs.length === 0 && (
            <p className="text-xs text-gray-500">No bank statement uploaded.</p>
          )}
        </UploadCard>
      </div>

      {cashBookDocs.length + bankDocs.length > 0 && (
        <details className="group rounded-xl border border-border bg-white p-4 shadow-card">
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

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          {cashBookDocs.length + bankDocs.length > 0
            ? 'Documents uploaded. Map columns next, then reconcile.'
            : 'Upload at least one cash book and one bank statement to continue.'}
        </p>
        <Button
          type="button"
          onClick={onProceed}
          disabled={cashBookDocs.length === 0 || bankDocs.length === 0}
        >
          Proceed to Map
          <ArrowRight className="h-4 w-4 ml-1" aria-hidden="true" />
        </Button>
        </div>
      </Card>
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

function formatDocType(type: string): string {
  switch (type) {
    case 'cash_book_receipts':
      return 'cash book receipts'
    case 'cash_book_payments':
      return 'cash book payments'
    case 'bank_credits':
      return 'bank credits'
    case 'bank_debits':
      return 'bank debits'
    default:
      return type.replace(/_/g, ' ')
  }
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
    <Card
      title={
        <span className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-600"
          >
            <Icon className="h-4.5 w-4.5" />
          </span>
          {title}
        </span>
      }
      actions={
        uploadedCount > 0 ? (
          <Badge tone="success" size="sm">
            {uploadedCount} file{uploadedCount === 1 ? '' : 's'}
          </Badge>
        ) : undefined
      }
    >
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
    </Card>
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
    <Select label={label} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  )
}

const UPLOAD_ACCEPT = '.xlsx,.xls,.xlsm,.csv,.pdf,.png,.jpg,.jpeg,.tiff,.tif,.bmp'

function FilePickerRow({
  files,
  onFiles,
  disabled,
  onSubmit,
  isUploading,
  progress,
  ariaLabel,
}: {
  files: File[]
  onFiles: (files: File[]) => void
  disabled: boolean
  onSubmit: () => void
  isUploading: boolean
  progress: { current: number; total: number } | null
  ariaLabel: string
}) {
  const inputId = useId()
  return (
    <div className="space-y-3">
      <input
        id={inputId}
        type="file"
        multiple
        className="sr-only"
        accept={UPLOAD_ACCEPT}
        aria-label={ariaLabel}
        onChange={(e) => {
          onFiles(Array.from(e.target.files || []))
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
          const next = Array.from(e.dataTransfer.files || [])
          if (next.length) onFiles(next)
        }}
        className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-gray-50/60 px-4 py-6 text-center hover:border-primary-300 hover:bg-primary-50/40 focus-within:border-primary-500"
      >
        <Upload className="h-5 w-5 text-gray-400 mb-1.5" aria-hidden />
        <p className="text-sm font-medium text-gray-900">
          {files.length > 0
            ? 'Drop more files or click to replace'
            : 'Drop files here or click to choose'}
        </p>
        {files.length > 0 && (
          <p className="mt-1 text-xs text-gray-600 truncate max-w-full">
            {files.length === 1 ? files[0]!.name : `${files.length} files · ${files[0]!.name}…`}
          </p>
        )}
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" onClick={onSubmit} disabled={disabled} isLoading={isUploading}>
          <Upload className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
          Upload
        </Button>
        {isUploading && progress && progress.total > 1 && (
          <span className="text-xs text-gray-500">
            {progress.current}/{progress.total}
          </span>
        )}
      </div>
    </div>
  )
}
