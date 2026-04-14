import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import AdminLayout from './components/AdminLayout'
import ProtectedRoute from './components/ProtectedRoute'
import PlatformAdminRoute from './components/PlatformAdminRoute'
import AuthHydrator from './components/AuthHydrator'

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
const Projects = lazy(() => import('./pages/Projects'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const ProjectNew = lazy(() => import('./pages/ProjectNew'))
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'))
const Audit = lazy(() => import('./pages/Audit'))
const Clients = lazy(() => import('./pages/Clients'))
const Settings = lazy(() => import('./pages/Settings'))
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/ResetPassword'))

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthHydrator />
      <BrowserRouter>
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-gray-600">Loading page...</div>}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
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
            </Route>
            <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="projects" element={<Projects />} />
              <Route path="projects/new" element={<ProjectNew />} />
              <Route path="projects/:slug" element={<ProjectDetail />} />
              <Route path="reports" element={<Projects initialStatus="completed" />} />
              <Route path="audit" element={<Audit />} />
              <Route path="clients" element={<Clients />} />
              <Route path="settings" element={<Navigate to="/settings/branding" replace />} />
              <Route path="settings/:tab" element={<Settings />} />
            </Route>
            <Route path="/admin" element={<Navigate to="/platform-admin" replace />} />
            <Route path="/admin/*" element={<Navigate to="/platform-admin" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
