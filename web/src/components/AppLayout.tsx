import { Suspense, useState } from 'react'
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  FileCheck,
  Settings,
  ShieldCheck,
  FileText,
  Landmark,
  FileSpreadsheet,
} from 'lucide-react'
import { useAuth } from '../store/auth'
import { settings, getLogoDisplayUrl, subscription } from '../lib/api'
import {
  dismissSubscriptionBanner,
  isSubscriptionBannerDismissed,
  layoutPaywallStripShouldShow,
} from '../lib/subscriptionBanner'
import BrandLogo from './BrandLogo'
import OrgSwitcher from './OrgSwitcher'
import NotificationsBell from './NotificationsBell'
import ImpersonationBanner from './ImpersonationBanner'
import AccountMenu from './AccountMenu'
import CommandPalette from './CommandPalette'
import Button from './ui/Button'
import Alert from './ui/Alert'
import SidebarShell, { SidebarHeader, SidebarNavSection } from './layout/SidebarShell'
import { sidebarNavLinkClass } from './layout/sidebarStyles'
import TopBarCrumbs from './layout/TopBarCrumbs'
import RouteFallback from './layout/RouteFallback'

const preloadProjectsPage = () => import('../pages/Projects')
const preloadSettingsPage = () => import('../pages/Settings')

export default function AppLayout() {
  const queryClient = useQueryClient()
  const location = useLocation()
  const { isPlatformAdmin, impersonating } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [failedLogoUrl, setFailedLogoUrl] = useState<string | null>(null)
  const [subscriptionBannerDismissed, setSubscriptionBannerDismissed] = useState(
    isSubscriptionBannerDismissed
  )

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
  const subscriptionBypass = isPlatformAdmin || !!usageForBanner?.subscriptionBypass
  const sub = usageForBanner?.subscription?.status
  const showSubscriptionStrip = layoutPaywallStripShouldShow({
    impersonating,
    isPlatformAdmin,
    path,
    paywallEnabled: usageForBanner?.paywallEnabled,
    subscriptionBypass: usageForBanner?.subscriptionBypass,
    subscriptionStatus: sub,
    dismissed: subscriptionBannerDismissed,
  })
  const workspacePlanInactive =
    !!usageForBanner?.paywallEnabled && (sub === 'free' || sub === 'expired')
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
  const platformActive = path === '/platform-admin' || path.startsWith('/platform-admin/')

  const dismissSubscriptionStrip = () => {
    dismissSubscriptionBanner()
    setSubscriptionBannerDismissed(true)
  }

  const closeSidebar = () => setSidebarOpen(false)

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

        <SidebarNavSection label="Manage" active={settingsActive || path === '/audit' || path.startsWith('/audit/')}>
          <NavLink
            to="/settings/branding"
            onClick={closeSidebar}
            onMouseEnter={preloadSettingsPage}
            onFocus={preloadSettingsPage}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive || settingsActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`
            }
          >
            <Settings className="w-5 h-5 flex-shrink-0 opacity-80" />
            Settings
          </NavLink>
          <NavLink to="/audit" onClick={closeSidebar} className={sidebarNavLinkClass}>
            <FileCheck className="w-5 h-5 flex-shrink-0 opacity-80" />
            Audit log
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

      <div className="shrink-0 border-t border-border-muted p-3">
        <OrgSwitcher variant="sidebar" />
      </div>
    </>
  )

  const stripClass = 'rounded-none border-x-0 border-t-0'

  const statusBanner = showSubscriptionStrip ? (
    <Alert
      tone="warning"
      title="Subscription inactive"
      className={stripClass}
      action={
        <Button
          type="button"
          variant="outline"
          size="xs"
          onClick={dismissSubscriptionStrip}
          aria-label="Dismiss subscription notice"
        >
          Dismiss
        </Button>
      }
    >
      Core features are paused until an admin renews —{' '}
      <Link to="/settings/billing" className="font-medium underline hover:no-underline">
        open billing
      </Link>
      .
    </Alert>
  ) : !impersonating &&
    subscriptionBypass &&
    workspacePlanInactive &&
    !path.startsWith('/settings') ? (
    <Alert tone="info" title="Platform admin bypass" className={stripClass}>
      This workspace’s subscription is {sub}; core APIs remain available for your account. Tenant users
      still need an active plan.
    </Alert>
  ) : layoutUsageQueryFailed && !hideLayoutUsageFailureBanner ? (
    <Alert
      tone="warning"
      title="Plan limits could not be loaded"
      className={stripClass}
      onRetry={() => queryClient.invalidateQueries({ queryKey: ['subscription', 'usage'] })}
    >
      Project filters and usage metrics may be incomplete until this succeeds.
    </Alert>
  ) : layoutBrandingQueryFailed && !hideLayoutBrandingFailureBanner ? (
    <Alert
      tone="warning"
      title="Organisation branding could not be loaded"
      className={stripClass}
      onRetry={() => queryClient.invalidateQueries({ queryKey: ['settings', 'branding'] })}
    />
  ) : null

  const banners = impersonating ? (
    <ImpersonationBanner
      subscriptionNote={
        workspacePlanInactive
          ? `This workspace’s subscription is ${sub}; tenant users still need an active plan.`
          : undefined
      }
    />
  ) : (
    statusBanner
  )

  return (
    <SidebarShell
      open={sidebarOpen}
      onOpen={() => setSidebarOpen(true)}
      onClose={closeSidebar}
      sidebar={sidebar}
      banners={banners}
      topBarStart={<TopBarCrumbs />}
      topBarEnd={
        <>
          <CommandPalette variant="workspace" />
          <NotificationsBell />
          <AccountMenu />
        </>
      }
      sidebarLabel="Workspace navigation"
    >
      <Suspense fallback={<RouteFallback />}>
        <Outlet />
      </Suspense>
    </SidebarShell>
  )
}
