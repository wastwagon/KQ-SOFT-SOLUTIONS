import { useState } from 'react'
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  FileCheck,
  Settings,
  ShieldCheck,
  LogOut,
  FileText,
  BookOpen,
  CreditCard,
  Key,
  Landmark,
  Plus,
  Radio,
  FileSpreadsheet,
} from 'lucide-react'
import { useAuth } from '../store/auth'
import { settings, getLogoDisplayUrl, subscription } from '../lib/api'
import { canCreateProject, canEditBankRules, canManageBilling, canManageMembers } from '../lib/permissions'
import BrandLogo from './BrandLogo'
import OrgSwitcher from './OrgSwitcher'
import NotificationsBell from './NotificationsBell'
import SidebarShell, { SidebarHeader, SidebarNavSection } from './layout/SidebarShell'
import { sidebarNavLinkClass } from './layout/sidebarStyles'

const preloadProjectsPage = () => import('../pages/Projects')
const preloadSettingsPage = () => import('../pages/Settings')

export default function AppLayout() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, role, logout, isPlatformAdmin } = useAuth()
  const roleLabel =
    role === 'admin'
      ? 'Admin'
      : role === 'reviewer'
        ? 'Reviewer'
        : role === 'preparer'
          ? 'Preparer'
          : role === 'viewer'
            ? 'Viewer'
            : null
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null)
  const [subscriptionBannerDismissed, setSubscriptionBannerDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('brs_subscription_banner_dismissed') === '1'
    } catch {
      return false
    }
  })

  const { data: branding, isError: layoutBrandingQueryFailed } = useQuery({
    queryKey: ['settings', 'branding'],
    queryFn: settings.getBranding,
    refetchOnWindowFocus: true,
  })
  const { data: usageForBanner, isError: layoutUsageQueryFailed } = useQuery({
    queryKey: ['subscription', 'usage'],
    queryFn: subscription.getUsage,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  })

  const logoUrl = (branding as { logoUrl?: string } | undefined)?.logoUrl
  const showOrgLogo = !!logoUrl?.trim() && failedLogoUrl !== logoUrl
  const path = location.pathname
  const features = (usageForBanner?.features || {}) as Record<string, boolean>
  const subscriptionBypass = isPlatformAdmin || !!usageForBanner?.subscriptionBypass
  const sub = usageForBanner?.subscription?.status
  const showSubscriptionStrip =
    !subscriptionBypass &&
    !subscriptionBannerDismissed &&
    !path.startsWith('/settings') &&
    !!usageForBanner?.paywallEnabled &&
    (sub === 'free' || sub === 'expired')
  const hideLayoutUsageFailureBanner = path.startsWith('/settings')
  const hideLayoutBrandingFailureBanner = path.startsWith('/settings')

  const workActive =
    path === '/projects' ||
    path.startsWith('/projects/') ||
    path === '/clients' ||
    path.startsWith('/clients/') ||
    path === '/reports' ||
    path.startsWith('/reports/')
  const toolsActive = path === '/tools' || path.startsWith('/tools/')
  const settingsActive = path === '/settings' || path.startsWith('/settings/')
  const complianceActive =
    path === '/audit' || path.startsWith('/audit/') || path === '/manual' || path.startsWith('/manual/')
  const platformActive = path === '/platform-admin' || path.startsWith('/platform-admin/')

  const dismissSubscriptionStrip = () => {
    try {
      sessionStorage.setItem('brs_subscription_banner_dismissed', '1')
    } catch {
      /* ignore */
    }
    setSubscriptionBannerDismissed(true)
  }

  const closeSidebar = () => setSidebarOpen(false)

  function handleLogout() {
    closeSidebar()
    logout()
    navigate('/login')
  }

  const showMembers = canManageMembers(role)
  const showBilling = canManageBilling(role)
  const showBankRules = !!features.bank_rules && canEditBankRules(role)
  const showApiKeys = !!features.api_access
  const showNewProject = canCreateProject(role)

  const sidebar = (
    <>
      <SidebarHeader onClose={closeSidebar}>
        <NavLink
          to="/dashboard"
          onClick={closeSidebar}
          className="flex items-center gap-2.5 min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded-lg"
        >
          <BrandLogo variant="icon" className="h-9 w-9 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900 truncate">Workspace</p>
            {showOrgLogo ? (
              <img
                src={getLogoDisplayUrl(logoUrl!)}
                alt="Organisation logo"
                className="mt-0.5 max-h-5 w-auto max-w-[140px] object-contain object-left"
                onError={() => setFailedLogoUrl(logoUrl ?? '')}
              />
            ) : (
              <BrandLogo className="mt-0.5 h-5 w-auto max-w-[140px] object-left object-contain" />
            )}
          </div>
        </NavLink>
      </SidebarHeader>

      <nav className="flex-1 overflow-y-auto py-2 px-3" aria-label="Workspace">
        <SidebarNavSection label="General" active={path === '/dashboard' || path.startsWith('/dashboard/')}>
          <NavLink to="/dashboard" end onClick={closeSidebar} className={sidebarNavLinkClass}>
            <LayoutDashboard className="w-5 h-5 flex-shrink-0 opacity-80" />
            Dashboard
          </NavLink>
        </SidebarNavSection>

        <SidebarNavSection label="Work" active={workActive}>
          <NavLink
            to="/projects"
            onClick={closeSidebar}
            onMouseEnter={preloadProjectsPage}
            onFocus={preloadProjectsPage}
            className={sidebarNavLinkClass}
          >
            <FolderKanban className="w-5 h-5 flex-shrink-0 opacity-80" />
            Projects
          </NavLink>
          {showNewProject && (
            <NavLink to="/projects/new" onClick={closeSidebar} className={sidebarNavLinkClass}>
              <Plus className="w-5 h-5 flex-shrink-0 opacity-80" />
              New project
            </NavLink>
          )}
          <NavLink to="/clients" onClick={closeSidebar} className={sidebarNavLinkClass}>
            <Users className="w-5 h-5 flex-shrink-0 opacity-80" />
            Clients
          </NavLink>
          <NavLink to="/reports" onClick={closeSidebar} className={sidebarNavLinkClass}>
            <FileText className="w-5 h-5 flex-shrink-0 opacity-80" />
            Reports
          </NavLink>
        </SidebarNavSection>

        <SidebarNavSection label="Tools" active={toolsActive}>
          <NavLink to="/tools/clean-bank-statement" onClick={closeSidebar} className={sidebarNavLinkClass}>
            <Landmark className="w-5 h-5 flex-shrink-0 opacity-80" />
            Clean bank statement
          </NavLink>
          <NavLink to="/tools/clean-cash-book" onClick={closeSidebar} className={sidebarNavLinkClass}>
            <FileSpreadsheet className="w-5 h-5 flex-shrink-0 opacity-80" />
            Clean cash book
          </NavLink>
        </SidebarNavSection>

        <SidebarNavSection label="Settings" active={settingsActive}>
          <NavLink
            to="/settings/branding"
            onClick={closeSidebar}
            onMouseEnter={preloadSettingsPage}
            onFocus={preloadSettingsPage}
            className={sidebarNavLinkClass}
          >
            <Settings className="w-5 h-5 flex-shrink-0 opacity-80" />
            Firm branding
          </NavLink>
          {showBilling && (
            <NavLink to="/settings/billing" onClick={closeSidebar} className={sidebarNavLinkClass}>
              <CreditCard className="w-5 h-5 flex-shrink-0 opacity-80" />
              Billing &amp; plans
            </NavLink>
          )}
          {showMembers && (
            <NavLink to="/settings/members" onClick={closeSidebar} className={sidebarNavLinkClass}>
              <Users className="w-5 h-5 flex-shrink-0 opacity-80" />
              Team members
            </NavLink>
          )}
          {showApiKeys && (
            <NavLink to="/settings/api-keys" onClick={closeSidebar} className={sidebarNavLinkClass}>
              <Key className="w-5 h-5 flex-shrink-0 opacity-80" />
              API keys
            </NavLink>
          )}
          {showBankRules && (
            <NavLink to="/settings/bank-rules" onClick={closeSidebar} className={sidebarNavLinkClass}>
              <Landmark className="w-5 h-5 flex-shrink-0 opacity-80" />
              Bank rules
            </NavLink>
          )}
          <NavLink to="/settings/connections" onClick={closeSidebar} className={sidebarNavLinkClass}>
            <Radio className="w-5 h-5 flex-shrink-0 opacity-80" />
            Connections
          </NavLink>
        </SidebarNavSection>

        <SidebarNavSection label="Compliance" active={complianceActive}>
          <NavLink to="/audit" onClick={closeSidebar} className={sidebarNavLinkClass}>
            <FileCheck className="w-5 h-5 flex-shrink-0 opacity-80" />
            Audit log
          </NavLink>
          <NavLink to="/manual" onClick={closeSidebar} className={sidebarNavLinkClass}>
            <BookOpen className="w-5 h-5 flex-shrink-0 opacity-80" />
            User manual
          </NavLink>
        </SidebarNavSection>

        {isPlatformAdmin && (
          <SidebarNavSection label="Platform" active={platformActive}>
            <NavLink
              to="/platform-admin"
              onClick={closeSidebar}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive || platformActive
                    ? 'bg-amber-50 text-amber-900'
                    : 'text-amber-800 hover:bg-amber-50'
                }`
              }
            >
              <ShieldCheck className="w-5 h-5 flex-shrink-0" />
              Platform admin
            </NavLink>
          </SidebarNavSection>
        )}
      </nav>

      <div className="shrink-0 border-t border-border-muted p-3 space-y-2">
        <OrgSwitcher variant="sidebar" />
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
          <div
            className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-sm shrink-0"
            title={user?.email ?? ''}
          >
            {user?.name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.name || 'User'}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
          {roleLabel && (
            <span
              className={`px-1.5 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider shrink-0 ${
                role === 'admin'
                  ? 'bg-primary-600 text-white'
                  : role === 'reviewer'
                    ? 'bg-green-600 text-white'
                    : role === 'preparer'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-400 text-white'
              }`}
            >
              {roleLabel}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </>
  )

  const banners = (
    <>
      {showSubscriptionStrip && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-950 px-4 py-2.5 sm:px-6 flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="min-w-0">
            <span className="font-semibold">Subscription inactive.</span>{' '}
            Core features are paused until an admin renews —{' '}
            <Link to="/settings/billing" className="font-medium underline hover:no-underline">
              open billing
            </Link>
            .
          </p>
          <button
            type="button"
            onClick={dismissSubscriptionStrip}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 border border-amber-300/80"
            aria-label="Dismiss subscription notice"
          >
            Dismiss
          </button>
        </div>
      )}

      {subscriptionBypass &&
        !!usageForBanner?.paywallEnabled &&
        (sub === 'free' || sub === 'expired') &&
        !path.startsWith('/settings') && (
          <div className="bg-slate-50 border-b border-slate-200 text-slate-700 px-4 py-2 sm:px-6 text-sm">
            <span className="font-medium">Platform admin bypass.</span> This workspace’s subscription is{' '}
            {sub}; core APIs remain available for your account. Tenant users still need an active plan.
          </div>
        )}

      {layoutUsageQueryFailed && !showSubscriptionStrip && !hideLayoutUsageFailureBanner && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-950 px-4 py-2 sm:px-6 flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="min-w-0">
            Plan limits could not be loaded. Project filters and usage metrics may be incomplete until this
            succeeds.
          </p>
          <button
            type="button"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['subscription', 'usage'] })}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 border border-amber-300/80"
          >
            Retry
          </button>
        </div>
      )}

      {layoutBrandingQueryFailed && !hideLayoutBrandingFailureBanner && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-950 px-4 py-2 sm:px-6 flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="min-w-0">Organisation branding could not be loaded.</p>
          <button
            type="button"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['settings', 'branding'] })}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 border border-amber-300/80"
          >
            Retry
          </button>
        </div>
      )}
    </>
  )

  const topBarEnd = (
    <>
      <NotificationsBell />
      <div
        className="hidden sm:flex w-8 h-8 rounded-full bg-primary-100 items-center justify-center text-primary-700 font-semibold text-sm shrink-0"
        title={user?.email ?? ''}
        aria-hidden
      >
        {user?.name?.[0] || user?.email?.[0]?.toUpperCase() || 'U'}
      </div>
    </>
  )

  return (
    <SidebarShell
      open={sidebarOpen}
      onOpen={() => setSidebarOpen(true)}
      onClose={closeSidebar}
      sidebar={sidebar}
      banners={banners}
      topBarEnd={topBarEnd}
      sidebarLabel="Workspace navigation"
    >
      <Outlet />
    </SidebarShell>
  )
}
