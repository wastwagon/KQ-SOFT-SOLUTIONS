import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { auth } from '../lib/api'
import { useAuth } from '../store/auth'
import { useToast } from './ui/Toast'
import Button from './ui/Button'

/** Persistent banner while a platform admin is inside a subscriber workspace. */
export default function ImpersonationBanner({ subscriptionNote }: { subscriptionNote?: string }) {
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
      <div className="min-w-0">
        <p className="font-medium">
          Support mode — viewing workspace as{' '}
          <span className="font-semibold underline decoration-white/40">{org?.name ?? 'subscriber'}</span>.
          Changes you make apply to this organisation.
        </p>
        {subscriptionNote ? <p className="mt-0.5 text-xs text-white/90">{subscriptionNote}</p> : null}
      </div>
      <Button
        type="button"
        size="xs"
        variant="outline"
        onClick={() => exitMutation.mutate()}
        isLoading={exitMutation.isPending}
        className="!bg-white/15 !text-white !border-white/30 hover:!bg-white/25 focus:!ring-white"
      >
        <LogOut className="w-3.5 h-3.5 mr-1.5" aria-hidden />
        Exit to platform admin
      </Button>
    </div>
  )
}
