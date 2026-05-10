import { useState } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useAuth } from '../store/auth'
import { subscription } from '../lib/api'
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
import SettingsTabNav from '../components/settings/SettingsTabNav'
import { useBrandingSettings } from '../components/settings/useBrandingSettings'
import Card from '../components/ui/Card'

/**
 * Organisation settings hub (branding, billing, members, API keys, bank rules).
 * Tab routing lives here; each tab is implemented under `components/settings/`.
 */
export default function Settings() {
  const role = useAuth((s) => s.role)

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

  const features = (usageData?.features || {}) as Record<string, boolean>
  const branding = useBrandingSettings(features)

  const { tab } = useParams<{ tab: string }>()
  const baseTabs = [
    'branding',
    'billing',
    'members',
    ...(features.api_access ? ['api-keys'] : []),
    ...(features.bank_rules ? ['bank-rules'] : []),
  ]
  const validTabs = baseTabs
  const activeTab = validTabs.includes(tab || '') ? tab : 'branding'

  if (tab && !validTabs.includes(tab)) {
    return <Navigate to="/settings/branding" replace />
  }

  if (branding.isLoading) {
    return <div className="text-gray-500 py-8">Loading settings...</div>
  }

  const handleUpgrade = (plan: string, period: 'monthly' | 'yearly') => {
    setInitializing(`${plan}-${period}`)
    initPaymentMutation.mutate({ plan, period })
  }

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">Settings</h1>
      <p className="text-sm text-gray-600 mb-6">
        Manage branding, billing, and bank rules for your organisation.
      </p>
      <SettingsTabNav showApiKeys={!!features.api_access} showBankRules={!!features.bank_rules} />
      <div className="max-w-2xl">
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
          <Card className="rounded-xl border-l-4 border-l-primary-500 border-gray-200 shadow-sm">
            <h2 className="text-lg font-semibold tracking-tight text-gray-900 mb-2">Team Members</h2>
            <p className="text-sm text-gray-600 mb-4">
              Add team members by email. They must already have an account. Your plan limits how many
              members you can have.
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
              Create API keys to access projects, report, and clients programmatically. Use{' '}
              <code className="px-1 py-0.5 bg-gray-100 rounded text-xs">
                Authorization: Bearer &lt;key&gt;
              </code>{' '}
              or <code className="px-1 py-0.5 bg-gray-100 rounded text-xs">X-API-Key: &lt;key&gt;</code>.
              Rate limit: 100 req/min.
            </p>
            {!features.api_access && (
              <p className="text-sm text-amber-600 mb-4">
                API keys require Firm plan. Upgrade to access programmatic API.
              </p>
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
              Auto-suggest or flag bank transactions that match your rules (e.g. &quot;Bank charges&quot;
              when description contains &quot;BANK CHARGES&quot;).
            </p>
            {!features.bank_rules && (
              <p className="text-sm text-amber-600 mb-4">
                Bank rules require Standard plan or higher. Upgrade to use auto-suggest and flag rules.
              </p>
            )}
            {features.bank_rules && <BankRulesSection canEdit={canEditBankRules(role)} />}
          </Card>
        )}
      </div>
    </div>
  )
}
