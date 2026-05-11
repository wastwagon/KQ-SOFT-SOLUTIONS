import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown } from 'lucide-react'
import {
  projects,
  clients,
  subscription,
  settings,
  isSubscriptionInactiveError,
  unlessSubscriptionInactive,
} from '../lib/api'
import { useToast } from '../components/ui/Toast'
import SubscriptionRenewalPanel from '../components/SubscriptionRenewalPanel'

function SelectWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" aria-hidden />
    </div>
  )
}

export default function ProjectNew() {
  const [name, setName] = useState('')
  const [currencyOverride, setCurrencyOverride] = useState<'GHS' | 'USD' | 'EUR' | null>(null)
  const platformDefaultsQuery = useQuery({
    queryKey: ['settings', 'platform-defaults'],
    queryFn: settings.getPlatformDefaults,
  })
  const { data: platformDefaults, isError: platformDefaultsFailed } = platformDefaultsQuery
  const currency = currencyOverride ?? platformDefaults?.defaultCurrency ?? 'GHS'
  const [clientId, setClientId] = useState('')
  const [reconciliationDate, setReconciliationDate] = useState('')
  const [rollForwardFromProjectId, setRollForwardFromProjectId] = useState('')
  const [primaryBankName, setPrimaryBankName] = useState('')
  const [primaryAccountNo, setPrimaryAccountNo] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const usageQuery = useQuery({
    queryKey: ['subscription', 'usage'],
    queryFn: subscription.getUsage,
  })
  const { data: usageData } = usageQuery
  const features = (usageData?.features || {}) as Record<string, boolean>
  const clientsQuery = useQuery({
    queryKey: ['clients'],
    queryFn: clients.list,
  })
  const { data: clientsList = [], isError: clientsQueryFailed } = clientsQuery
  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: () => projects.list(),
  })
  const { data: projectsPayload, isError: projectsQueryFailed } = projectsQuery
  /** GET /projects returns `{ projects, total, … }`, not a bare array */
  const projectsList = projectsPayload?.projects ?? []
  const paywallBlocked =
    isSubscriptionInactiveError(clientsQuery.error) || isSubscriptionInactiveError(projectsQuery.error)
  const listLoadFailed = !paywallBlocked && (clientsQueryFailed || projectsQueryFailed)
  const completedProjects = useMemo(
    () => (projectsList as { id: string; name: string; slug: string; status: string; clientId?: string; currency?: string }[]).filter((p) => p.status === 'completed'),
    [projectsList]
  )
  const templateProjects = useMemo(
    () => (projectsList as { id: string; name: string; slug: string; status: string; clientId?: string; client?: { name: string }; currency?: string }[]).slice(0, 20),
    [projectsList]
  )
  const mutation = useMutation({
    mutationFn: projects.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['subscription', 'usage'] })
      toast.success('Project created', `"${name.trim() || data.slug}" is ready — upload your statements to start matching.`)
      navigate(`/projects/${data.slug}`)
    },
    onError: (err) =>
      unlessSubscriptionInactive(err, (e) => {
        const msg = e instanceof Error ? e.message : 'Failed'
        setError(msg)
        toast.error('Could not create project', msg)
      }),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    mutation.mutate({
      name,
      clientId: clientId || undefined,
      reconciliationDate: reconciliationDate ? `${reconciliationDate}T00:00:00.000Z` : undefined,
      rollForwardFromProjectId: rollForwardFromProjectId || undefined,
      currency,
      ...(primaryBankName.trim() || primaryAccountNo.trim()
        ? {
            primaryBankName: primaryBankName.trim() || undefined,
            primaryAccountNo: primaryAccountNo.trim() || undefined,
          }
        : {}),
    })
  }

  const inputClass =
    'w-full min-h-[44px] pl-4 pr-4 py-3 border border-gray-200 rounded-xl bg-gray-50/80 text-gray-900 text-sm placeholder:text-gray-400 shadow-sm hover:border-gray-300 hover:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:bg-white focus:outline-none transition-all duration-200'
  const selectClass =
    'w-full min-h-[44px] pl-4 pr-11 py-3 border border-gray-200 rounded-xl bg-gray-50/80 text-gray-900 text-sm shadow-sm hover:border-gray-300 hover:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:bg-white focus:outline-none transition-all duration-200 appearance-none cursor-pointer'
  const labelClass = 'block text-sm font-semibold text-gray-700 mb-1.5'
  const hintClass = 'text-sm text-gray-600 mt-1.5'

  if (paywallBlocked) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">New reconciliation project</h1>
          <p className="mt-2 text-sm text-gray-600 max-w-xl leading-relaxed">
            Spin up a workspace for one client or period. When your subscription is active you can upload statements and match straight away.
          </p>
        </div>
        <SubscriptionRenewalPanel />
      </div>
    )
  }

  if (listLoadFailed) {
    const err = projectsQuery.error ?? clientsQuery.error
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">New reconciliation project</h1>
          <p className="mt-2 text-sm text-gray-600 max-w-xl leading-relaxed">
            Create a project as soon as data loads. Copy settings from an older job or start clean.
          </p>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 max-w-xl">
          <p className="font-medium text-red-900">Could not load data for new project</p>
          <p className="mt-1">{err instanceof Error ? err.message : 'Something went wrong.'}</p>
          <button
            type="button"
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: ['projects'] })
              void queryClient.invalidateQueries({ queryKey: ['clients'] })
            }}
            className="mt-3 px-3 py-1.5 text-sm font-medium rounded-lg bg-white border border-red-300 text-red-900 hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">New reconciliation project</h1>
        <p className="mt-2 text-base text-gray-600 max-w-xl leading-relaxed">
          Give this engagement a clear name, link an optional client, and—if you like—save your bank label and account number now.
          They appear on the signed-off Bank Reconciliation Statement next to your firm letterhead, so reviewers see which account the rec covers at a glance.
        </p>
      </div>
      {platformDefaultsFailed && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950 max-w-2xl">
          <span>Workspace defaults could not be loaded; new projects use GHS until this succeeds. </span>
          <button
            type="button"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['settings', 'platform-defaults'] })}
            className="font-semibold text-amber-900 underline hover:no-underline"
          >
            Retry
          </button>
        </div>
      )}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-primary-500 shadow-sm p-6 sm:p-8 max-w-2xl space-y-5"
      >
        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm font-medium border border-red-100">
            {error}
          </div>
        )}
        {/* Phase 11: Copy from previous — templates for multi-project-per-client UX */}
        <div>
          <label className={labelClass}>Copy settings from (optional)</label>
          <SelectWrapper>
            <select
              value=""
              onChange={(e) => {
                const slug = e.target.value
                if (!slug) return
                const p = templateProjects.find((x) => x.slug === slug)
                if (p) {
                  setClientId(p.clientId || '')
                  setCurrencyOverride((p.currency as 'GHS' | 'USD' | 'EUR') || 'GHS')
                  if (!name && p.name) setName(`${p.name} (copy)`)
                }
                e.target.value = ''
              }}
              className={selectClass}
            >
              <option value="">— None —</option>
              {templateProjects.map((p) => (
                <option key={p.id} value={p.slug}>{p.name} {p.client ? `(${p.client.name})` : ''}</option>
              ))}
            </select>
          </SelectWrapper>
          <p className={hintClass}>Copy client and currency from a previous project.</p>
        </div>
        <div>
          <label className={labelClass}>Client (optional)</label>
          <SelectWrapper>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className={selectClass}
            >
              <option value="">— None —</option>
              {(clientsList as { id: string; name: string }[]).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </SelectWrapper>
        </div>
        <div className="rounded-xl border border-gray-100 bg-gradient-to-br from-slate-50/90 to-white p-5 space-y-4 ring-1 ring-gray-100">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary-600">Bank details for reports</p>
            <p className="mt-1 text-sm text-gray-600 leading-relaxed">
              Optional. Shown on your final BRS letterhead (with your logo and address) as the account line—same wording many firms put under the title on the worksheet.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="primary-bank-name" className={labelClass}>
                Bank name
              </label>
              <input
                id="primary-bank-name"
                type="text"
                value={primaryBankName}
                onChange={(e) => setPrimaryBankName(e.target.value)}
                placeholder="e.g. Ecobank Ghana PLC"
                autoComplete="organization"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="primary-account-no" className={labelClass}>
                Account number
              </label>
              <input
                id="primary-account-no"
                type="text"
                value={primaryAccountNo}
                onChange={(e) => setPrimaryAccountNo(e.target.value)}
                placeholder="e.g. 0150123456789"
                autoComplete="off"
                className={inputClass}
              />
            </div>
          </div>
        </div>
        <div>
          <label className={labelClass}>Reconciliation date (optional)</label>
          <input
            type="date"
            value={reconciliationDate}
            onChange={(e) => setReconciliationDate(e.target.value)}
            className={inputClass}
          />
          <p className={hintClass}>Date as at which the reconciliation is prepared.</p>
        </div>
        {features.roll_forward && (
          <div>
            <label className={labelClass}>Previous period BRS / Roll forward from (optional)</label>
            <SelectWrapper>
              <select
                value={rollForwardFromProjectId}
                onChange={(e) => setRollForwardFromProjectId(e.target.value)}
                className={selectClass}
              >
                <option value="">— None —</option>
                {completedProjects.map((p) => (
                  <option key={p.id} value={p.slug}>{p.name}</option>
                ))}
              </select>
            </SelectWrapper>
            <p className={hintClass}>Select a completed project to use as previous period BRS; unpresented cheques will be carried forward. Requires Premium plan.</p>
          </div>
        )}
        <div>
          <label className={labelClass}>Currency</label>
          <SelectWrapper>
            <select
              value={currency}
              onChange={(e) => setCurrencyOverride(e.target.value as 'GHS' | 'USD' | 'EUR')}
              className={selectClass}
            >
              <option value="GHS">GHS (GH₵)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
            </select>
          </SelectWrapper>
          <p className={hintClass}>
            This is the <strong>reporting currency</strong> for this project&apos;s BRS and exports. Your workspace
            plan is billed in <strong>GHS</strong> via Paystack — see{' '}
            <Link to="/settings/billing" className="font-medium text-primary-600 hover:underline">
              Settings → Billing
            </Link>
            .
          </p>
        </div>
        <div>
          <label className={labelClass}>Project name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Lordship Insurance BRS Dec 2025"
            className={inputClass}
          />
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="px-5 py-2.5 bg-primary-600 text-white rounded-xl font-medium shadow-sm hover:bg-primary-700 hover:shadow disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 transition-all"
          >
            {mutation.isPending ? 'Creating...' : 'Create'}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-5 py-2.5 border border-gray-200 rounded-xl font-medium text-gray-700 bg-white shadow-sm hover:bg-gray-50 hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 transition-all"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
