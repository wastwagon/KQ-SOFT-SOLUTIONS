import { useState } from 'react'
import { Link } from 'react-router-dom'
import { auth } from '../lib/api'
import BrandLogo from '../components/BrandLogo'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await auth.forgotPassword(email)
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed')
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
          <h2 className="text-lg font-semibold text-gray-900">Forgot password</h2>
          {sent ? (
            <p className="text-sm text-gray-600">
              If that email exists in our system, a reset link was sent. Check your inbox and spam folder.
            </p>
          ) : (
            <>
              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>
              )}
              <p className="text-sm text-gray-600">
                Enter your email and we will send you a link to reset your password.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-border rounded-lg bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="you@example.com"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              >
                {loading ? 'Sending...' : 'Send reset link'}
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
