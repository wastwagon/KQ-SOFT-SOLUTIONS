import { useState, useEffect } from 'react'
import { useParams, NavLink, Navigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../store/auth'
import { settings, subscription, bankRules as bankRulesApi, apiKeys as apiKeysApi, getLogoDisplayUrl } from '../lib/api'
import { canEditBranding, canManageBilling, canEditBankRules, canManageMembers } from '../lib/permissions'
import { BRAND_PRIMARY_HEX, BRAND_SECONDARY_HEX } from '../lib/brandColors'
import Card from '../components/ui/Card'

export default function Settings() {
  const queryClient = useQueryClient()
  const role = useAuth((s) => s.role)
  const [logoUrl, setLogoUrl] = useState('')
  const [primaryColor, setPrimaryColor] = useState(BRAND_PRIMARY_HEX)
  const [secondaryColor, setSecondaryColor] = useState(BRAND_SECONDARY_HEX)
  const [letterheadAddress, setLetterheadAddress] = useState('')
  const [reportTitle, setReportTitle] = useState('Bank Reconciliation Statement')
  const [footer, setFooter] = useState('')
  const [approvalThresholdAmount, setApprovalThresholdAmount] = useState('')
  const [saved, setSaved] = useState(false)
  const [logoLoadError, setLogoLoadError] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'branding'],
    queryFn: settings.getBranding,
  })

  const { data: platformDefaults } = useQuery({
    queryKey: ['settings', 'platform-defaults'],
    queryFn: settings.getPlatformDefaults,
  })

  // Populate form when data loads
  const d = data as { logoUrl?: string; primaryColor?: string; secondaryColor?: string; letterheadAddress?: string; reportTitle?: string; footer?: string; approvalThresholdAmount?: number | null; organizationName?: string } | undefined
  useEffect(() => {
    if (d) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLogoUrl(d.logoUrl ?? '')
      setLogoLoadError(false)
      setPrimaryColor(d.primaryColor ?? BRAND_PRIMARY_HEX)
      setSecondaryColor(d.secondaryColor ?? BRAND_SECONDARY_HEX)
      setLetterheadAddress(d.letterheadAddress ?? '')
      setReportTitle(d.reportTitle ?? 'Bank Reconciliation Statement')
      setFooter(d.footer ?? '')
      setApprovalThresholdAmount(d.approvalThresholdAmount != null && d.approvalThresholdAmount > 0 ? String(d.approvalThresholdAmount) : '')
    }
  }, [d])

  const updateMutation = useMutation({
    mutationFn: (body: Parameters<typeof settings.updateBranding>[0]) =>
      settings.updateBranding(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'branding'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    },
  })

  const uploadLogoMutation = useMutation({
    mutationFn: (file: File) => settings.uploadLogo(file),
    onSuccess: (data) => {
      setLogoUrl(data.logoUrl)
      setLogoLoadError(false)
      queryClient.invalidateQueries({ queryKey: ['settings', 'branding'] })
    },
  })

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && (file.type === 'image/png' || file.type === 'image/jpeg')) {
      uploadLogoMutation.mutate(file)
      e.target.value = ''
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload: Parameters<typeof settings.updateBranding>[0] = {
      primaryColor: primaryColor || undefined,
      secondaryColor: secondaryColor || undefined,
      letterheadAddress: letterheadAddress.trim() || undefined,
      reportTitle: reportTitle.trim() || 'Bank Reconciliation Statement',
      footer: footer.trim() || undefined,
    }
    if (features.full_branding) payload.logoUrl = logoUrl.trim() || undefined
    if (features.threshold_approval) {
      const v = approvalThresholdAmount.trim()
      payload.approvalThresholdAmount = v === '' ? null : (parseFloat(v) > 0 ? parseFloat(v) : null)
    }
    updateMutation.mutate(payload)
  }

  const { data: usageData } = useQuery({
    queryKey: ['subscription', 'usage'],
    queryFn: subscription.getUsage,
  })
  const { data: plansData } = useQuery({
    queryKey: ['subscription', 'plans'],
    queryFn: subscription.getPlans,
  })
  const [initializing, setInitializing] = useState<string | null>(null)
  const initPaymentMutation = useMutation({
    mutationFn: subscription.initializePayment,
    onSuccess: (data) => {
      if (data?.authorizationUrl) window.location.href = data.authorizationUrl
    },
    onError: () => setInitializing(null),
  })

  const handleUpgrade = (plan: string, period: 'monthly' | 'yearly') => {
    setInitializing(`${plan}-${period}`)
    initPaymentMutation.mutate({ plan, period })
  }

  const features = (usageData?.features || {}) as Record<string, boolean>
  const { tab } = useParams<{ tab: string }>()
  const baseTabs = ['branding', 'billing', 'members', ...(features.api_access ? ['api-keys'] : []), ...(features.bank_rules ? ['bank-rules'] : [])]
  const validTabs = baseTabs
  const activeTab = validTabs.includes(tab || '') ? tab : 'branding'

  if (tab && !validTabs.includes(tab)) {
    return <Navigate to="/settings/branding" replace />
  }
  if (isLoading) return <div className="text-gray-500 py-8">Loading settings...</div>

  const tabClass = ({ isActive }: { isActive: boolean }) =>
    `px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 -mb-px transition-colors ${
      isActive
        ? 'text-primary-700 border-primary-600 bg-white'
        : 'text-gray-600 border-transparent hover:text-primary-600 hover:border-gray-300'
    }`

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">Settings</h1>
      <p className="text-sm text-gray-600 mb-6">Manage branding, billing, and bank rules for your organisation.</p>
      <nav className="flex gap-0.5 mb-6 border-b border-gray-200">
        <NavLink to="/settings/branding" end className={tabClass}>Branding</NavLink>
        <NavLink to="/settings/billing" className={tabClass}>Billing</NavLink>
        <NavLink to="/settings/members" className={tabClass}>Members</NavLink>
        {features.api_access && <NavLink to="/settings/api-keys" className={tabClass}>API keys</NavLink>}
        {features.bank_rules && <NavLink to="/settings/bank-rules" className={tabClass}>Bank rules</NavLink>}
      </nav>
      <div className="max-w-2xl">
        {activeTab === 'branding' && (
        <Card className="rounded-xl border-l-4 border-l-primary-500 border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight text-gray-900 mb-2">Report Branding</h2>
          <p className="text-sm text-gray-600 mb-6">
            Customise your Bank Reconciliation Statement reports with your logo, colours, and letterhead.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Logo</label>
              {!features.full_branding && (
                <p className="text-sm text-amber-600 mb-2">Logo on reports requires Premium plan or higher. Basic and Standard plans can customise colours and text.</p>
              )}
              {features.full_branding && (
              <>
              <div className="flex flex-wrap gap-4 items-start">
                {logoUrl && (
                  <div className="flex-shrink-0 min-w-[80px] min-h-[60px] max-w-[240px] max-h-[120px] rounded-xl border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center p-2">
                    {logoLoadError ? (
                      <p className="text-xs text-gray-500 text-center">Logo could not be loaded</p>
                    ) : (
                      <img
                        src={getLogoDisplayUrl(logoUrl)}
                        alt="Logo"
                        className="max-w-full max-h-full w-auto h-auto object-contain"
                        onError={() => setLogoLoadError(true)}
                      />
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-2">
                  <label className="inline-flex items-center justify-center px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 shadow-sm cursor-pointer transition-colors">
                    {uploadLogoMutation.isPending ? 'Uploading...' : 'Upload logo'}
                    <input type="file" accept="image/png,image/jpeg,image/jpg" className="sr-only" onChange={handleLogoUpload} disabled={uploadLogoMutation.isPending} />
                  </label>
                  <p className="text-xs text-gray-500">
                    Upload PNG or JPG (max 2MB). Or paste a URL below.
                  </p>
                </div>
              </div>
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
                className="mt-2 w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-900 placeholder-gray-500 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enter a public URL instead of uploading. Leave blank to hide logo.
              </p>
              {uploadLogoMutation.error && (
                <p className="mt-1 text-sm text-red-600">{(uploadLogoMutation.error as Error).message}</p>
              )}
              </>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Primary colour</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-10 w-14 rounded-lg cursor-pointer border border-gray-200 shadow-sm"
                  />
                  <input
                    type="text"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono bg-white text-gray-900 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Secondary colour</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="h-10 w-14 rounded-lg cursor-pointer border border-gray-200 shadow-sm"
                  />
                  <input
                    type="text"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono bg-white text-gray-900 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Letterhead / Address</label>
              <textarea
                value={letterheadAddress}
                onChange={(e) => setLetterheadAddress(e.target.value)}
                placeholder="123 High Street, Accra"
                rows={2}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-900 placeholder-gray-500 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Report title</label>
              <input
                type="text"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                placeholder="Bank Reconciliation Statement"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-900 placeholder-gray-500 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Footer</label>
              <input
                type="text"
                value={footer}
                onChange={(e) => setFooter(e.target.value)}
                placeholder="Prepared by KQ SOFT SOLUTIONS"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-900 placeholder-gray-500 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            {features.threshold_approval && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Approval threshold (GH₵)</label>
              <input
                type="number"
                min={0}
                step={100}
                value={approvalThresholdAmount}
                onChange={(e) => setApprovalThresholdAmount(e.target.value)}
                placeholder="Leave blank for no limit"
                className="w-full max-w-[200px] px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-900 placeholder-gray-500 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Projects with discrepancy above this amount require admin approval (reviewers cannot approve).
              </p>
            </div>
            )}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              {canEditBranding(role) && (
              <button
                type="submit"
                disabled={updateMutation.isPending}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {updateMutation.isPending ? 'Saving...' : 'Save branding'}
              </button>
              )}
              {canEditBranding(role) && platformDefaults && (
              <button
                type="button"
                onClick={() => {
                  setReportTitle(platformDefaults.reportTitle ?? 'Bank Reconciliation Statement')
                  setFooter(platformDefaults.footer ?? '')
                  setPrimaryColor(platformDefaults.primaryColor ?? BRAND_PRIMARY_HEX)
                  setSecondaryColor(platformDefaults.secondaryColor ?? BRAND_SECONDARY_HEX)
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 text-sm"
              >
                Reset to platform default
              </button>
              )}
              {saved && (
                <span className="text-sm text-green-600">Saved.</span>
              )}
            </div>
          </form>
          {d?.organizationName && (
            <p className="text-sm text-gray-500 mt-4">
              Company name in reports: <strong>{d.organizationName}</strong> (set when your organisation was created)
            </p>
          )}
        </Card>
        )}

        {activeTab === 'billing' && (
        <Card className="rounded-xl border-l-4 border-l-primary-500 border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight text-gray-900 mb-2">Billing</h2>
          {!canManageBilling(role) && (
            <p className="text-sm text-amber-600 mb-4">Only admins can manage billing.</p>
          )}
          <p className="text-sm text-gray-600 mb-4">
            Current plan: <strong className="capitalize text-gray-900">{usageData?.organization?.plan || 'basic'}</strong>
          </p>
          {usageData?.subscription && (
            <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              <p>
                Subscription status: <strong className="capitalize text-gray-900">{usageData.subscription.status}</strong>
              </p>
              {usageData.subscription.status === 'trial' && usageData.subscription.trialEndsAt && (
                <p>Trial ends: <strong>{new Date(usageData.subscription.trialEndsAt).toLocaleString()}</strong></p>
              )}
              {usageData.subscription.currentPeriodEnd && (
                <p>Current period ends: <strong>{new Date(usageData.subscription.currentPeriodEnd).toLocaleString()}</strong></p>
              )}
              {usageData.subscription.latestPaymentAmount != null && (
                <p>
                  Last payment: <strong>GH₵{usageData.subscription.latestPaymentAmount}</strong>
                  {usageData.subscription.latestPaymentPeriod ? ` (${usageData.subscription.latestPaymentPeriod})` : ''}
                </p>
              )}
            </div>
          )}
          {plansData?.introOffer?.eligible && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
              <strong>Intro offer:</strong> {plansData.introOffer.description}. Applies to your first payment.
            </div>
          )}
          {canManageBilling(role) && plansData?.paystackConfigured ? (
            <div className="grid gap-4 md:grid-cols-3">
              {(plansData.plans || []).map((p: { id: string; name: string; monthlyGhs: number; yearlyGhs: number }) => {
                const introEligible = plansData?.introOffer?.eligible
                const firstMonthGhs = introEligible ? Math.round(p.monthlyGhs * 0.5 * 100) / 100 : null
                const firstYearGhs = introEligible ? Math.round(p.yearlyGhs * 0.5 * 100) / 100 : null
                return (
                <div key={p.id} className="border border-gray-200 rounded-xl p-5 bg-white shadow-sm hover:shadow transition-shadow">
                  <h3 className="font-semibold tracking-tight text-gray-900">{p.name}</h3>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    GH₵{p.monthlyGhs}<span className="text-sm font-normal text-gray-500">/mo</span>
                    {firstMonthGhs != null && (
                      <span className="ml-2 text-base font-normal text-green-700">First payment: GH₵{firstMonthGhs}</span>
                    )}
                  </p>
                  <p className="text-sm text-gray-500">or GH₵{p.yearlyGhs}/yr (17% off){firstYearGhs != null && ` · First payment: GH₵${firstYearGhs}`}</p>
                  <button
                    type="button"
                    onClick={() => handleUpgrade(p.id, 'monthly')}
                    disabled={usageData?.organization?.plan === p.id || initializing === `${p.id}-monthly`}
                    className="mt-4 w-full px-4 py-2.5 font-medium bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 text-sm shadow-sm hover:shadow transition-all"
                  >
                    {initializing === `${p.id}-monthly` ? 'Redirecting...' : usageData?.organization?.plan === p.id ? 'Current plan' : 'Upgrade'}
                  </button>
                </div>
              )})}
            </div>
          ) : (
            <p className="text-sm text-gray-600">Billing is not configured. Contact support to upgrade your plan.</p>
          )}
        </Card>
        )}

        {activeTab === 'members' && (
        <Card className="rounded-xl border-l-4 border-l-primary-500 border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight text-gray-900 mb-2">Team Members</h2>
          <p className="text-sm text-gray-600 mb-4">
            Add team members by email. They must already have an account. Your plan limits how many members you can have.
          </p>
          {!canManageMembers(role) && (
            <p className="text-sm text-amber-600 mb-4">Only admins can add or remove members.</p>
          )}
          <MembersSection canManage={canManageMembers(role)} />
        </Card>
        )}

        {activeTab === 'api-keys' && (
        <Card className="rounded-xl border-l-4 border-l-primary-500 border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight text-gray-900 mb-2">API keys</h2>
          <p className="text-sm text-gray-600 mb-4">
            Create API keys to access projects, report, and clients programmatically. Use <code className="px-1 py-0.5 bg-gray-100 rounded text-xs">Authorization: Bearer &lt;key&gt;</code> or <code className="px-1 py-0.5 bg-gray-100 rounded text-xs">X-API-Key: &lt;key&gt;</code>. Rate limit: 100 req/min.
          </p>
          {!features.api_access && (
            <p className="text-sm text-amber-600 mb-4">API keys require Firm plan. Upgrade to access programmatic API.</p>
          )}
          {!canManageBilling(role) && features.api_access && (
            <p className="text-sm text-amber-600 mb-4">Only admins can manage API keys.</p>
          )}
          {canManageBilling(role) && features.api_access && <ApiKeysSection />}
        </Card>
        )}

        {activeTab === 'bank-rules' && (
        <Card className="rounded-xl border-l-4 border-l-primary-500 border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight text-gray-900 mb-2">Bank Rules</h2>
          <p className="text-sm text-gray-600 mb-4">
            Auto-suggest or flag bank transactions that match your rules (e.g. "Bank charges" when description contains "BANK CHARGES").
          </p>
          {!features.bank_rules && (
            <p className="text-sm text-amber-600 mb-4">Bank rules require Standard plan or higher. Upgrade to use auto-suggest and flag rules.</p>
          )}
          {features.bank_rules && <BankRulesSection canEdit={canEditBankRules(role)} />}
        </Card>
        )}
      </div>
    </div>
  )
}

function MembersSection({ canManage = false }: { canManage?: boolean }) {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<string>('member')
  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'members'],
    queryFn: settings.getMembers,
  })
  const addMutation = useMutation({
    mutationFn: (body: { email: string; role: string }) => settings.addMember(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'members'] })
      setEmail('')
      setRole('member')
    },
  })
  const removeMutation = useMutation({
    mutationFn: settings.removeMember,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings', 'members'] }),
  })
  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => settings.updateMemberRole(userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings', 'members'] }),
  })
  const members = data?.members ?? []
  const limit = data?.limit
  const currentCount = data?.currentCount ?? 0
  const atLimit = limit != null && currentCount >= limit

  if (isLoading) return <p className="text-sm text-gray-500">Loading members...</p>
  return (
    <div className="space-y-4">
      {canManage && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (email.trim() && !atLimit) addMutation.mutate({ email: email.trim(), role })
          }}
          className="flex flex-wrap gap-2"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (user must already be registered)"
            className="flex-1 min-w-0 sm:min-w-[200px] px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-900 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-900 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
            <option value="preparer">Preparer</option>
            <option value="reviewer">Reviewer</option>
          </select>
          <button
            type="submit"
            disabled={addMutation.isPending || !email.trim() || atLimit}
            className="px-4 py-2.5 font-medium bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 text-sm shadow-sm hover:shadow focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all"
          >
            {addMutation.isPending ? 'Adding...' : 'Add member'}
          </button>
        </form>
      )}
      {atLimit && canManage && (
        <p className="text-sm text-amber-600">
          You&apos;ve reached your plan limit ({limit} member{limit === 1 ? '' : 's'}). Upgrade to add more.
        </p>
      )}
      {addMutation.error && (
        <p className="text-sm text-red-600">{(addMutation.error as Error).message}</p>
      )}
      <p className="text-xs text-gray-500">
        {currentCount}{limit != null ? ` / ${limit}` : ''} members
      </p>
      <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-surface border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
              {canManage && <th className="px-4 py-3 w-20" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-muted bg-white">
            {members.length === 0 ? (
              <tr><td colSpan={canManage ? 4 : 3} className="px-4 py-6 text-gray-500 text-center">No members</td></tr>
            ) : (
              members.map((m: { id: string; userId: string; email: string; name: string | null; role: string }) => (
                <tr key={m.id} className="hover:bg-surface/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{m.name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{m.email}</td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <select
                        value={m.role}
                        onChange={(e) => updateRoleMutation.mutate({ userId: m.userId, role: e.target.value })}
                        disabled={updateRoleMutation.isPending}
                        className="px-2 py-1 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 shadow-sm focus:ring-2 focus:ring-primary-500 transition-shadow"
                      >
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                        <option value="preparer">Preparer</option>
                        <option value="reviewer">Reviewer</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <span className="capitalize">{m.role}</span>
                    )}
                  </td>
                  {canManage && (
                    <td className="px-4 py-3">
                      {members.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeMutation.mutate(m.userId)}
                          disabled={removeMutation.isPending}
                          className="text-red-600 hover:text-red-700 text-xs"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}

function ApiKeysSection() {
  const queryClient = useQueryClient()
  const [newName, setNewName] = useState('')
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const { data: keys = [], isLoading } = useQuery({
    queryKey: ['api-keys'],
    queryFn: apiKeysApi.list,
  })
  const createMutation = useMutation({
    mutationFn: (name: string) => apiKeysApi.create({ name }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      setNewName('')
      setCreatedKey(data.key)
      setTimeout(() => setCreatedKey(null), 15000)
    },
  })
  const deleteMutation = useMutation({
    mutationFn: apiKeysApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['api-keys'] }),
  })
  if (isLoading) return <p className="text-sm text-gray-500">Loading...</p>
  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => { e.preventDefault(); if (newName.trim()) createMutation.mutate(newName.trim()) }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Key name (e.g. Integration XYZ)"
          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-900 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
        <button
          type="submit"
          disabled={createMutation.isPending || !newName.trim()}
          className="px-4 py-2.5 font-medium bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 text-sm shadow-sm hover:shadow focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all"
        >
          {createMutation.isPending ? 'Creating...' : 'Create key'}
        </button>
      </form>
      {createdKey && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
          <p className="font-medium text-amber-800 mb-1">Save this key — it won&apos;t be shown again</p>
          <code className="block p-2 bg-white rounded break-all text-xs">{createdKey}</code>
        </div>
      )}
      <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-surface border-b border-border">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Prefix</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Last used</th>
              <th className="px-4 py-3 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border-muted bg-white">
            {keys.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-6 text-gray-500 text-center">No API keys</td></tr>
            ) : (
              keys.map((k: { id: string; name: string; keyPrefix: string; lastUsedAt: string | null }) => (
                <tr key={k.id} className="hover:bg-surface/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{k.name}</td>
                  <td className="px-4 py-3 font-mono text-gray-600">{k.keyPrefix}...</td>
                  <td className="px-4 py-3 text-gray-500">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(k.id)}
                      disabled={deleteMutation.isPending}
                      className="text-red-600 hover:text-red-700 text-xs"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}

type ConditionRow = { field: string; operator: string; value: string }
const defaultCondition = (): ConditionRow => ({ field: 'description', operator: 'contains', value: '' })

function BankRulesSection({ canEdit = true }: { canEdit?: boolean }) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [priority, setPriority] = useState(100)
  const [conditions, setConditions] = useState<ConditionRow[]>([defaultCondition()])
  const [action, setAction] = useState<'suggest_match' | 'flag_for_review'>('suggest_match')

  const { data, isLoading } = useQuery({
    queryKey: ['bank-rules'],
    queryFn: bankRulesApi.list,
  })
  const createMutation = useMutation({
    mutationFn: bankRulesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-rules'] })
      setShowForm(false)
      resetForm()
    },
  })
  const deleteMutation = useMutation({
    mutationFn: bankRulesApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['bank-rules'] }),
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof bankRulesApi.update>[1] }) =>
      bankRulesApi.update(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-rules'] })
      setEditId(null)
      resetForm()
    },
  })

  const resetForm = () => {
    setName('')
    setPriority(100)
    setConditions([defaultCondition()])
    setAction('suggest_match')
  }

  const rules = (data?.rules || []) as { id: string; name: string; priority: number; conditions: { field: string; operator: string; value: string | number }[]; action: string }[]

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const validConditions = conditions
      .filter((c) => c.value.trim() !== '')
      .map((c) => ({
        field: c.field,
        operator: c.operator,
        value: /^(0|-?[1-9]\d*)$/.test(c.value) ? Number(c.value) : c.value,
      }))
    if (validConditions.length === 0) return
    if (editId) {
      updateMutation.mutate({ id: editId, body: { name, priority, conditions: validConditions, action } })
    } else {
      createMutation.mutate({ name, priority, conditions: validConditions, action })
    }
  }

  if (isLoading) return <p className="text-sm text-gray-500">Loading rules...</p>

  return (
    <div className="space-y-4">
      {!canEdit && (
        <p className="text-sm text-amber-600">You have view-only access to bank rules. Contact an admin or reviewer to add or edit rules.</p>
      )}
      {rules.length === 0 && !showForm && (
        <div className="py-8 text-center rounded-xl border border-gray-200 bg-gray-50/50">
          <p className="text-base font-semibold tracking-tight text-gray-900">No rules yet</p>
          <p className="mt-1 text-sm text-gray-600">Add a rule to auto-suggest or flag matching bank transactions.</p>
        </div>
      )}
      {rules.length > 0 && (
        <ul className="space-y-2">
          {rules.map((r) => (
            <li key={r.id} className="group flex items-center justify-between p-4 border border-gray-200 rounded-xl shadow-sm bg-white hover:border-primary-200 transition-colors">
              <div>
                <p className="font-semibold text-gray-900">{r.name}</p>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${r.action === 'suggest_match' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                    {r.action.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[11px] text-gray-500 font-medium">
                    Priority {r.priority}
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-gray-600 leading-relaxed italic">
                  IF {r.conditions?.map((c: { field: string; operator: string; value: unknown }) => `${c.field} ${c.operator} "${c.value}"`).join(' AND ')}
                </p>
              </div>
              {canEdit && (
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditId(r.id)
                    setName(r.name)
                    setPriority(r.priority)
                    const conds = r.conditions?.length ? r.conditions.map((c: { field: string; operator: string; value: unknown }) => ({ field: c.field, operator: c.operator, value: String(c.value ?? '') })) : [defaultCondition()]
                    setConditions(conds)
                    setAction((r.action as 'suggest_match' | 'flag_for_review') || 'suggest_match')
                  }}
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(r.id)}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Delete
                </button>
              </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (showForm || editId) ? (
        <form onSubmit={handleSubmit} className="p-5 border border-gray-200 rounded-xl bg-gray-50/80 space-y-4 shadow-sm">
          <h3 className="text-base font-semibold tracking-tight text-gray-900">{editId ? 'Edit rule' : 'Add rule'}</h3>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Rule name (e.g. Bank fees)"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-900 placeholder-gray-500 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            required
          />
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs text-gray-500 font-medium">Conditions (all must match)</label>
              <button type="button" onClick={() => setConditions((c) => [...c, defaultCondition()])} className="text-xs text-primary-600 hover:text-primary-700">+ Add condition</button>
            </div>
            <div className="space-y-2">
              {conditions.map((cond, idx) => (
                <div key={idx} className="flex flex-wrap items-end gap-2 p-2 bg-white rounded border border-gray-200">
                  <select value={cond.field} onChange={(e) => setConditions((c) => c.map((x, i) => (i === idx ? { ...x, field: e.target.value } : x)))} className="px-2 py-1.5 border border-gray-300 rounded text-sm w-28 bg-white text-gray-900">
                    <option value="description">description</option>
                    <option value="details">details</option>
                    <option value="amount">amount</option>
                    <option value="name">name</option>
                  </select>
                  <select value={cond.operator} onChange={(e) => setConditions((c) => c.map((x, i) => (i === idx ? { ...x, operator: e.target.value } : x)))} className="px-2 py-1.5 border border-gray-300 rounded text-sm w-28 bg-white text-gray-900">
                    <option value="contains">contains</option>
                    <option value="equals">equals</option>
                    <option value="starts_with">starts_with</option>
                    <option value="gt">gt</option>
                    <option value="gte">gte</option>
                    <option value="lt">lt</option>
                    <option value="lte">lte</option>
                  </select>
                  <input value={cond.value} onChange={(e) => setConditions((c) => c.map((x, i) => (i === idx ? { ...x, value: e.target.value } : x)))} placeholder="e.g. BANK CHARGES" className="px-2 py-1.5 border border-gray-300 rounded text-sm flex-1 min-w-[100px] bg-white text-gray-900 placeholder-gray-500" />
                  <button type="button" onClick={() => setConditions((c) => c.length > 1 ? c.filter((_, i) => i !== idx) : c)} className="text-red-600 hover:text-red-700 text-sm px-1" title="Remove condition">×</button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Action</label>
            <select value={action} onChange={(e) => setAction(e.target.value as 'suggest_match' | 'flag_for_review')} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900">
              <option value="suggest_match">Suggest match (amount match)</option>
              <option value="flag_for_review">Flag for review</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Priority</label>
            <input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-24 bg-white text-gray-900" />
            <span className="text-xs text-gray-500 ml-2">(lower = higher priority)</span>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="px-4 py-2.5 font-medium bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 text-sm shadow-sm focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all">
              {editId ? 'Update' : 'Add'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); resetForm() }} className="px-4 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-100 text-gray-700 text-sm font-medium shadow-sm transition-colors">
              Cancel
            </button>
          </div>
        </form>
      ) : canEdit ? (
        <button type="button" onClick={() => setShowForm(true)} className="px-4 py-2.5 font-medium bg-primary-600 text-white rounded-xl hover:bg-primary-700 shadow-sm hover:shadow text-sm focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all">
          + Add rule
        </button>
      ) : null}
    </div>
  )
}
