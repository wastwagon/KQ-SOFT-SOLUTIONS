import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Lock, Mail } from 'lucide-react'
import { auth } from '../lib/api'
import { useAuth } from '../store/auth'
import AuthLayout, {
  authAlertErrorClass,
  authAlertWarnClass,
  authCardClass,
  authFieldClass,
  authLabelClass,
  authPrimaryButtonClass,
} from '../components/AuthLayout'

export default function Login() {
  const [searchParams] = useSearchParams()
  const sessionExpired = searchParams.get('session') === 'expired'
  const isAuthenticated = useAuth((s) => !!s.token)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const setAuth = useAuth((s) => s.setAuth)

  if (isAuthenticated && !sessionExpired) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { user, org, token, role, isPlatformAdmin } = await auth.login({ email, password })
      setAuth(user, org, token, role, isPlatformAdmin)
      navigate(isPlatformAdmin ? '/platform-admin' : '/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Sign in"
      subtitle="Use your organisation email to access projects, reconciliations, and reports."
    >
      <form onSubmit={handleSubmit} className={`${authCardClass} space-y-5`}>
        {sessionExpired && (
          <div className={authAlertWarnClass} role="alert">
            Your session expired. Please sign in again.
          </div>
        )}
        {error && (
          <div className={authAlertErrorClass} role="alert">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="login-email" className={authLabelClass}>
            Email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" aria-hidden />
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={`${authFieldClass} pl-11`}
              placeholder="you@firm.com"
            />
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label htmlFor="login-password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-sm font-medium text-primary-600 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" aria-hidden />
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={`${authFieldClass} pl-11`}
              placeholder="Enter your password"
            />
          </div>
        </div>

        <button type="submit" disabled={loading} className={authPrimaryButtonClass}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="border-t border-gray-100 pt-5 text-center text-sm text-gray-600">
          Don&apos;t have an account?{' '}
          <Link
            to="/register"
            className="font-semibold text-primary-600 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
          >
            Create an account
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
