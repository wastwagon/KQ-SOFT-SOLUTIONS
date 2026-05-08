import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { auth } from '../lib/api'
import { useAuth } from '../store/auth'
import BrandLogo from '../components/BrandLogo'

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

  // Already signed in? Skip the form. (Stale "session=expired" urls are
  // ignored — the user clearly has a fresh session if !!token is true.)
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
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface px-4 relative">
      <div className="w-full max-w-md">
        <div className="mb-8 flex w-full flex-col items-center text-center">
          <BrandLogo className="h-12 w-auto sm:h-14" />
          <p className="mt-3 w-full text-sm text-gray-500 sm:text-base">Bank Reconciliation SaaS</p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg p-6 space-y-4 border border-border shadow-card"
        >
          <h2 className="text-lg font-semibold text-gray-900">Sign in</h2>
          {sessionExpired && (
            <div className="p-3 bg-amber-50 text-amber-800 rounded-lg text-sm">
              Your session expired. Please sign in again.
            </div>
          )}
          {error && (
            <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-border rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
          <p className="text-center text-sm text-gray-500">
            <Link to="/forgot-password" className="text-primary-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded">
              Forgot password?
            </Link>
          </p>
          <p className="text-center text-sm text-gray-500">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded">
              Register
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
