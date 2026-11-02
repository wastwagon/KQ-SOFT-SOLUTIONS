import { useCallback, useEffect, useState } from 'react'
import { useParams, useSearchParams, Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../store/auth'
import { subscription, unlessSubscriptionInactive } from '../lib/api'
import { publicPlanName } from '../lib/plans'
import {
  canEditBankRules,
  canManageBilling,
  canManageMembers,
} from '../lib/permissions'
import ApiKeysSection from '../components/settings/ApiKeysSection'
import BankRulesSection from '../components/settings/BankRulesSection'
import MembersSection from '../components/settings/MembersSection'
import SettingsBillingTab from '../components/settings/SettingsBillingTab'
import SettingsBrandingTab from '../components/settings/SettingsBrandingTab'
import SettingsConnectionsTab from '../components/settings/SettingsConnectionsTab'
import SettingsTabNav from '../components/settings/SettingsTabNav'
import { useBrandingSettings } from '../components/settings/useBrandingSettings'
import Card from '../components/ui/Card'
import Alert from '../components/ui/Alert'
import PageLoadError from '../components/ui/PageLoadError'
import { useToast } from '../components/ui/Toast'
import DevelopmentCredit from '../components/marketing/DevelopmentCredit'
import PageHeader from '../components/layout/PageHeader'
import { PageBodySkeleton } from '../components/ui/Skeleton'

/**
 * Organisation settings hub (branding, billing, members, API keys, bank rules).
 * Tab routing lives here; each tab is implemented under `components/settings/`.
 */
export default function Settings() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const role = useAuth((s) => s.role)
  const org = useAuth((s) => s.org)

  const usageQuery = useQuery({
    queryKey: ['subscription', 'usage'],
    queryFn: subscription.getUsage,
    refetchOnWindowFocus: true,
  })
  const { data: usageData, isError: usageQueryFailed } = usageQuery

  const plansQuery = useQuery({
    queryKey: ['subscription', 'plans'],
    queryFn: subscription.getPlans,
    refetchOnWindowFocus: true,
  })
  const { data: plansData, isError: plansQueryFailed } = plansQuery

  type PlansPayload = {
    plans?: { id: string; name: string }[]
    planOrder?: { slug: string; name: string }[]
  }
  const resolvePlanLabel = useCallback(
    (slug: string | null | undefined) => {
      if (!slug) return publicPlanName(slug)
      const payload = plansData as PlansPayload | undefined
      const cmsName =
        payload?.planOrder?.find((p) => p.slug === slug)?.name ??
        payload?.plans?.find((p) => p.id === slug)?.name
      if (slug === usageData?.organization?.plan && usageData.organization.planDisplayName) {
        return publicPlanName(slug, usageData.organization.planDisplayName)
      }
      return publicPlanName(slug, cmsName)
    },
    [plansData, usageData?.organization?.plan, usageData?.organization?.planDisplayName]
  )

  const subscriptionSidebarFailed = usageQueryFailed || plansQueryFailed

  const [initializing, setInitializing] = useState<string | null>(null)
  const [schedulingPlan, setSchedulingPlan] = useState<string | null>(null)
  const initPaymentMutation = useMutation({
    mutationFn: subscription.initializePayment,
    onSuccess: (data) => {
      if ('applied' in data && data.applied) {
        setInitializing(null)
        const label = resolvePlanLabel(data.plan)
        setCheckoutNotice({
          tone: 'success',
          title: 'Plan updated',
          body: `Your organisation is now on ${label}. Unused time from your last payment was applied.`,
        })
        toast.success('Plan updated', `You are now on ${label}.`)
        void queryClient.invalidateQueries({ queryKey: ['subscription'] })
        return
      }
      if (data?.reference) {
        try {
          sessionStorage.setItem('brs_paystack_ref', String(data.reference))
        } catch {
          /* private mode */
        }
      }
      if ('authorizationUrl' in data && data.authorizationUrl) window.location.href = data.authorizationUrl
    },
    onError: (err) => {
      unlessSubscriptionInactive(err, (e) =>
        toast.error('Payment could not be started', e instanceof Error ? e.message : undefined)
      )
      setInitializing(null)
    },
  })

  const features = (usageData?.features || {}) as Record<string, boolean>
  const featureDepth = usageData?.featureDepth || {}
  const branding = useBrandingSettings(features)

  const { tab } = useParams<{ tab: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const paystackReference = (
    searchParams.get('reference') ||
    searchParams.get('trxref') ||
    (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('brs_paystack_ref') : null) ||
    ''
  ).trim()
  const [checkoutNotice, setCheckoutNotice] = useState<{
    tone: 'success' | 'warning' | 'info' | 'error'
    title: string
    body?: string
  } | null>(null)
  const baseTabs = [
    'branding',
    'billing',
    'members',
    'connections',
    ...(features.api_access ? ['api-keys'] : []),
    ...(features.bank_rules ? ['bank-rules'] : []),
  ]
  const validTabs = baseTabs
  const activeTab = validTabs.includes(tab || '') ? tab : 'branding'

  const handleUpgrade = (plan: string, period: 'monthly' | 'quarterly' | 'yearly') => {
    setInitializing(`${plan}-${period}`)
    initPaymentMutation.mutate({ plan, period })
  }

  const scheduleDowngradeMutation = useMutation({
    mutationFn: (plan: string) => subscription.scheduleDowngrade({ plan }),
    onSuccess: (result) => {
      setSchedulingPlan(null)
      if (result.applied) {
        setCheckoutNotice({
          tone: 'success',
          title: 'Plan updated',
          body: `Your organisation is now on ${resolvePlanLabel(result.plan)}.`,
        })
        toast.success('Plan updated', `You are now on ${resolvePlanLabel(result.plan)}.`)
      } else {
        setCheckoutNotice({
          tone: 'info',
          title: 'Plan change scheduled',
          body: `You will move to ${resolvePlanLabel(result.scheduledPlan.plan)} on ${new Date(result.scheduledPlan.effectiveAt).toLocaleString()}.`,
        })
        toast.success('Plan change scheduled')
      }
      void queryClient.invalidateQueries({ queryKey: ['subscription'] })
    },
    onError: (err) => {
      setSchedulingPlan(null)
      unlessSubscriptionInactive(err, (e) =>
        toast.error('Could not schedule plan change', e instanceof Error ? e.message : undefined)
      )
    },
  })

  const cancelScheduleMutation = useMutation({
    mutationFn: () => subscription.cancelScheduledDowngrade(),
    onSuccess: () => {
      setCheckoutNotice({
        tone: 'info',
        title: 'Scheduled change cancelled',
        body: 'Your current plan stays in place until you choose another change.',
      })
      void queryClient.invalidateQueries({ queryKey: ['subscription'] })
    },
    onError: (err) =>
      unlessSubscriptionInactive(err, (e) =>
        toast.error('Could not cancel scheduled change', e instanceof Error ? e.message : undefined)
      ),
  })

  useEffect(() => {
    if (!paystackReference) return
    let cancelled = false
    setCheckoutNotice({
      tone: 'info',
      title: 'Confirming payment',
      body: 'Checking Paystack and updating your plan…',
    })
    void subscription
      .verifyPayment({ reference: paystackReference })
      .then((result) => {
        if (cancelled) return
        if (result.status === 'success') {
          const label = result.plan ? ` ${resolvePlanLabel(result.plan)}` : ''
          setCheckoutNotice({
            tone: 'success',
            title: result.alreadyApplied ? 'Subscription already active' : 'Payment confirmed',
            body: `Your organisation is now on the${label} plan.`,
          })
          toast.success(
            result.alreadyApplied ? 'Subscription already active' : 'Payment confirmed',
            `Your organisation is now on the${label} plan.`
          )
          void queryClient.invalidateQueries({ queryKey: ['subscription'] })
          try {
            sessionStorage.removeItem('brs_paystack_ref')
          } catch {
            /* ignore */
          }
        } else {
          setCheckoutNotice({
            tone: 'warning',
            title: 'Payment not confirmed yet',
            body: result.message || 'Paystack has not marked this charge as successful. Refresh billing in a moment.',
          })
        }
      })
      .catch((err) => {
        if (cancelled) return
        setCheckoutNotice({
          tone: 'error',
          title: 'Could not confirm payment',
          body: err instanceof Error ? err.message : 'We could not verify this checkout. Contact support with your Paystack reference.',
        })
        unlessSubscriptionInactive(err, (e) =>
          toast.error('Could not confirm payment', e instanceof Error ? e.message : undefined)
        )
      })
      .finally(() => {
        if (cancelled) return
        const next = new URLSearchParams(searchParams)
        next.delete('reference')
        next.delete('trxref')
        setSearchParams(next, { replace: true })
      })
    return () => {
      cancelled = true
    }
    // Intentionally only re-run when Paystack returns a new reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paystackReference])

  if (tab && !validTabs.includes(tab)) {
    return <Navigate to="/settings/branding" replace />
  }

  if (branding.isLoading) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Administration" title="Settings" />
        <PageBodySkeleton label="Loading settings" />
      </div>
    )
  }

  if (branding.brandingLoadFailed) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Administration" title="Settings" />
        <PageLoadError
          title="Could not load branding"
          onRetry={() => queryClient.invalidateQueries({ queryKey: ['settings', 'branding'] })}
        >
          {branding.brandingLoadError != null && branding.brandingLoadError instanceof Error
            ? branding.brandingLoadError.message
            : 'Something went wrong.'}
        </PageLoadError>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Administration"
        title="Settings"
        subtitle={
          <>
            {org?.name ? <p className="text-gray-700 font-medium">{org.name}</p> : null}
            <p className="text-gray-500">
              Branding, billing, team, bank import, API keys, and bank rules — everything that applies
              across projects.
            </p>
          </>
        }
      />
      {subscriptionSidebarFailed && (
        <Alert
          tone="warning"
          title="Plan or usage information could not be loaded"
          className="max-w-7xl"
          onRetry={() => {
            void queryClient.invalidateQueries({ queryKey: ['subscription', 'usage'] })
            void queryClient.invalidateQueries({ queryKey: ['subscription', 'plans'] })
          }}
        >
          Billing amounts and feature flags may be incomplete until this succeeds.
        </Alert>
      )}
      <SettingsTabNav showApiKeys={!!features.api_access} showBankRules={!!features.bank_rules} />
      <div className="w-full max-w-7xl">
        {activeTab === 'branding' && (
          <SettingsBrandingTab
            role={role}
            features={features}
            featureDepth={featureDepth}
            branding={branding}
          />
        )}

        {activeTab === 'billing' && (
          <SettingsBillingTab
            role={role}
            usageData={usageData}
            plansData={plansData}
            initializing={initializing}
            schedulingPlan={schedulingPlan}
            checkoutNotice={checkoutNotice}
            onUpgrade={handleUpgrade}
            onScheduleDowngrade={(plan) => {
              setSchedulingPlan(plan)
              scheduleDowngradeMutation.mutate(plan)
            }}
            onCancelScheduledDowngrade={() => cancelScheduleMutation.mutate()}
          />
        )}

        {activeTab === 'members' && (
          <Card
            title="Team Members"
            sublabel="Add team members by email. They must already have an account. Your plan limits how many members you can have."
          >
            {!canManageMembers(role) && (
              <Alert tone="info" title="View only" className="mb-4">
                Only admins can add or remove members.
              </Alert>
            )}
            <MembersSection canManage={canManageMembers(role)} />
          </Card>
        )}

        {activeTab === 'connections' && <SettingsConnectionsTab />}

        {activeTab === 'api-keys' && (
          <Card
            title="API keys"
            sublabel={
              <>
                Create API keys to access projects, report, and clients programmatically. Use{' '}
                <code className="px-1 py-0.5 bg-gray-100 rounded text-xs">
                  Authorization: Bearer &lt;key&gt;
                </code>{' '}
                or <code className="px-1 py-0.5 bg-gray-100 rounded text-xs">X-API-Key: &lt;key&gt;</code>.
                Rate limit: 100 req/min.
              </>
            }
          >
            {!features.api_access && (
              <Alert tone="warning" title="Upgrade required" className="mb-4">
                Your plan does not include REST API keys. Choose a plan with API access under Billing &amp; plans.
              </Alert>
            )}
            {!canManageBilling(role) && features.api_access && (
              <Alert tone="info" title="View only" className="mb-4">
                Only admins can manage API keys.
              </Alert>
            )}
            {canManageBilling(role) && features.api_access && <ApiKeysSection />}
          </Card>
        )}

        {activeTab === 'bank-rules' && (
          <Card
            title="Bank Rules"
            sublabel='Auto-suggest or flag bank transactions that match your rules (e.g. "Bank charges" when description contains "BANK CHARGES").'
          >
            {!features.bank_rules && (
              <Alert tone="warning" title="Upgrade required" className="mb-4">
                Bank rules are not on your current plan. Upgrade from Billing to enable auto-suggest and flag rules.
              </Alert>
            )}
            {features.bank_rules && featureDepth.bank_rules === 'partial' && (
              <Alert tone="info" title="Limited bank rules" className="mb-4">
                Your plan includes a capped number of rules. Higher plans remove the cap — see Billing for options.
              </Alert>
            )}
            {features.bank_rules && <BankRulesSection canEdit={canEditBankRules(role)} />}
          </Card>
        )}

        <Card
          title="About this platform"
          sublabel="Product information for your team. Branding on exports uses your organisation settings."
          className="mt-10"
        >
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-gray-500">Product</dt>
              <dd className="mt-1 font-medium text-gray-900">KQ-SOFT Bank Reconciliation</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-gray-500">Organisation</dt>
              <dd className="mt-1 font-medium text-gray-900">{org?.name ?? '—'}</dd>
            </div>
          </dl>
          <DevelopmentCredit tone="muted" align="start" className="mt-6 pt-6 border-t border-border-muted" />
        </Card>
      </div>
    </div>
  )
}
