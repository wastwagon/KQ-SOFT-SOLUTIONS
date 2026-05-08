import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Mail } from 'lucide-react'
import { auth } from '../lib/api'
import AuthLayout, {
  authAlertErrorClass,
  authCardClass,
  authFieldClass,
  authLabelClass,
  authPrimaryButtonClass,
} from '../components/AuthLayout'

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
    <AuthLayout
      eyebrow="Account"
      title="Reset your password"
      subtitle="We’ll email you a secure link if your address is registered."
    >
      <div className={authCardClass}>
        {sent ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-700">
              <Mail className="h-6 w-6" aria-hidden />
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              If that email exists in our system, we sent a reset link. Check your inbox and spam folder.
            </p>
            <Link
              to="/login"
              className="inline-flex justify-center font-semibold text-primary-600 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className={authAlertErrorClass} role="alert">
                {error}
              </div>
            )}
            <p className="text-sm text-gray-600 leading-relaxed">
              Enter the email you use for KQ-SOFT. The link expires after a short time for security.
            </p>
            <div>
              <label htmlFor="forgot-email" className={authLabelClass}>
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" aria-hidden />
                <input
                  id="forgot-email"
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
            <button type="submit" disabled={loading} className={authPrimaryButtonClass}>
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
            <p className="border-t border-gray-100 pt-5 text-center text-sm text-gray-600">
              <Link
                to="/login"
                className="font-semibold text-primary-600 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
              >
                Back to sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </AuthLayout>
  )
}
