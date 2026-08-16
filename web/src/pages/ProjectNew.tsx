import { useState, useMemo, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  projects,
  clients,
  subscription,
  settings,
  isSubscriptionInactiveError,
  unlessSubscriptionInactive,
} from '../lib/api'
import { normalizeClientsList } from '../lib/clientsPayload'
import { useToast } from '../components/ui/Toast'
import SubscriptionRenewalPanel from '../components/SubscriptionRenewalPanel'
import PageHeader from '../components/layout/PageHeader'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import { useAuth } from '../store/auth'
import { COMMON_PROJECT_CURRENCIES, getCurrencySymbol } from '../lib/currency'
import { composeProjectDisplayName } from '../lib/projectIdentity'

export default function ProjectNew() {
  const org = useAuth((s) => s.org)
  const [name, setName] = useState('')
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false)
  const [statementBusinessName, setStatementBusinessName] = useState('')
  const [currencyOverride, setCurrencyOverride] = useState<string | null>(null)
  const [currencySymbolOverride, setCurrencySymbolOverride] = useState('')
  const [customCurrencyCode, setCustomCurrencyCode] = useState('')
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
  const [primaryAccountName, setPrimaryAccountName] = useState('')
  const [primaryAccountNo, setPrimaryAccountNo] = useState('')
  const [error, setError] = useState('')

  const composedName = useMemo(
    () =>
      composeProjectDisplayName({
        statementBusinessName,
        bankAccountName: primaryAccountName || primaryBankName,
        accountNo: primaryAccountNo,
        reconciliationDate,
      }),
    [statementBusinessName, primaryAccountName, primaryBankName, primaryAccountNo, reconciliationDate]
  )

  // Auto-compose project name until the user edits it manually (safe: never overwrites custom names).
  useEffect(() => {
    if (!nameManuallyEdited && composedName) setName(composedName)
  }, [composedName, nameManuallyEdited])
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
  const { data: clientsRaw, isError: clientsQueryFailed } = clientsQuery
  const clientsList = useMemo(() => normalizeClientsList(clientsRaw), [clientsRaw])
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
    const finalName = name.trim() || composedName
    if (!finalName) {
      setError(
        'Enter a project name, or fill statement business name / bank account / closing date to compose one.'
      )
      return
    }
    mutation.mutate({
      name: finalName,
      statementBusinessName: statementBusinessName.trim() || undefined,
      clientId: clientId || undefined,
      reconciliationDate: reconciliationDate ? `${reconciliationDate}T00:00:00.000Z` : undefined,
      rollForwardFromProjectId: rollForwardFromProjectId || undefined,
      currency: currency.toUpperCase(),
      ...(currencySymbolOverride.trim() ? { currencySymbol: currencySymbolOverride.trim() } : {}),
      ...(primaryBankName.trim() || primaryAccountName.trim() || primaryAccountNo.trim()
        ? {
            primaryBankName: primaryBankName.trim() || undefined,
            primaryAccountName: primaryAccountName.trim() || undefined,
            primaryAccountNo: primaryAccountNo.trim() || undefined,
          }
        : {}),
    })
  }

  if (paywallBlocked) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Work"
          title="New reconciliation project"
          subtitle={
            <p className="text-gray-500">
              Spin up a workspace for one client or period. When your subscription is active you can upload statements and match straight away.
            </p>
          }
        />
        <SubscriptionRenewalPanel />
      </div>
    )
  }

  if (listLoadFailed) {
    const err = projectsQuery.error ?? clientsQuery.error
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Work"
          title="New reconciliation project"
          subtitle={<p className="text-gray-500">Create a project as soon as data loads. Copy settings from an older job or start clean.</p>}
        />
        <Alert
          tone="error"
          title="Could not load data for new project"
          onRetry={() => {
            void queryClient.invalidateQueries({ queryKey: ['projects'] })
            void queryClient.invalidateQueries({ queryKey: ['clients'] })
          }}
        >
          {err instanceof Error ? err.message : 'Something went wrong.'}
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Work"
        title="New reconciliation project"
        subtitle={
          <>
            {org?.name ? <p className="text-gray-700 font-medium">{org.name}</p> : null}
            <p className="text-gray-500">
              Capture the business name as on the bank statement, account details, and closing date for
              tracking. The printed BRS uses the statement business name when provided.
            </p>
          </>
        }
      />
      {platformDefaultsFailed && (
        <Alert
          tone="warning"
          title="Workspace defaults could not be loaded"
          onRetry={() => queryClient.invalidateQueries({ queryKey: ['settings', 'platform-defaults'] })}
          className="max-w-2xl"
        >
          New projects use GHS until this succeeds.
        </Alert>
      )}
      <Card className="max-w-2xl">
      <form
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        {error && (
          <Alert tone="error" title="Could not create project">
            {error}
          </Alert>
        )}
        <Select
          label="Copy settings from (optional)"
          hint="Copy client and currency from a previous project."
          value=""
          onChange={(e) => {
            const slug = e.target.value
            if (!slug) return
            const p = templateProjects.find((x) => x.slug === slug)
            if (p) {
              setClientId(p.clientId || '')
              setCurrencyOverride((p.currency as 'GHS' | 'USD' | 'EUR') || 'GHS')
              if (!name && p.name) {
                setNameManuallyEdited(true)
                setName(`${p.name} (copy)`)
              }
            }
            e.target.value = ''
          }}
        >
          <option value="">— None —</option>
          {templateProjects.map((p) => (
            <option key={p.id} value={p.slug}>{p.name} {p.client ? `(${p.client.name})` : ''}</option>
          ))}
        </Select>
        <Select
          label="Client (optional)"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        >
          <option value="">— None —</option>
          {clientsList.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <div className="rounded-xl border border-border bg-gray-50/40 p-5 space-y-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary-600">
              Tracking &amp; printed BRS identity
            </p>
            <p className="mt-1 text-sm text-gray-600 leading-relaxed">
              Recommended for firms preparing BRS for clients. The <strong>business name as on the
              bank statement</strong> becomes the company line on the printed BRS. Your firm logo and
              footer still come from organization branding.
            </p>
          </div>
          <Input
            id="statement-business-name"
            type="text"
            label="Business name as on bank statement"
            value={statementBusinessName}
            onChange={(e) => setStatementBusinessName(e.target.value)}
            placeholder="e.g. GHANA COCOA BOARD"
            autoComplete="organization"
            hint="Use the exact account-holder name shown on the statement."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              id="primary-account-name"
              type="text"
              label="Bank account name"
              value={primaryAccountName}
              onChange={(e) => setPrimaryAccountName(e.target.value)}
              placeholder="e.g. Current / Operating"
            />
            <Input
              id="primary-bank-name"
              type="text"
              label="Bank name"
              value={primaryBankName}
              onChange={(e) => setPrimaryBankName(e.target.value)}
              placeholder="e.g. Ecobank Ghana PLC"
              autoComplete="organization"
            />
            <Input
              id="primary-account-no"
              type="text"
              label="Bank account number"
              value={primaryAccountNo}
              onChange={(e) => setPrimaryAccountNo(e.target.value)}
              placeholder="e.g. 0150123456789"
              autoComplete="off"
            />
            <Input
              id="reconciliation-date"
              type="date"
              label="Closing date of BRS"
              value={reconciliationDate}
              onChange={(e) => setReconciliationDate(e.target.value)}
              hint="As-at date for the reconciliation report."
            />
          </div>
        </div>
        {features.roll_forward && (
          <Select
            label="Previous period BRS / Roll forward from (optional)"
            hint="Select a completed project to use as previous period BRS; unpresented cheques will be carried forward. Requires Premium plan."
            value={rollForwardFromProjectId}
            onChange={(e) => setRollForwardFromProjectId(e.target.value)}
          >
            <option value="">— None —</option>
            {completedProjects.map((p) => (
              <option key={p.id} value={p.slug}>{p.name}</option>
            ))}
          </Select>
        )}
        <div className="space-y-4">
          <Select
            label="Currency"
            value={COMMON_PROJECT_CURRENCIES.includes(currency as (typeof COMMON_PROJECT_CURRENCIES)[number]) ? currency : 'OTHER'}
            onChange={(e) => {
              const v = e.target.value
              if (v === 'OTHER') {
                setCurrencyOverride((customCurrencyCode || 'GHS').toUpperCase())
              } else {
                setCurrencyOverride(v)
                setCustomCurrencyCode('')
              }
            }}
          >
            {COMMON_PROJECT_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c} ({getCurrencySymbol(c)})
              </option>
            ))}
            <option value="OTHER">Other (enter code below)</option>
          </Select>
          {!COMMON_PROJECT_CURRENCIES.includes(currency as (typeof COMMON_PROJECT_CURRENCIES)[number]) && (
            <Input
              type="text"
              value={customCurrencyCode || currency}
              onChange={(e) => {
                const v = e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8)
                setCustomCurrencyCode(v)
                setCurrencyOverride(v || 'GHS')
              }}
              placeholder="e.g. NGN"
              className="max-w-xs"
              maxLength={8}
            />
          )}
          <Input
            type="text"
            label="Currency symbol (optional)"
            value={currencySymbolOverride}
            onChange={(e) => setCurrencySymbolOverride(e.target.value.slice(0, 8))}
            placeholder={`Default: ${getCurrencySymbol(currency)}`}
            className="max-w-xs"
            maxLength={8}
          />
          <p className="text-sm text-gray-500">
            Reporting currency for matching and exports. On the Report step you can preview totals in
            USD/EUR (display only). Subscription is billed in <strong>GHS</strong> via
            Paystack — see{' '}
            <Link to="/settings/billing" className="font-medium text-primary-600 hover:underline">
              Settings → Billing
            </Link>
            .
          </p>
        </div>
        <div>
          <Input
            type="text"
            label="Project name"
            value={name}
            onChange={(e) => {
              setNameManuallyEdited(true)
              setName(e.target.value)
            }}
            required={!composedName}
            placeholder="Auto-filled from the fields above — edit anytime"
          />
          <p className="mt-1.5 text-sm text-gray-500">
            Auto-composed for tracking as{' '}
            <em>Business — Account (number) — as at date</em>. Edit freely if you prefer a shorter
            name.
            {nameManuallyEdited && composedName ? (
              <>
                {' '}
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="text-primary-600"
                  onClick={() => {
                    setNameManuallyEdited(false)
                    setName(composedName)
                  }}
                >
                  Reset to auto name
                </Button>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button type="submit" isLoading={mutation.isPending}>
            Create
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancel
          </Button>
        </div>
      </form>
      </Card>
    </div>
  )
}
