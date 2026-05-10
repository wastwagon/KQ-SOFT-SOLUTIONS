import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { settings } from '../../lib/api'
import { useConfirm } from '../ui/ConfirmDialog'
import { useToast } from '../ui/Toast'

export default function MembersSection({ canManage = false }: { canManage?: boolean }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<string>('member')

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'members'],
    queryFn: settings.getMembers,
  })

  const addMutation = useMutation({
    mutationFn: (body: { email: string; role: string }) => settings.addMember(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'members'] })
      setEmail('')
      setRole('member')
      toast.success('Member added')
    },
    onError: (err) =>
      toast.error('Could not add member', err instanceof Error ? err.message : undefined),
  })

  const removeMutation = useMutation({
    mutationFn: settings.removeMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'members'] })
      toast.success('Member removed')
    },
    onError: (err) =>
      toast.error('Could not remove member', err instanceof Error ? err.message : undefined),
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role: newRole }: { userId: string; role: string }) =>
      settings.updateMemberRole(userId, newRole),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'members'] })
      toast.success('Role updated')
    },
    onError: (err) =>
      toast.error('Could not update role', err instanceof Error ? err.message : undefined),
  })

  const members = data?.members ?? []
  const limit = data?.limit
  const currentCount = data?.currentCount ?? 0
  const atLimit = limit != null && currentCount >= limit

  if (isLoading) return <p className="text-sm text-gray-500">Loading members...</p>

  return (
    <div className="space-y-4">
      {canManage && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (email.trim() && !atLimit) addMutation.mutate({ email: email.trim(), role })
          }}
          className="flex flex-wrap gap-2"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email (user must already be registered)"
            className="flex-1 min-w-0 sm:min-w-[200px] px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-900 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-900 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="member">Member</option>
            <option value="viewer">Viewer</option>
            <option value="preparer">Preparer</option>
            <option value="reviewer">Reviewer</option>
          </select>
          <button
            type="submit"
            disabled={addMutation.isPending || !email.trim() || atLimit}
            className="px-4 py-2.5 font-medium bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 text-sm shadow-sm hover:shadow focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all"
          >
            {addMutation.isPending ? 'Adding...' : 'Add member'}
          </button>
        </form>
      )}
      {atLimit && canManage && (
        <p className="text-sm text-amber-600">
          You&apos;ve reached your plan limit ({limit} member{limit === 1 ? '' : 's'}). Upgrade to add
          more.
        </p>
      )}
      <p className="text-xs text-gray-500">
        {currentCount}
        {limit != null ? ` / ${limit}` : ''} members
      </p>
      <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                {canManage && <th className="px-4 py-3 w-20" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-muted bg-white">
              {members.length === 0 ? (
                <tr>
                  <td colSpan={canManage ? 4 : 3} className="px-4 py-6 text-gray-500 text-center">
                    No members
                  </td>
                </tr>
              ) : (
                members.map((m: { id: string; userId: string; email: string; name: string | null; role: string }) => (
                  <tr key={m.id} className="hover:bg-surface/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{m.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{m.email}</td>
                    <td className="px-4 py-3">
                      {canManage ? (
                        <select
                          value={m.role}
                          onChange={(e) =>
                            updateRoleMutation.mutate({ userId: m.userId, role: e.target.value })
                          }
                          disabled={updateRoleMutation.isPending}
                          className="px-2 py-1 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 shadow-sm focus:ring-2 focus:ring-primary-500 transition-shadow"
                        >
                          <option value="member">Member</option>
                          <option value="viewer">Viewer</option>
                          <option value="preparer">Preparer</option>
                          <option value="reviewer">Reviewer</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <span className="capitalize">{m.role}</span>
                      )}
                    </td>
                    {canManage && (
                      <td className="px-4 py-3">
                        {members.length > 1 && (
                          <button
                            type="button"
                            onClick={async () => {
                              const ok = await confirm({
                                title: 'Remove this member?',
                                description: `${m.email} will lose access to this organisation.`,
                                confirmLabel: 'Remove',
                                tone: 'danger',
                              })
                              if (ok) removeMutation.mutate(m.userId)
                            }}
                            disabled={removeMutation.isPending}
                            className="text-red-600 hover:text-red-700 text-xs"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
