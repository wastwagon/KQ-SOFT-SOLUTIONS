import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { auth } from '../lib/api'
import BrandLogo from '../components/BrandLogo'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (!token) {
      setError('Invalid reset link')
      return
    }
    setLoading(true)
    try {
      await auth.resetPassword(token, password)
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-surface px-4 relative">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center">
            <BrandLogo className="h-12 sm:h-14 w-auto max-w-full object-contain" />
          </div>
          <p className="text-gray-500 mt-3">Bank Reconciliation SaaS</p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg p-6 space-y-4 border border-border shadow-card"
        >
          <h2 className="text-lg font-semibold text-gray-900">Reset password</h2>
          {success ? (
            <p className="text-sm text-green-600">
              Password reset successfully. Redirecting to login...
            </p>
          ) : !token ? (
            <p className="text-sm text-red-600">
              Invalid or missing reset link. Request a new one from the forgot password page.
            </p>
          ) : (
            <>
              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="At least 6 characters"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              >
                {loading ? 'Resetting...' : 'Reset password'}
              </button>
            </>
          )}
          <p className="text-center text-sm text-gray-500">
            <Link to="/login" className="text-primary-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded">
              Back to login
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
