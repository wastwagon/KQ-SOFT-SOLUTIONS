import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { auth } from '../lib/api'
import AuthLayout, {
  authAlertErrorClass,
  authCardClass,
  authFieldClass,
  authLabelClass,
  authPrimaryButtonClass,
} from '../components/AuthLayout'
import { useToast } from '../components/ui/Toast'

export default function ResetPassword() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const navigate = useNavigate()
  const toast = useToast()
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
      toast.success('Password updated', 'You’ll be redirected to sign in.')
      setTimeout(() => navigate('/login'), 2000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Reset failed'
      setError(msg)
      toast.error('Could not reset password', msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="Security"
      title="Choose a new password"
      subtitle="Pick a strong password you haven’t used elsewhere."
    >
      <form onSubmit={handleSubmit} className={`${authCardClass} space-y-5`}>
        {success ? (
          <div className="space-y-3 text-center">
            <p className="text-sm font-medium text-green-700">
              Password updated. Redirecting you to sign in…
            </p>
          </div>
        ) : !token ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-red-700">
              This reset link is invalid or expired. Request a new one from the forgot password page.
            </p>
            <Link
              to="/forgot-password"
              className="inline-flex font-semibold text-primary-600 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
            >
              Request new link
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <div className={authAlertErrorClass} role="alert">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="reset-password" className={authLabelClass}>
                New password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" aria-hidden />
                <input
                  id="reset-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className={`${authFieldClass} pl-11`}
                  placeholder="At least 6 characters"
                />
              </div>
            </div>
            <div>
              <label htmlFor="reset-confirm" className={authLabelClass}>
                Confirm password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" aria-hidden />
                <input
                  id="reset-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  className={`${authFieldClass} pl-11`}
                  placeholder="Repeat new password"
                />
              </div>
            </div>
            <button type="submit" disabled={loading} className={authPrimaryButtonClass}>
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </>
        )}

        {!success && token && (
          <p className="border-t border-gray-100 pt-5 text-center text-sm text-gray-600">
            <Link
              to="/login"
              className="font-semibold text-primary-600 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
            >
              Back to sign in
            </Link>
          </p>
        )}
      </form>
    </AuthLayout>
  )
}
