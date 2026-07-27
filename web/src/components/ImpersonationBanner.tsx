import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { auth } from '../lib/api'
import { useAuth } from '../store/auth'
import { useToast } from './ui/Toast'

/** Persistent banner while a platform admin is inside a subscriber workspace. */
export default function ImpersonationBanner() {
  const impersonating = useAuth((s) => s.impersonating)
  const org = useAuth((s) => s.org)
  const setAuth = useAuth((s) => s.setAuth)
  const toast = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const exitMutation = useMutation({
    mutationFn: () => auth.exitImpersonation(),
    onSuccess: (data) => {
      setAuth(data.user, data.org, data.token, data.role, data.isPlatformAdmin, false)
      queryClient.clear()
      toast.success('Exited workspace', `Back to ${data.org.name}`)
      navigate('/platform-admin/organizations')
    },
    onError: (e) => {
      toast.error('Could not exit', e instanceof Error ? e.message : 'Request failed')
    },
  })

  if (!impersonating) return null

  return (
    <div className="bg-amber-600 text-white px-4 py-2.5 text-sm flex flex-wrap items-center justify-between gap-3 shadow-sm">
      <p className="font-medium">
        Support mode — viewing workspace as{' '}
        <span className="font-semibold underline decoration-white/40">{org?.name ?? 'subscriber'}</span>.
        Changes you make apply to this organisation.
      </p>
      <button
        type="button"
        onClick={() => exitMutation.mutate()}
        disabled={exitMutation.isPending}
        className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 px-3 py-1.5 text-xs font-semibold border border-white/30 disabled:opacity-60"
      >
        <LogOut className="w-3.5 h-3.5" aria-hidden />
        {exitMutation.isPending ? 'Exiting…' : 'Exit to platform admin'}
      </button>
    </div>
  )
}
