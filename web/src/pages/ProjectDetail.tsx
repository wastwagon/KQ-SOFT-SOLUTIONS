import { useState, useEffect, useLayoutEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import { useAuth } from '../store/auth'
import { projects, clients, bankAccounts, uploadCashBook, uploadBankStatement } from '../lib/api'
import { canDeleteProject, canEditProject, canUploadDocuments, canReopenProject, canExportReport, canReconcile, canMapDocuments } from '../lib/permissions'
import ErrorFallback from '../components/ErrorFallback'
import ProjectMap from './ProjectMap'
import ProjectReconcile from './ProjectReconcile'
import ProjectReview from './ProjectReview'
import ProjectReport from './ProjectReport'

const STEPS = ['Upload', 'Map', 'Reconcile', 'Review', 'Report']
const STEP_HASHES = ['upload', 'map', 'reconcile', 'review', 'report']
const HASH_TO_STEP: Record<string, number> = Object.fromEntries(STEP_HASHES.map((h, i) => [h, i]))

export default function ProjectDetail() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const role = useAuth((s) => s.role)
  const location = useLocation()
  const queryClient = useQueryClient()
  const [step, setStepState] = useState(() => {
    if (typeof window === 'undefined') return 0
    const h = window.location.hash.slice(1).toLowerCase()
    return HASH_TO_STEP[h] ?? 0
  })

  // Sync URL hash -> step on mount and when hash changes (so #review etc. works when opening link directly)
  const syncHashToStep = () => {
    const h = (typeof window !== 'undefined' ? window.location.hash : location.hash).slice(1).toLowerCase()
    const idx = HASH_TO_STEP[h]
    if (idx !== undefined) setStepState(idx)
  }
  useLayoutEffect(() => {
    syncHashToStep()
  }, [])
  useEffect(() => {
    window.addEventListener('hashchange', syncHashToStep)
    return () => window.removeEventListener('hashchange', syncHashToStep)
  }, [])

  const setStep = (i: number) => {
    setStepState(i)
    const newHash = STEP_HASHES[i]
    if (newHash) {
      const url = `${location.pathname}${location.search}#${newHash}`
      window.history.replaceState(null, '', url)
    }
  }
  const [cbFiles, setCbFiles] = useState<File[]>([])
  const [cbUseAs, setCbUseAs] = useState<'receipts' | 'payments' | 'both'>('both')
  const [bsFiles, setBsFiles] = useState<File[]>([])
  const [bsUseAs, setBsUseAs] = useState<'credits' | 'debits' | 'both'>('both')
  const [bankAccountId, setBankAccountId] = useState<string>('')
  const [bankAccountName, setBankAccountName] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [uploadingCount, setUploadingCount] = useState(0)
  const [uploadTotal, setUploadTotal] = useState(0)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editClientId, setEditClientId] = useState('')
  const [editCurrency, setEditCurrency] = useState<'GHS' | 'USD' | 'EUR'>('GHS')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', slug],
    queryFn: () => projects.get(slug!),
    enabled: !!slug,
  })

  const uploadCbMutation = useMutation({
    mutationFn: async (data: { files: File[]; useAs: 'receipts' | 'payments' | 'both' }) => {
      setUploadError('')
      const types: ('receipts' | 'payments')[] = data.useAs === 'both' ? ['receipts', 'payments'] : [data.useAs]
      let n = 0
      const total = data.files.length * types.length
      setUploadTotal(total)
      for (const file of data.files) {
        for (const type of types) {
          n += 1
          setUploadingCount(n)
          await uploadCashBook(slug!, file, type)
        }
      }
      setUploadingCount(0)
      setUploadTotal(0)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', slug] })
      setCbFiles([])
    },
    onError: (err) => {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
      setUploadingCount(0)
      setUploadTotal(0)
    },
  })

  const { data: clientsList = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: clients.list,
  })
  const deleteMutation = useMutation({
    mutationFn: () => projects.delete(slug!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      navigate('/projects')
    },
  })
  const updateMutation = useMutation({
    mutationFn: (body: { name?: string; clientId?: string | null; currency?: 'GHS' | 'USD' | 'EUR' }) =>
      projects.update(slug!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', slug] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setEditing(false)
    },
  })

  const { data: bankAccountsList = [] } = useQuery({
    queryKey: ['bankAccounts', slug],
    queryFn: () => bankAccounts.list(slug!),
    enabled: !!slug,
  })
  const uploadBsMutation = useMutation({
    mutationFn: async (data: { files: File[]; useAs: 'credits' | 'debits' | 'both'; bankAccountId?: string; accountName?: string }) => {
      setUploadError('')
      const types: ('credits' | 'debits')[] = data.useAs === 'both' ? ['credits', 'debits'] : [data.useAs]
      const opts = { bankAccountId: data.bankAccountId || undefined, accountName: data.accountName || undefined }
      let n = 0
      const total = data.files.length * types.length
      setUploadTotal(total)
      for (const file of data.files) {
        for (const type of types) {
          n += 1
          setUploadingCount(n)
          await uploadBankStatement(slug!, file, type, opts)
        }
      }
      setUploadingCount(0)
      setUploadTotal(0)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', slug] })
      queryClient.invalidateQueries({ queryKey: ['bankAccounts', slug] })
      setBsFiles([])
    },
    onError: (err) => {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
      setUploadingCount(0)
      setUploadTotal(0)
    },
  })

  if (!slug || (isLoading && !project)) {
    return (
      <div className="flex items-center justify-center min-h-[200px] p-8">
        <p className="text-gray-600 font-medium">Loading project…</p>
      </div>
    )
  }
  if (!project) {
    return (
      <div className="flex items-center justify-center min-h-[200px] p-8">
        <p className="text-gray-900 font-medium">Project not found</p>
      </div>
    )
  }

  const documents = project.documents || []
  const cashBookDocs = documents.filter((d: { type: string }) => d.type.startsWith('cash_book_'))
  const bankDocs = documents.filter((d: { type: string }) => d.type.startsWith('bank_'))

  const inputClass =
    'w-full min-h-[44px] px-4 py-3 border border-gray-200 rounded-xl bg-gray-50/80 text-gray-900 text-sm placeholder:text-gray-400 shadow-sm hover:border-gray-300 hover:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:bg-white focus:outline-none transition-all duration-200'
  const selectClass =
    'w-full min-h-[44px] pl-4 pr-11 py-3 border border-gray-200 rounded-xl bg-gray-50/80 text-gray-900 text-sm shadow-sm hover:border-gray-300 hover:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:bg-white focus:outline-none appearance-none cursor-pointer transition-all duration-200'
  const isUploading = uploadCbMutation.isPending || uploadBsMutation.isPending

  function SelectWrapper({ children, compact }: { children: React.ReactNode; compact?: boolean }) {
    return (
      <div className="relative inline-block min-w-0">
        {children}
        <ChevronDown className={`absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none ${compact ? 'w-4 h-4' : 'w-5 h-5'}`} aria-hidden />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/projects')}
            className="text-sm font-medium text-gray-500 hover:text-gray-700 mb-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-lg transition-colors"
          >
            ← Back to projects
          </button>
          {editing && canEditProject(role) ? (
            <div className="flex flex-wrap items-center gap-3">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className={inputClass}
              />
              <select
                value={editClientId}
                onChange={(e) => setEditClientId(e.target.value)}
                className={selectClass}
              >
                <option value="">— None —</option>
                {(clientsList as { id: string; name: string }[]).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select
                value={editCurrency}
                onChange={(e) => setEditCurrency(e.target.value as 'GHS' | 'USD' | 'EUR')}
                className={selectClass}
              >
                <option value="GHS">GHS</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
              <button
                type="button"
                onClick={() => updateMutation.mutate({ name: editName, clientId: editClientId || null, currency: editCurrency })}
                disabled={updateMutation.isPending}
                className="px-5 py-2.5 bg-primary-600 text-white rounded-xl font-medium shadow-sm hover:bg-primary-700 hover:shadow disabled:opacity-50 transition-all"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => { setEditing(false); setEditName(project.name); setEditClientId(project.client?.id || ''); setEditCurrency((project.currency as 'GHS' | 'USD' | 'EUR') || 'GHS') }}
                className="px-5 py-2.5 border border-gray-200 rounded-xl font-medium text-gray-700 bg-white shadow-sm hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900">{project.name}</h1>
              {project.client && (
                <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-lg font-medium">
                  {project.client.name}
                </span>
              )}
              {canEditProject(role) && (
                <button
                  type="button"
                  onClick={() => { setEditing(true); setEditName(project.name); setEditClientId(project.client?.id || ''); setEditCurrency((project.currency as 'GHS' | 'USD' | 'EUR') || 'GHS') }}
                  className="text-sm font-medium text-primary-600 hover:text-primary-700"
                >
                  Edit
                </button>
              )}
            </div>
          )}
        </div>
        {canDeleteProject(role) && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 px-4 py-2.5 rounded-xl transition-colors"
            >
              Delete project
            </button>
          </div>
        )}
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full border border-gray-200 shadow-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete project?</h3>
            <p className="text-sm text-gray-600 mb-6">
              This will permanently delete &quot;{project.name}&quot; and all its data (documents, transactions, matches).
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-5 py-2.5 border border-gray-200 rounded-xl font-medium text-gray-700 bg-white shadow-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="px-5 py-2.5 bg-red-600 text-white rounded-xl font-medium shadow-sm hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(i)}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap text-xs font-medium transition-all ${
              step === i
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900'
            }`}
          >
            {i + 1}. {s}
          </button>
        ))}
      </div>
      {step === 0 && (
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 border-l-4 border-l-primary-500 bg-white shadow-sm p-4 sm:p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Upload documents</h2>
            <p className="text-xs text-gray-600 mb-4 max-w-2xl">
              Real bank statements and cash books usually have <strong>credits and debits (or receipts and payments) in the same document</strong>. Upload your file(s) once and choose &quot;Both&quot; so we use it for both sides. At the <strong>Map</strong> step you’ll map which columns are credits/debits (or receipts/payments); the system will then match and advise at Reconcile. You can upload several documents per project.
            </p>
            <p className="text-xs text-slate-600 mb-4 max-w-2xl rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
              <strong>Best practice:</strong> Cash book date is required for matching. Cheque amounts should match the bank statement for accurate reconciliation.
            </p>
            <p className="text-xs text-blue-700 mb-4 max-w-2xl rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
              <strong>Signed amount mode:</strong> when receipts/payments or credits/debits are mixed in one amount column, positive values are treated as receipts/credits and negative values as payments/debits.
            </p>
            {!canUploadDocuments(role) && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
                View-only. Contact an admin to upload.
              </p>
            )}
            {uploadError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-xs font-medium border border-red-100">
                {uploadError}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              {/* Cash book */}
              <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/50 p-4">
                <h3 className="text-sm font-semibold text-gray-800">Cash book</h3>
                {canUploadDocuments(role) ? (
                  <>
                    <div>
                      <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider block mb-1">Use as</label>
                      <SelectWrapper compact>
                        <select
                          value={cbUseAs}
                          onChange={(e) => setCbUseAs(e.target.value as 'receipts' | 'payments' | 'both')}
                          className="min-h-[36px] pl-3 pr-9 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm w-full focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 appearance-none cursor-pointer"
                        >
                          <option value="both">Both (receipts + payments) — one document</option>
                          <option value="receipts">Receipts only</option>
                          <option value="payments">Payments only</option>
                        </select>
                      </SelectWrapper>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="file"
                        multiple
                        accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg,.tiff"
                        onChange={(e) => setCbFiles(Array.from(e.target.files || []))}
                        className="text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-primary-50 file:text-primary-700 file:text-xs file:cursor-pointer"
                      />
                      <span className="text-xs text-gray-500">{cbFiles.length ? `${cbFiles.length} file(s)` : 'Choose files'}</span>
                      <button
                        onClick={() => uploadCbMutation.mutate({ files: cbFiles, useAs: cbUseAs })}
                        disabled={cbFiles.length === 0 || isUploading}
                        className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-700 disabled:opacity-50"
                      >
                        {uploadCbMutation.isPending ? (uploadTotal ? `${uploadingCount}/${uploadTotal}` : '…') : 'Upload'}
                      </button>
                    </div>
                    {cashBookDocs.length > 0 && (
                      <p className="text-xs text-gray-500 pt-2 border-t border-gray-200">✓ {cashBookDocs.length} document(s) uploaded</p>
                    )}
                  </>
                ) : (
                  cashBookDocs.length > 0 ? <p className="text-xs text-gray-500">✓ {cashBookDocs.length} document(s) uploaded</p> : <p className="text-xs text-gray-500">No cash book uploaded.</p>
                )}
              </div>

              {/* Bank statement */}
              <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50/50 p-4">
                <h3 className="text-sm font-semibold text-gray-800">Bank statement</h3>
                {canUploadDocuments(role) ? (
                  <>
                    {(bankAccountsList.length > 0 || bankAccountId === '') && (
                      <div className="flex flex-wrap items-center gap-2">
                        {bankAccountsList.length > 0 && (
                          <SelectWrapper compact>
                            <select
                              value={bankAccountId}
                              onChange={(e) => setBankAccountId(e.target.value)}
                              className="min-h-[36px] pl-3 pr-9 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm max-w-[180px] focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 appearance-none cursor-pointer"
                            >
                              <option value="">All accounts</option>
                              {bankAccountsList.map((a: { id: string; name: string }) => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                              ))}
                            </select>
                          </SelectWrapper>
                        )}
                        {bankAccountId === '' && (
                          <input
                            type="text"
                            placeholder="Account name (optional)"
                            value={bankAccountName}
                            onChange={(e) => setBankAccountName(e.target.value)}
                            className="min-h-[36px] max-w-[160px] px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-primary-500/20"
                          />
                        )}
                      </div>
                    )}
                    <div>
                      <label className="text-[11px] font-medium text-gray-500 uppercase tracking-wider block mb-1">Use as</label>
                      <SelectWrapper compact>
                        <select
                          value={bsUseAs}
                          onChange={(e) => setBsUseAs(e.target.value as 'credits' | 'debits' | 'both')}
                          className="min-h-[36px] pl-3 pr-9 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm w-full focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 appearance-none cursor-pointer"
                        >
                          <option value="both">Both (credits + debits) — one statement</option>
                          <option value="credits">Credits only</option>
                          <option value="debits">Debits only</option>
                        </select>
                      </SelectWrapper>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="file"
                        multiple
                        accept=".xlsx,.xls,.csv,.pdf,.png,.jpg,.jpeg,.tiff"
                        onChange={(e) => setBsFiles(Array.from(e.target.files || []))}
                        className="text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-primary-50 file:text-primary-700 file:text-xs file:cursor-pointer"
                      />
                      <span className="text-xs text-gray-500">{bsFiles.length ? `${bsFiles.length} file(s)` : 'Choose files'}</span>
                      <button
                        onClick={() => uploadBsMutation.mutate({ files: bsFiles, useAs: bsUseAs, bankAccountId: bankAccountId || undefined, accountName: bankAccountId ? undefined : bankAccountName || undefined })}
                        disabled={bsFiles.length === 0 || isUploading}
                        className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-medium hover:bg-primary-700 disabled:opacity-50"
                      >
                        {uploadBsMutation.isPending ? (uploadTotal ? `${uploadingCount}/${uploadTotal}` : '…') : 'Upload'}
                      </button>
                    </div>
                    {bankDocs.length > 0 && (
                      <p className="text-xs text-gray-500 pt-2 border-t border-gray-200">✓ {bankDocs.length} document(s) uploaded</p>
                    )}
                  </>
                ) : (
                  bankDocs.length > 0 ? <p className="text-xs text-gray-500">✓ {bankDocs.length} document(s) uploaded</p> : <p className="text-xs text-gray-500">No bank statement uploaded.</p>
                )}
              </div>
            </div>

            {(cashBookDocs.length + bankDocs.length) > 0 && (
              <details className="mt-5 pt-4 border-t border-gray-100">
                <summary className="text-[11px] font-medium text-gray-400 uppercase tracking-wider cursor-pointer">Uploaded files</summary>
                <ul className="mt-2 space-y-1.5 text-xs text-gray-600">
                  {cashBookDocs.map((d: { id: string; filename: string; type: string }) => (
                    <li key={d.id}>Cash book ({d.type.includes('receipts') ? 'receipts' : 'payments'}): {d.filename}</li>
                  ))}
                  {bankDocs.map((d: { id: string; filename: string; type: string }) => (
                    <li key={d.id}>Bank ({d.type.includes('credit') ? 'credits' : 'debits'}): {d.filename}</li>
                  ))}
                </ul>
              </details>
            )}

            <div className="mt-6 pt-5 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-600">
                {cashBookDocs.length + bankDocs.length > 0
                  ? 'Documents uploaded. Map columns next, then reconcile.'
                  : 'Upload at least one cash book and one bank statement to continue.'}
              </p>
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={cashBookDocs.length === 0 && bankDocs.length === 0}
                className="px-5 py-2.5 bg-primary-600 text-white rounded-xl font-medium shadow-sm hover:bg-primary-700 hover:shadow disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Proceed to Map →
              </button>
            </div>
          </div>
        </div>
      )}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-primary-500 shadow-sm p-6 sm:p-8">
          <ErrorFallback>
            <ProjectMap projectId={slug} canMap={canMapDocuments(role)} onProceedToReconcile={() => setStep(2)} />
          </ErrorFallback>
        </div>
      )}
      {step === 2 && (
        <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-primary-500 shadow-sm p-6 sm:p-8">
          <ErrorFallback>
            <ProjectReconcile projectId={slug} canReconcile={canReconcile(role)} onProceedToReview={() => setStep(3)} />
          </ErrorFallback>
        </div>
      )}
      {step === 3 && (
        <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-primary-500 shadow-sm p-6 sm:p-8">
          <ErrorFallback>
            <ProjectReview
              projectId={slug}
              onGoToReconcile={() => setStep(2)}
              onGoToReport={() => setStep(4)}
            />
          </ErrorFallback>
        </div>
      )}
      {step === 4 && (
        <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-primary-500 shadow-sm p-6 sm:p-8">
          <ErrorFallback>
            <ProjectReport
            projectId={slug}
            onGoToReview={() => setStep(3)}
            onReopen={() => setStep(2)}
            onRollForward={(newProjectId) => {
              navigate(`/projects/${newProjectId}`)
            }}
            canExport={canExportReport(role)}
            canReopen={canReopenProject(role)}
          />
          </ErrorFallback>
        </div>
      )}
    </div>
  )
}
