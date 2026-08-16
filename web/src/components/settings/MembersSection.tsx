import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { settings, unlessSubscriptionInactive } from '../../lib/api'
import { useConfirm } from '../ui/ConfirmDialog'
import { useToast } from '../ui/Toast'
import Alert from '../ui/Alert'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Select from '../ui/Select'
import { Table, TableHead, TableBody, TableRow, TableTh, TableTd } from '../ui/Table'
import { PageBodySkeleton } from '../ui/Skeleton'

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

  if (isLoading) {
    return <PageBodySkeleton label="Loading members" />
  }

  if (membersQueryError) {
    return (
      <Alert
        tone="error"
        title="Could not load members"
        onRetry={() => queryClient.invalidateQueries({ queryKey: ['settings', 'members'] })}
      >
        {membersQueryError instanceof Error ? membersQueryError.message : 'Something went wrong.'}
      </Alert>
    )
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 text-sm">
            <Button
              type="button"
              size="sm"
              variant={addMode === 'invite' ? 'secondary' : 'outline'}
              aria-pressed={addMode === 'invite'}
              onClick={() => setAddMode('invite')}
            >
              Invite by email
            </Button>
            <Button
              type="button"
              size="sm"
              variant={addMode === 'existing' ? 'secondary' : 'outline'}
              aria-pressed={addMode === 'existing'}
              onClick={() => setAddMode('existing')}
            >
              Add existing user
            </Button>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!email.trim() || atLimit) return
              const body = { email: email.trim(), role }
              if (addMode === 'invite') inviteMutation.mutate(body)
              else addMutation.mutate(body)
            }}
            className="flex flex-wrap items-end gap-2"
          >
            <div className="flex-1 min-w-0 sm:min-w-[200px]">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={
                  addMode === 'invite'
                    ? 'Email to send invitation'
                    : 'Email (user must already be registered)'
                }
                autoComplete="email"
              />
            </div>
            <div className="w-40 shrink-0">
              <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role">
                <option value="viewer">Viewer</option>
                <option value="preparer">Preparer</option>
                <option value="reviewer">Reviewer</option>
              </Select>
            </div>
            <Button
              type="submit"
              disabled={!email.trim() || atLimit}
              isLoading={addMode === 'invite' ? inviteMutation.isPending : addMutation.isPending}
            >
              {addMode === 'invite' ? 'Send invite' : 'Add member'}
            </Button>
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
        <Alert tone="warning" title={`Plan limit reached (${limit} member${limit === 1 ? '' : 's'})`}>
          Upgrade to add more seats.
        </Alert>
      )}
      <p className="text-xs text-gray-500">
        {seatCount}
        {limit != null ? ` / ${limit}` : ''} seats
        {pendingInviteCount > 0 ? ` (${pendingInviteCount} pending invite${pendingInviteCount === 1 ? '' : 's'})` : ''}
      </p>
      {canManage && pendingInvites.length > 0 && (
        <div className="border border-dashed border-border rounded-xl overflow-hidden">
          <div className="px-4 py-2 bg-surface border-b border-border">
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
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => revokeMutation.mutate(invite.id)}
                  disabled={revokeMutation.isPending}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-border">
        <Table>
          <TableHead>
            <tr>
              <TableTh>Name</TableTh>
              <TableTh>Email</TableTh>
              <TableTh>Role</TableTh>
              {canManage && <TableTh className="w-20" />}
            </tr>
          </TableHead>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableTd colSpan={canManage ? 4 : 3} className="text-gray-500 text-center">
                  No members
                </TableTd>
              </TableRow>
            ) : (
              members.map((m: { id: string; userId: string; email: string; name: string | null; role: string }) => (
                <TableRow key={m.id}>
                  <TableTd className="font-medium text-gray-900">{m.name || '—'}</TableTd>
                  <TableTd>{m.email}</TableTd>
                  <TableTd>
                    {canManage ? (
                      <div className="w-36">
                        <Select
                          value={m.role === 'member' ? 'preparer' : m.role}
                          onChange={(e) =>
                            updateRoleMutation.mutate({ userId: m.userId, role: e.target.value })
                          }
                          disabled={updateRoleMutation.isPending}
                          aria-label={`Role for ${m.email}`}
                          className="!min-h-[36px] py-1.5 pl-3 text-sm"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="preparer">Preparer</option>
                          <option value="reviewer">Reviewer</option>
                          <option value="admin">Admin</option>
                        </Select>
                      </div>
                    ) : (
                      <span className="capitalize">
                        {m.role === 'member' ? 'preparer' : m.role}
                      </span>
                    )}
                  </TableTd>
                  {canManage && (
                    <TableTd>
                      {members.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
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
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          Remove
                        </Button>
                      )}
                    </TableTd>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
