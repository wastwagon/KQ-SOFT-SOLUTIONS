import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Mail } from 'lucide-react'
import PasswordInput from '../components/PasswordInput'
import { auth } from '../lib/api'
import { useAuth } from '../store/auth'
import AuthLayout, { authAlertErrorClass, authAlertWarnClass } from '../components/AuthLayout'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import { useToast } from '../components/ui/Toast'

export default function Login() {
  const [searchParams] = useSearchParams()
  const sessionExpired = searchParams.get('session') === 'expired'
  const inviteToken = searchParams.get('invite')?.trim() || ''
  const isAuthenticated = useAuth((s) => !!s.token)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteOrgName, setInviteOrgName] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const setAuth = useAuth((s) => s.setAuth)
  const toast = useToast()

  useEffect(() => {
    if (!inviteToken) return
    let cancelled = false
    auth
      .getInvite(inviteToken)
      .then((invite) => {
        if (cancelled) return
        setEmail(invite.email)
        setInviteOrgName(invite.organization.name)
      })
      .catch(() => {
        if (!cancelled) setInviteOrgName(null)
      })
    return () => {
      cancelled = true
    }
  }, [inviteToken])

  if (isAuthenticated && !sessionExpired) {
    return <Navigate to="/dashboard" replace />
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { user, org, token, role, isPlatformAdmin } = await auth.login({
        email,
        password,
        inviteToken: inviteToken || undefined,
      })
      setAuth(user, org, token, role, isPlatformAdmin)
      if (inviteToken && inviteOrgName) {
        toast.success('Invitation accepted', `You joined ${org.name}.`)
      }
      navigate(isPlatformAdmin ? '/platform-admin' : '/dashboard')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Login failed'
      setError(msg)
      toast.error('Sign in failed', msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      eyebrow={inviteOrgName ? 'Team invitation' : 'Welcome back'}
      title={inviteOrgName ? `Join ${inviteOrgName}` : 'Sign in'}
      subtitle={
        inviteOrgName
          ? 'Sign in with the invited email to accept and open this organisation.'
          : 'Use your organisation email to access projects, reconciliations, and reports.'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
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

        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="you@firm.com"
          leading={<Mail className="h-[18px] w-[18px]" aria-hidden />}
        />

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
          <PasswordInput
            id="login-password"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            placeholder="Enter your password"
          />
        </div>

        <Button type="submit" size="lg" className="w-full font-semibold shadow-lg shadow-primary-600/25" isLoading={loading} disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </Button>

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
