import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import AdminLayout from './components/AdminLayout'
import ProtectedRoute from './components/ProtectedRoute'
import PlatformAdminRoute from './components/PlatformAdminRoute'
import AuthHydrator from './components/AuthHydrator'
import ErrorFallback from './components/ErrorFallback'
import PageLoader from './components/PageLoader'
import { ToastProvider } from './components/ui/Toast'
import { ConfirmDialogProvider } from './components/ui/ConfirmDialog'
import { useAuth } from './store/auth'

const Landing = lazy(() => import('./pages/Landing'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const AdminOverview = lazy(() => import('./pages/admin/AdminOverview'))
const AdminPlans = lazy(() => import('./pages/admin/AdminPlans'))
const AdminGenerationSettings = lazy(() => import('./pages/admin/AdminGenerationSettings'))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'))
const AdminUserDetail = lazy(() => import('./pages/admin/AdminUserDetail'))
const AdminSubscribers = lazy(() => import('./pages/admin/AdminSubscribers'))
const AdminOrgDetail = lazy(() => import('./pages/admin/AdminOrgDetail'))
const AdminRevenue = lazy(() => import('./pages/admin/AdminRevenue'))
const AdminPayments = lazy(() => import('./pages/admin/AdminPayments'))
const AdminDatabase = lazy(() => import('./pages/admin/AdminDatabase'))
const Projects = lazy(() => import('./pages/Projects'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const ProjectNew = lazy(() => import('./pages/ProjectNew'))
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'))
const Audit = lazy(() => import('./pages/Audit'))
const Clients = lazy(() => import('./pages/Clients'))
const Settings = lazy(() => import('./pages/Settings'))
const UserManual = lazy(() => import('./pages/UserManual'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))
const NotFound = lazy(() => import('./pages/NotFound'))

const queryClient = new QueryClient()

/**
 * Root path resolver:
 *   - Logged-in visitors are sent to their dashboard.
 *   - Everyone else sees the public landing page.
 *
 * Kept inside <BrowserRouter> so <Navigate> works.
 */
function HomeRoute() {
  const isAuthenticated = useAuth((s) => !!s.token)
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }
  return <Landing />
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ConfirmDialogProvider>
          <AuthHydrator />
          <BrowserRouter>
            {/*
              App-wide ErrorBoundary catches render errors anywhere in the
              tree and shows a branded recovery screen instead of a blank
              page.  Individual sections still wrap themselves in <ErrorFallback>
              when they want a smaller per-panel fallback.
            */}
            <ErrorFallback variant="page">
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Public marketing & auth pages */}
                  <Route path="/" element={<HomeRoute />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />

                  {/* Platform admin */}
                  <Route path="/platform-admin" element={<ProtectedRoute><PlatformAdminRoute><AdminLayout /></PlatformAdminRoute></ProtectedRoute>}>
                    <Route index element={<AdminOverview />} />
                    <Route path="organizations/:slug" element={<AdminOrgDetail />} />
                    <Route path="organizations" element={<AdminSubscribers />} />
                    <Route path="subscribers" element={<Navigate to="/platform-admin/organizations" replace />} />
                    <Route path="users/:id" element={<AdminUserDetail />} />
                    <Route path="users" element={<AdminUsers />} />
                    <Route path="plans" element={<AdminPlans />} />
                    <Route path="payments" element={<AdminPayments />} />
                    <Route path="revenue" element={<AdminRevenue />} />
                    <Route path="generation-settings" element={<AdminGenerationSettings />} />
                    <Route path="database" element={<AdminDatabase />} />
                  </Route>

                  {/* Authenticated app — same root-level paths as before, plus
                      /dashboard for the index. Public landing now owns "/". */}
                  <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/projects" element={<Projects />} />
                    <Route path="/projects/new" element={<ProjectNew />} />
                    <Route path="/projects/:slug" element={<ProjectDetail />} />
                    <Route path="/reports" element={<Projects initialStatus="completed" />} />
                    <Route path="/audit" element={<Audit />} />
                    <Route path="/clients" element={<Clients />} />
                    <Route path="/manual" element={<UserManual />} />
                    <Route path="/settings" element={<Navigate to="/settings/branding" replace />} />
                    <Route path="/settings/:tab" element={<Settings />} />
                  </Route>

                  <Route path="/admin" element={<Navigate to="/platform-admin" replace />} />
                  <Route path="/admin/*" element={<Navigate to="/platform-admin" replace />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </ErrorFallback>
          </BrowserRouter>
        </ConfirmDialogProvider>
      </ToastProvider>
    </QueryClientProvider>
  )
}

export default App
