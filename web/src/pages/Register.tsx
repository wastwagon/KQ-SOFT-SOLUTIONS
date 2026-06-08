import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { Building2, Mail, User } from 'lucide-react'
import PasswordInput from '../components/PasswordInput'
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
  const [searchParams] = useSearchParams()
  const inviteToken = searchParams.get('invite')?.trim() || ''
  const isAuthenticated = useAuth((s) => !!s.token)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [orgName, setOrgName] = useState('')
  const [inviteOrgName, setInviteOrgName] = useState<string | null>(null)
  const [inviteLoading, setInviteLoading] = useState(!!inviteToken)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const setAuth = useAuth((s) => s.setAuth)
  const toast = useToast()

  useEffect(() => {
    if (!inviteToken) return
    let cancelled = false
    setInviteLoading(true)
    auth
      .getInvite(inviteToken)
      .then((invite) => {
        if (cancelled) return
        setEmail(invite.email)
        setInviteOrgName(invite.organization.name)
        setError('')
      })
      .catch((err) => {
        if (cancelled) return
        setInviteOrgName(null)
        setError(err instanceof Error ? err.message : 'Invite is invalid or has expired.')
      })
      .finally(() => {
        if (!cancelled) setInviteLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [inviteToken])

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  const joiningOrg = !!inviteToken && !!inviteOrgName

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { user, org, token, role, isPlatformAdmin } = await auth.register({
        email,
        password,
        name: name || undefined,
        orgName: joiningOrg ? undefined : orgName,
        inviteToken: joiningOrg ? inviteToken : undefined,
      })
      setAuth(user, org, token, role, isPlatformAdmin)
      toast.success(
        joiningOrg ? 'Welcome to the team' : 'Workspace created',
        joiningOrg
          ? `You joined ${org.name}.`
          : `Welcome to KQ-SOFT, ${name || email.split('@')[0]}.`
      )
      navigate('/dashboard')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Registration failed'
      setError(msg)
      toast.error(joiningOrg ? 'Could not join organisation' : 'Could not create workspace', msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      eyebrow={joiningOrg ? 'Team invitation' : 'Get started'}
      title={joiningOrg ? `Join ${inviteOrgName}` : 'Create your workspace'}
      subtitle={
        joiningOrg
          ? 'Create your account to accept the invitation. Use the email address the invite was sent to.'
          : 'One organisation per account. You can invite teammates from Settings after you sign up.'
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className={authAlertErrorClass} role="alert">
            {error}
          </div>
        )}

        {!joiningOrg && (
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
        )}

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
              readOnly={joiningOrg}
              className={`${authFieldClass} pl-11 ${joiningOrg ? 'bg-gray-50' : ''}`}
              placeholder="you@firm.com"
            />
          </div>
        </div>

        <div>
          <label htmlFor="register-password" className={authLabelClass}>
            Password
          </label>
          <PasswordInput
            id="register-password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            placeholder="At least 6 characters"
            minLength={6}
          />
          <p className="mt-1.5 text-xs text-gray-500">
            Use at least 6 characters. You can change this anytime from your profile.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading || inviteLoading || (joiningOrg && !inviteOrgName)}
          className={authPrimaryButtonClass}
        >
          {loading
            ? joiningOrg
              ? 'Joining…'
              : 'Creating workspace…'
            : inviteLoading
              ? 'Loading invite…'
              : joiningOrg
                ? 'Join organisation'
                : 'Create workspace'}
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
            to={inviteToken ? `/login?invite=${encodeURIComponent(inviteToken)}` : '/login'}
            className="font-semibold text-primary-600 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
          >
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
