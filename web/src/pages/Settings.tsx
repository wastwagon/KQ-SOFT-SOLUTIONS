import { useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../store/auth'
import { subscription, unlessSubscriptionInactive } from '../lib/api'
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
import { useToast } from '../components/ui/Toast'
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

  const subscriptionSidebarFailed = usageQueryFailed || plansQueryFailed

  const [initializing, setInitializing] = useState<string | null>(null)
  const initPaymentMutation = useMutation({
    mutationFn: subscription.initializePayment,
    onSuccess: (data) => {
      if (data?.authorizationUrl) window.location.href = data.authorizationUrl
    },
    onError: (err) => {
      unlessSubscriptionInactive(err, (e) =>
        toast.error('Payment could not be started', e instanceof Error ? e.message : undefined)
      )
      setInitializing(null)
    },
  })

  const features = (usageData?.features || {}) as Record<string, boolean>
  const branding = useBrandingSettings(features)

  const { tab } = useParams<{ tab: string }>()
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
        <Alert
          tone="error"
          title="Could not load branding"
          onRetry={() => queryClient.invalidateQueries({ queryKey: ['settings', 'branding'] })}
        >
          {branding.brandingLoadError != null && branding.brandingLoadError instanceof Error
            ? branding.brandingLoadError.message
            : 'Something went wrong.'}
        </Alert>
      </div>
    )
  }

  const handleUpgrade = (plan: string, period: 'monthly' | 'quarterly' | 'yearly') => {
    setInitializing(`${plan}-${period}`)
    initPaymentMutation.mutate({ plan, period })
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
              Branding, billing, team, connections, API keys, and bank rules — everything that applies
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
          <SettingsBrandingTab role={role} features={features} branding={branding} />
        )}

        {activeTab === 'billing' && (
          <SettingsBillingTab
            role={role}
            usageData={usageData}
            plansData={plansData}
            initializing={initializing}
            onUpgrade={handleUpgrade}
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
              <Alert tone="warning" title="Firm plan required" className="mb-4">
                Upgrade to create API keys for programmatic access.
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
              <Alert tone="warning" title="Standard plan or higher required" className="mb-4">
                Upgrade to use auto-suggest and flag rules.
              </Alert>
            )}
            {features.bank_rules && <BankRulesSection canEdit={canEditBankRules(role)} />}
          </Card>
        )}
      </div>
    </div>
  )
}
