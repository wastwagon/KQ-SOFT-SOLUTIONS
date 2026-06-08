import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { settings, unlessSubscriptionInactive } from '../../lib/api'
import { useConfirm } from '../ui/ConfirmDialog'
import { useToast } from '../ui/Toast'

export default function MembersSection({ canManage = false }: { canManage?: boolean }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const confirm = useConfirm()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<string>('preparer')
  const [addMode, setAddMode] = useState<'invite' | 'existing'>('invite')

  const { data, isLoading, error: membersQueryError } = useQuery({
    queryKey: ['settings', 'members'],
    queryFn: settings.getMembers,
  })

  const addMutation = useMutation({
    mutationFn: (body: { email: string; role: string }) => settings.addMember(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'members'] })
      setEmail('')
      setRole('preparer')
      toast.success('Member added')
    },
    onError: (err) =>
      unlessSubscriptionInactive(err, (e) =>
        toast.error('Could not add member', e instanceof Error ? e.message : undefined)
      ),
  })

  const inviteMutation = useMutation({
    mutationFn: (body: { email: string; role: string }) => settings.inviteMember(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'members'] })
      setEmail('')
      setRole('preparer')
      toast.success('Invitation sent', 'They can join via the email link (valid 7 days).')
    },
    onError: (err) =>
      unlessSubscriptionInactive(err, (e) =>
        toast.error('Could not send invite', e instanceof Error ? e.message : undefined)
      ),
  })

  const removeMutation = useMutation({
    mutationFn: settings.removeMember,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'members'] })
      toast.success('Member removed')
    },
    onError: (err) =>
      unlessSubscriptionInactive(err, (e) =>
        toast.error('Could not remove member', e instanceof Error ? e.message : undefined)
      ),
  })

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role: newRole }: { userId: string; role: string }) =>
      settings.updateMemberRole(userId, newRole),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'members'] })
      toast.success('Role updated')
    },
    onError: (err) =>
      unlessSubscriptionInactive(err, (e) =>
        toast.error('Could not update role', e instanceof Error ? e.message : undefined)
      ),
  })

  const revokeMutation = useMutation({
    mutationFn: settings.revokeInvite,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'members'] })
      toast.success('Invitation revoked')
    },
    onError: (err) =>
      unlessSubscriptionInactive(err, (e) =>
        toast.error('Could not revoke invite', e instanceof Error ? e.message : undefined)
      ),
  })

  const members = data?.members ?? []
  const pendingInvites = data?.pendingInvites ?? []
  const limit = data?.limit
  const currentCount = data?.currentCount ?? 0
  const pendingInviteCount = data?.pendingInviteCount ?? pendingInvites.length
  const seatCount = currentCount + pendingInviteCount
  const atLimit = limit != null && seatCount >= limit

  if (isLoading) return <p className="text-sm text-gray-500">Loading members...</p>

  if (membersQueryError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p className="font-medium text-red-900">Could not load members</p>
        <p className="mt-1">
          {membersQueryError instanceof Error ? membersQueryError.message : 'Something went wrong.'}
        </p>
        <button
          type="button"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['settings', 'members'] })}
          className="mt-3 px-3 py-1.5 text-sm font-medium rounded-lg bg-white border border-red-300 text-red-900 hover:bg-red-100"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-sm">
            <button
              type="button"
              onClick={() => setAddMode('invite')}
              className={`px-3 py-1.5 rounded-lg border ${
                addMode === 'invite'
                  ? 'border-primary-600 bg-primary-50 text-primary-800'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Invite by email
            </button>
            <button
              type="button"
              onClick={() => setAddMode('existing')}
              className={`px-3 py-1.5 rounded-lg border ${
                addMode === 'existing'
                  ? 'border-primary-600 bg-primary-50 text-primary-800'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Add existing user
            </button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!email.trim() || atLimit) return
              const body = { email: email.trim(), role }
              if (addMode === 'invite') inviteMutation.mutate(body)
              else addMutation.mutate(body)
            }}
            className="flex flex-wrap gap-2"
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={
                addMode === 'invite'
                  ? 'Email to send invitation'
                  : 'Email (user must already be registered)'
              }
              className="flex-1 min-w-0 sm:min-w-[200px] px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-900 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-white text-gray-900 shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="viewer">Viewer</option>
              <option value="preparer">Preparer</option>
              <option value="reviewer">Reviewer</option>
            </select>
            <button
              type="submit"
              disabled={
                (addMode === 'invite' ? inviteMutation.isPending : addMutation.isPending) ||
                !email.trim() ||
                atLimit
              }
              className="px-4 py-2.5 font-medium bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 text-sm shadow-sm hover:shadow focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all"
            >
              {addMode === 'invite'
                ? inviteMutation.isPending
                  ? 'Sending...'
                  : 'Send invite'
                : addMutation.isPending
                  ? 'Adding...'
                  : 'Add member'}
            </button>
          </form>
          {addMode === 'invite' && (
            <p className="text-xs text-gray-500">
              New users register via the link; existing users can sign in with the same link to join
              your organisation.
            </p>
          )}
        </div>
      )}
      {atLimit && canManage && (
        <p className="text-sm text-amber-600">
          You&apos;ve reached your plan limit ({limit} member{limit === 1 ? '' : 's'}). Upgrade to add
          more.
        </p>
      )}
      <p className="text-xs text-gray-500">
        {seatCount}
        {limit != null ? ` / ${limit}` : ''} seats
        {pendingInviteCount > 0 ? ` (${pendingInviteCount} pending invite${pendingInviteCount === 1 ? '' : 's'})` : ''}
      </p>
      {canManage && pendingInvites.length > 0 && (
        <div className="border border-dashed border-gray-200 rounded-xl overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Pending invitations</p>
          </div>
          <ul className="divide-y divide-gray-100">
            {pendingInvites.map((invite) => (
              <li key={invite.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate">{invite.email}</p>
                  <p className="text-xs text-gray-500 capitalize">
                    {invite.role} · expires {new Date(invite.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => revokeMutation.mutate(invite.id)}
                  disabled={revokeMutation.isPending}
                  className="text-xs font-medium text-red-600 hover:text-red-700"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
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
                          value={m.role === 'member' ? 'preparer' : m.role}
                          onChange={(e) =>
                            updateRoleMutation.mutate({ userId: m.userId, role: e.target.value })
                          }
                          disabled={updateRoleMutation.isPending}
                          className="px-2 py-1 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 shadow-sm focus:ring-2 focus:ring-primary-500 transition-shadow"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="preparer">Preparer</option>
                          <option value="reviewer">Reviewer</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <span className="capitalize">
                          {m.role === 'member' ? 'preparer' : m.role}
                        </span>
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
