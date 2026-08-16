import { Suspense, useEffect, useState } from 'react'
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Building2,
  CreditCard,
  DollarSign,
  Receipt,
  Settings,
  Server,
  ArrowLeft,
  Activity,
  Archive,
  Inbox,
  Landmark,
  FileSpreadsheet,
} from 'lucide-react'
import { useAuth } from '../store/auth'
import BrandLogo from './BrandLogo'
import AccountMenu from './AccountMenu'
import CommandPalette from './CommandPalette'
import SidebarShell, { SidebarHeader, SidebarNavSection } from './layout/SidebarShell'
import { sidebarNavLinkClass } from './layout/sidebarStyles'
import TopBarCrumbs from './layout/TopBarCrumbs'
import RouteFallback from './layout/RouteFallback'

export default function AdminLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isPlatformAdmin } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const path = location.pathname

  useEffect(() => {
    if (!isPlatformAdmin) navigate('/')
  }, [isPlatformAdmin, navigate])

  if (!isPlatformAdmin) {
    return null
  }

  const closeSidebar = () => setSidebarOpen(false)

  const overviewActive = path === '/platform-admin'
  const tenantsActive =
    path.startsWith('/platform-admin/organizations') || path.startsWith('/platform-admin/users')
  const commerceActive =
    path.startsWith('/platform-admin/plans') ||
    path.startsWith('/platform-admin/payments') ||
    path.startsWith('/platform-admin/revenue')
  const opsActive =
    path.startsWith('/platform-admin/generation-settings') ||
    path.startsWith('/platform-admin/database') ||
    path.startsWith('/platform-admin/ops-metrics') ||
    path.startsWith('/platform-admin/retention') ||
    path.startsWith('/platform-admin/leads')
  const toolsActive = path.startsWith('/platform-admin/tools')

  const sidebar = (
    <>
      <SidebarHeader onClose={closeSidebar}>
        <NavLink
          to="/platform-admin"
          onClick={closeSidebar}
          className="flex items-center gap-2.5 min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 rounded-lg"
        >
          <BrandLogo variant="icon" className="h-9 w-9 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">Platform Admin</p>
            <p className="text-[11px] text-gray-500 truncate">KQ Soft Solutions</p>
          </div>
        </NavLink>
      </SidebarHeader>

      <nav className="flex-1 overflow-y-auto py-2 px-3" aria-label="Platform admin">
        <SidebarNavSection label="Overview" active={overviewActive}>
          <NavLink to="/platform-admin" end onClick={closeSidebar} className={sidebarNavLinkClass}>
            <LayoutDashboard className="w-5 h-5 flex-shrink-0 opacity-80" />
            Dashboard
          </NavLink>
        </SidebarNavSection>

        <SidebarNavSection label="Tenants" active={tenantsActive}>
          <NavLink
            to="/platform-admin/organizations"
            onClick={closeSidebar}
            className={sidebarNavLinkClass}
          >
            <Building2 className="w-5 h-5 flex-shrink-0 opacity-80" />
            Organizations
          </NavLink>
          <NavLink to="/platform-admin/users" onClick={closeSidebar} className={sidebarNavLinkClass}>
            <Users className="w-5 h-5 flex-shrink-0 opacity-80" />
            Users
          </NavLink>
        </SidebarNavSection>

        <SidebarNavSection label="Commerce" active={commerceActive}>
          <NavLink to="/platform-admin/plans" onClick={closeSidebar} className={sidebarNavLinkClass}>
            <CreditCard className="w-5 h-5 flex-shrink-0 opacity-80" />
            Plans
          </NavLink>
          <NavLink to="/platform-admin/payments" onClick={closeSidebar} className={sidebarNavLinkClass}>
            <Receipt className="w-5 h-5 flex-shrink-0 opacity-80" />
            Payments
          </NavLink>
          <NavLink to="/platform-admin/revenue" onClick={closeSidebar} className={sidebarNavLinkClass}>
            <DollarSign className="w-5 h-5 flex-shrink-0 opacity-80" />
            Revenue
          </NavLink>
        </SidebarNavSection>

        <SidebarNavSection label="Ops" active={opsActive}>
          <NavLink
            to="/platform-admin/ops-metrics"
            onClick={closeSidebar}
            className={sidebarNavLinkClass}
          >
            <Activity className="w-5 h-5 flex-shrink-0 opacity-80" />
            Ops metrics
          </NavLink>
          <NavLink to="/platform-admin/leads" onClick={closeSidebar} className={sidebarNavLinkClass}>
            <Inbox className="w-5 h-5 flex-shrink-0 opacity-80" />
            Leads
          </NavLink>
          <NavLink
            to="/platform-admin/retention"
            onClick={closeSidebar}
            className={sidebarNavLinkClass}
          >
            <Archive className="w-5 h-5 flex-shrink-0 opacity-80" />
            Data retention
          </NavLink>
          <NavLink
            to="/platform-admin/generation-settings"
            onClick={closeSidebar}
            className={sidebarNavLinkClass}
          >
            <Settings className="w-5 h-5 flex-shrink-0 opacity-80" />
            Generation settings
          </NavLink>
          <NavLink to="/platform-admin/database" onClick={closeSidebar} className={sidebarNavLinkClass}>
            <Server className="w-5 h-5 flex-shrink-0 opacity-80" />
            Database
          </NavLink>
        </SidebarNavSection>

        <SidebarNavSection label="Tools" active={toolsActive}>
          <NavLink
            to="/platform-admin/tools/clean-bank-statement"
            onClick={closeSidebar}
            className={sidebarNavLinkClass}
          >
            <Landmark className="w-5 h-5 flex-shrink-0 opacity-80" />
            Clean bank statement
          </NavLink>
          <NavLink
            to="/platform-admin/tools/clean-cash-book"
            onClick={closeSidebar}
            className={sidebarNavLinkClass}
          >
            <FileSpreadsheet className="w-5 h-5 flex-shrink-0 opacity-80" />
            Clean cash book
          </NavLink>
        </SidebarNavSection>
      </nav>

      <div className="shrink-0 border-t border-border-muted p-3">
        <Link
          to="/dashboard"
          onClick={closeSidebar}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to workspace
        </Link>
      </div>
    </>
  )

  return (
    <SidebarShell
      open={sidebarOpen}
      onOpen={() => setSidebarOpen(true)}
      onClose={closeSidebar}
      sidebar={sidebar}
      sidebarLabel="Admin navigation"
      topBarStart={<TopBarCrumbs />}
      topBarEnd={
        <>
          <CommandPalette variant="admin" />
          <AccountMenu extraItems={[{ to: '/dashboard', label: 'Back to workspace', icon: ArrowLeft }]} />
        </>
      }
    >
      <Suspense fallback={<RouteFallback />}>
        <Outlet />
      </Suspense>
    </SidebarShell>
  )
}
