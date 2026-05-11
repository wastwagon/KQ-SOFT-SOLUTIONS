import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, UserX, UserCheck } from 'lucide-react'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/format'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import PageHeader from '../../components/layout/PageHeader'

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()

  const { data: user, isLoading } = useQuery({
    queryKey: ['admin', 'user', id],
    queryFn: () =>
      api(`/admin/users/${id}`) as Promise<{
        id: string
        email: string
        name: string | null
        suspendedAt: string | null
        createdAt: string
        updatedAt: string
        memberships: {
          organizationId: string
          role: string
          organization: { id: string; name: string; slug: string; plan: string }
        }[]
      }>,
    enabled: !!id,
  })

  const updateMutation = useMutation({
    mutationFn: (suspendedAt: string | null) =>
      api(`/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ suspendedAt }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'user', id] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })

  if (!id || isLoading || !user) {
    return (
      <div>
        <Link
          to="/platform-admin/users"
          className="inline-flex gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Users
        </Link>
        <p className="text-gray-500">{isLoading ? 'Loading...' : 'User not found'}</p>
      </div>
    )
  }

  const suspended = user.suspendedAt != null

  return (
    <div className="space-y-8">
      <Link
        to="/platform-admin/users"
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Users
      </Link>

      <PageHeader
        eyebrow="Platform admin"
        title={user.name || user.email}
        subtitle={<p className="text-gray-500 font-mono text-sm">{user.email}</p>}
        actions={
          <div className="flex flex-wrap items-center gap-2">
          {suspended ? (
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-700">
              Suspended
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
              Active
            </span>
          )}
          {suspended ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateMutation.mutate(null)}
              disabled={updateMutation.isPending}
            >
              <UserCheck className="w-4 h-4 mr-1" />
              {updateMutation.isPending ? 'Restoring...' : 'Restore'}
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateMutation.mutate(new Date().toISOString())}
              disabled={updateMutation.isPending}
              className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
            >
              <UserX className="w-4 h-4 mr-1" />
              {updateMutation.isPending ? 'Suspending...' : 'Suspend'}
            </Button>
          )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="p-4">
          <p className="text-sm text-gray-500 font-medium">Status</p>
          <p className="text-lg font-bold text-gray-900 mt-1">
            {suspended ? 'Suspended' : 'Active'}
          </p>
          {suspended && user.suspendedAt && (
            <p className="text-xs text-gray-500 mt-0.5">
              Since {formatDate(user.suspendedAt)}
            </p>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500 font-medium">Joined</p>
          <p className="text-lg font-bold text-gray-900 mt-1">
            {formatDate(user.createdAt)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500 font-medium">Organizations</p>
          <p className="text-lg font-bold text-gray-900 mt-1">
            {user.memberships.length}
          </p>
        </Card>
      </div>

      <Card>
        <h3 className="font-semibold text-gray-900 mb-4">Organizations</h3>
        {user.memberships.length === 0 ? (
          <p className="text-sm text-gray-500">No organizations</p>
        ) : (
          <ul className="space-y-2">
            {user.memberships.map((m) => (
              <li key={m.organizationId} className="flex justify-between items-center text-sm">
                <Link
                  to={`/platform-admin/organizations/${m.organization.slug}`}
                  className="text-primary-600 hover:underline"
                >
                  {m.organization.name}
                </Link>
                <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700 capitalize">
                  {m.role}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
