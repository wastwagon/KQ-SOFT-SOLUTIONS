import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Check, ChevronDown } from 'lucide-react'
import { auth } from '../lib/api'
import { useAuth } from '../store/auth'
import { useToast } from './ui/Toast'

export default function OrgSwitcher() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const org = useAuth((s) => s.org)
  const setAuth = useAuth((s) => s.setAuth)
  const user = useAuth((s) => s.user)
  const [open, setOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['auth', 'orgs'],
    queryFn: auth.listOrgs,
    staleTime: 60_000,
  })

  const organizations = data?.organizations ?? []
  const showSwitcher = organizations.length > 1

  const switchMutation = useMutation({
    mutationFn: (orgId: string) => auth.switchOrg(orgId),
    onSuccess: (result) => {
      setAuth(result.user, result.org, result.token, result.role, result.isPlatformAdmin)
      queryClient.clear()
      setOpen(false)
      toast.success('Workspace switched', result.org.name)
      window.location.assign('/dashboard')
    },
    onError: (err) => {
      toast.error('Could not switch workspace', err instanceof Error ? err.message : undefined)
    },
  })

  if (!org?.name) return null

  if (!showSwitcher) {
    return (
      <div className="hidden lg:flex flex-col items-end mr-1">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-0.5">
          Organisation
        </span>
        <span className="text-sm font-semibold text-gray-900 truncate max-w-[150px]" title={org.name}>
          {org.name}
        </span>
      </div>
    )
  }

  return (
    <div className="relative hidden lg:block mr-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex flex-col items-end rounded-lg px-2 py-1 hover:bg-gray-50 transition-colors"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={switchMutation.isPending}
      >
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-0.5">
          Organisation
        </span>
        <span className="flex items-center gap-1 text-sm font-semibold text-gray-900 truncate max-w-[180px]">
          <Building2 className="w-3.5 h-3.5 shrink-0 text-primary-600" aria-hidden />
          <span className="truncate" title={org.name}>
            {org.name}
          </span>
          <ChevronDown className="w-3.5 h-3.5 shrink-0 text-gray-400" aria-hidden />
        </span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" aria-hidden onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-1 z-40 w-64 rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
            role="listbox"
            aria-label="Switch organisation"
          >
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Workspaces</p>
              <p className="text-xs text-gray-500 truncate mt-0.5">{user?.email}</p>
            </div>
            {isLoading ? (
              <p className="px-3 py-4 text-sm text-gray-500">Loading…</p>
            ) : (
              organizations.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="option"
                  aria-selected={o.current}
                  onClick={() => {
                    if (!o.current) switchMutation.mutate(o.id)
                    else setOpen(false)
                  }}
                  disabled={switchMutation.isPending}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-gray-50 ${
                    o.current ? 'bg-primary-50/60 text-primary-900' : 'text-gray-800'
                  }`}
                >
                  <span className="flex-1 min-w-0">
                    <span className="block font-medium truncate">{o.name}</span>
                    <span className="block text-xs text-gray-500 capitalize">{o.role}</span>
                  </span>
                  {o.current && <Check className="w-4 h-4 shrink-0 text-primary-600" aria-hidden />}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
