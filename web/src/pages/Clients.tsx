import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Building2, ChevronRight } from 'lucide-react'
import { clients, subscription, isSubscriptionInactiveError, unlessSubscriptionInactive } from '../lib/api'
import { useAuth } from '../store/auth'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import { useToast } from '../components/ui/Toast'
import SubscriptionRenewalPanel from '../components/SubscriptionRenewalPanel'
import PageHeader from '../components/layout/PageHeader'

export default function Clients() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const org = useAuth((s) => s.org)
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const usageQuery = useQuery({
    queryKey: ['subscription', 'usage'],
    queryFn: subscription.getUsage,
  })
  const { data: usageData } = usageQuery
  const features = (usageData?.features || {}) as Record<string, boolean>
  const clientsQuery = useQuery({
    queryKey: ['clients'],
    queryFn: clients.list,
  })
  const { data: clientsList = [], isLoading, isError, error: clientsListError } = clientsQuery
  const paywallBlocked = isSubscriptionInactiveError(clientsQuery.error)

  const createMutation = useMutation({
    mutationFn: clients.create,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      setName('')
      setError('')
      toast.success('Client added', `"${variables.name}" is ready to be assigned to a project.`)
    },
    onError: (err) =>
      unlessSubscriptionInactive(err, (e) => {
        const msg = e instanceof Error ? e.message : 'Failed'
        setError(msg)
        toast.error('Could not add client', msg)
      }),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setError('')
    createMutation.mutate({ name: name.trim() })
  }

  const list = clientsList as { id: string; name: string; _count?: { projects: number } }[]

  if (paywallBlocked) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Work" title="Clients" />
        <SubscriptionRenewalPanel />
      </div>
    )
  }

  if (isError && clientsListError) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Work" title="Clients" />
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 max-w-xl">
          <p className="font-medium text-red-900">Could not load clients</p>
          <p className="mt-1">
            {clientsListError instanceof Error ? clientsListError.message : 'Something went wrong.'}
          </p>
          <button
            type="button"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['clients'] })}
            className="mt-3 px-3 py-1.5 text-sm font-medium rounded-lg bg-white border border-red-300 text-red-900 hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Work"
        title="Clients"
        subtitle={
          <>
            {org?.name ? <p className="text-gray-700 font-medium">{org.name}</p> : null}
            <p>
              <strong className="text-gray-800">Clients</strong> are the entities you reconcile for. Team
              employees are managed under{' '}
              <Link to="/settings/members" className="font-medium text-primary-600 hover:underline">
                Administration → Members
              </Link>
              .
            </p>
            <p className="text-xs text-gray-500">
              Assign clients when creating a project.{' '}
              {!features.multi_client && (
                <span className="text-amber-700 font-medium">
                  Filtering the project list by client requires the Firm plan.
                </span>
              )}
            </p>
          </>
        }
      />

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-xl">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Client name"
          className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl bg-white text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 shadow-sm"
        />
        <button
          type="submit"
          disabled={createMutation.isPending || !name.trim()}
          className="px-4 py-2.5 font-medium text-sm rounded-xl bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 shadow-sm hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 transition-all"
        >
          {createMutation.isPending ? 'Adding...' : 'Add client'}
        </button>
      </form>
      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm max-w-xl border border-red-100">{error}</div>
      )}

      <Card noPadding className="overflow-hidden border-l-4 border-l-primary-500 shadow-sm">
        {isLoading ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">Loading clients…</div>
        ) : list.length === 0 ? (
          <div className="py-14 px-6">
            <EmptyState
              icon={<Building2 className="w-7 h-7" />}
              title="No clients yet"
              description="Add a client above, then attach them when you create a reconciliation project."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-surface border-b border-border">
                <tr>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Projects
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-muted bg-white">
                {list.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50/90 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{c.name}</td>
                    <td className="px-6 py-4 text-sm">
                      <Link
                        to={`/projects?clientId=${c.id}`}
                        className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-800 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-lg group/row"
                      >
                        {c._count?.projects ?? 0} project{(c._count?.projects ?? 0) === 1 ? '' : 's'}
                        <ChevronRight className="w-4 h-4 opacity-70 group-hover/row:translate-x-0.5 transition-transform" aria-hidden />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
