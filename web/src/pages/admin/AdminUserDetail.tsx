import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, UserX, UserCheck } from 'lucide-react'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/format'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import PageLoadError from '../../components/ui/PageLoadError'
import Alert from '../../components/ui/Alert'
import Badge from '../../components/ui/Badge'
import MetricCard from '../../components/ui/MetricCard'
import { PageBodySkeleton } from '../../components/ui/Skeleton'
import PageHeader from '../../components/layout/PageHeader'
import ActionMenu from '../../components/ui/ActionMenu'

export default function AdminUserDetail() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()

  const { data: user, isLoading, isError, error } = useQuery({
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

  if (!id) {
    return (
      <div className="space-y-8">
        <Link
          to="/platform-admin/users"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Users
        </Link>
        <Alert tone="error" title="Missing user identifier" />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-8">
        <Link
          to="/platform-admin/users"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Users
        </Link>
        <PageHeader eyebrow="Platform admin" title="User" />
        <PageBodySkeleton label="Loading user" />
      </div>
    )
  }

  if (isError || !user) {
    return (
      <div className="space-y-8">
        <Link
          to="/platform-admin/users"
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Users
        </Link>
        <PageLoadError
          title="Could not load user"
          error={error}
          onRetry={() => queryClient.invalidateQueries({ queryKey: ['admin', 'user', id] })}
        >
          {error instanceof Error ? error.message : 'User not found.'}
        </PageLoadError>
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
        subtitle={
          <>
            <p className="text-gray-500 font-mono text-sm">{user.email}</p>
            <div className="mt-2">
              {suspended ? (
                <Badge tone="danger" size="sm" shape="soft">
                  Suspended
                </Badge>
              ) : (
                <Badge tone="success" size="sm" shape="soft">
                  Active
                </Badge>
              )}
            </div>
          </>
        }
        actions={
          suspended ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => updateMutation.mutate(null)}
              isLoading={updateMutation.isPending}
            >
              <UserCheck className="w-4 h-4 mr-1" />
              Restore user
            </Button>
          ) : (
            <ActionMenu
              label="Actions"
              variant="outline"
              size="sm"
              menuAriaLabel="User account actions"
              isLoading={updateMutation.isPending}
              items={[
                {
                  kind: 'button',
                  label: 'Suspend user',
                  icon: UserX,
                  destructive: true,
                  onClick: () => updateMutation.mutate(new Date().toISOString()),
                  disabled: updateMutation.isPending,
                },
              ]}
            />
          )
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <MetricCard
          label="Status"
          value={suspended ? 'Suspended' : 'Active'}
          sublabel={suspended && user.suspendedAt ? `Since ${formatDate(user.suspendedAt)}` : undefined}
        />
        <MetricCard label="Joined" value={formatDate(user.createdAt)} />
        <MetricCard label="Organizations" value={user.memberships.length} />
      </div>

      <Card title="Organizations">
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
                <Badge tone="neutral" size="sm" shape="soft" className="capitalize">
                  {m.role}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
