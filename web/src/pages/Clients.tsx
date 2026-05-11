import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { clients, subscription, isSubscriptionInactiveError, unlessSubscriptionInactive } from '../lib/api'
import { useToast } from '../components/ui/Toast'
import SubscriptionRenewalPanel from '../components/SubscriptionRenewalPanel'

export default function Clients() {
  const queryClient = useQueryClient()
  const toast = useToast()
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
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Clients</h1>
        <SubscriptionRenewalPanel />
      </div>
    )
  }

  if (isError && clientsListError) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Clients</h1>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 max-w-xl">
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
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">Clients</h1>
      <p className="text-sm text-gray-600 max-w-2xl">
        <strong>Clients</strong> are the external entities or customer accounts you are reconciling for. 
        To add team members (your employees) to your firm, go to <Link to="/settings/members" className="text-primary-600 font-medium hover:underline">Administration &gt; Members</Link>.
      </p>
      <p className="text-xs text-gray-500 max-w-2xl">
        Add clients here and assign them when creating a project. {!features.multi_client && (
          <span className="text-amber-600 font-medium">Filter projects by client (multi-client view) requires Firm plan.</span>
        )}
      </p>

      <form onSubmit={handleSubmit} className="flex gap-3 max-w-md">
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
      {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm max-w-md">{error}</div>}

      <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200 border-l-4 border-l-primary-500">
        {isLoading ? (
          <div className="px-6 py-12 text-center text-sm text-gray-500">Loading...</div>
        ) : list.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="text-lg font-semibold tracking-tight text-gray-900">No clients yet</p>
            <p className="mt-2 text-sm text-gray-600">Add your first client above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="bg-surface border-b border-border">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Projects</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-muted bg-white">
              {list.map((c) => (
                <tr key={c.id} className="hover:bg-surface/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{c.name}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <Link to={`/projects?clientId=${c.id}`} className="text-primary-600 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded">
                      {c._count?.projects ?? 0} project(s)
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  )
}
