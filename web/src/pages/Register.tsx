import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Building2, Lock, Mail, User } from 'lucide-react'
import { auth } from '../lib/api'
import { useAuth } from '../store/auth'
import AuthLayout, {
  authAlertErrorClass,
  authFieldClass,
  authLabelClass,
  authPrimaryButtonClass,
} from '../components/AuthLayout'
import { useToast } from '../components/ui/Toast'

export default function Register() {
  const isAuthenticated = useAuth((s) => !!s.token)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [orgName, setOrgName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const setAuth = useAuth((s) => s.setAuth)
  const toast = useToast()

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { user, org, token, role, isPlatformAdmin } = await auth.register({
        email,
        password,
        name: name || undefined,
        orgName,
      })
      setAuth(user, org, token, role, isPlatformAdmin)
      toast.success('Workspace created', `Welcome to KQ-SOFT, ${name || email.split('@')[0]}.`)
      navigate('/dashboard')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed'
      setError(msg)
      toast.error('Could not create workspace', msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      eyebrow="Get started"
      title="Create your workspace"
      subtitle="One organisation per account. You can invite teammates from Settings after you sign up."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className={authAlertErrorClass} role="alert">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="register-org" className={authLabelClass}>
            Organisation name
          </label>
          <div className="relative">
            <Building2 className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" aria-hidden />
            <input
              id="register-org"
              type="text"
              autoComplete="organization"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              required
              className={`${authFieldClass} pl-11`}
              placeholder="Your firm or company name"
            />
          </div>
        </div>

        <div>
          <label htmlFor="register-name" className={authLabelClass}>
            Your name <span className="font-normal text-gray-500">(optional)</span>
          </label>
          <div className="relative">
            <User className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" aria-hidden />
            <input
              id="register-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${authFieldClass} pl-11`}
              placeholder="How we’ll greet you in the app"
            />
          </div>
        </div>

        <div>
          <label htmlFor="register-email" className={authLabelClass}>
            Work email
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" aria-hidden />
            <input
              id="register-email"
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
          <label htmlFor="register-password" className={authLabelClass}>
            Password
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" aria-hidden />
            <input
              id="register-password"
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
          <p className="mt-1.5 text-xs text-gray-500">
            Use at least 6 characters. You can change this anytime from your profile.
          </p>
        </div>

        <button type="submit" disabled={loading} className={authPrimaryButtonClass}>
          {loading ? 'Creating workspace…' : 'Create workspace'}
        </button>

        <p className="text-center text-xs leading-relaxed text-gray-500">
          By continuing you agree to use KQ-SOFT in line with your organisation’s policies.
          Need help?{' '}
          <a
            href="mailto:info@kqsoftwaresolutions.com"
            className="font-medium text-primary-600 hover:underline"
          >
            Contact support
          </a>
          .
        </p>

        <p className="border-t border-gray-100 pt-5 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-semibold text-primary-600 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
          >
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
