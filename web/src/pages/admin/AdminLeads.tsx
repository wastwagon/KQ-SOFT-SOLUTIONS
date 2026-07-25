import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Inbox, Mail } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import PageHeader from '../../components/layout/PageHeader'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/format'
import { useToast } from '../../components/ui/Toast'

type Lead = {
  id: string
  email: string
  name: string | null
  company: string | null
  source: string
  message: string | null
  createdAt: string
  contactedAt: string | null
}

export default function AdminLeads() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'leads'],
    queryFn: () => api('/admin/leads?limit=200') as Promise<{ leads: Lead[] }>,
  })

  const markMutation = useMutation({
    mutationFn: ({ id, contacted }: { id: string; contacted: boolean }) =>
      api(`/admin/leads/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ contacted }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'leads'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] })
    },
    onError: (err) => {
      toast.error('Update failed', err instanceof Error ? err.message : undefined)
    },
  })

  const leads = data?.leads ?? []

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform admin"
        title="Leads"
        subtitle={
          <p className="text-gray-500">
            Newsletter, bank-feed waitlist, and sales enquiries from the public site.
          </p>
        }
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            Refresh
          </Button>
        }
      />

      {isLoading && (
        <Card>
          <p className="text-sm text-gray-500">Loading leads…</p>
        </Card>
      )}

      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 max-w-xl">
          {error instanceof Error ? error.message : 'Could not load leads.'}
        </div>
      )}

      {!isLoading && !isError && leads.length === 0 && (
        <Card>
          <div className="flex items-start gap-3">
            <Inbox className="w-5 h-5 text-gray-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">No leads yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Subscriptions from the landing page and bank-feed waitlist will appear here.
              </p>
            </div>
          </div>
        </Card>
      )}

      {leads.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-gray-100">
                  <th className="py-2 pr-3 font-semibold">When</th>
                  <th className="py-2 pr-3 font-semibold">Source</th>
                  <th className="py-2 pr-3 font-semibold">Email</th>
                  <th className="py-2 pr-3 font-semibold">Details</th>
                  <th className="py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-gray-50 align-top">
                    <td className="py-3 pr-3 text-gray-600 whitespace-nowrap">
                      {formatDate(lead.createdAt)}
                    </td>
                    <td className="py-3 pr-3">
                      <span className="inline-flex px-2 py-0.5 rounded-md bg-gray-100 text-xs font-medium text-gray-700">
                        {lead.source}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <a
                        href={`mailto:${lead.email}`}
                        className="inline-flex items-center gap-1.5 text-primary-600 hover:text-primary-700 font-medium"
                      >
                        <Mail className="w-3.5 h-3.5" />
                        {lead.email}
                      </a>
                      {(lead.name || lead.company) && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {[lead.name, lead.company].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-gray-600 max-w-xs">
                      {lead.message || '—'}
                    </td>
                    <td className="py-3">
                      {lead.contactedAt ? (
                        <button
                          type="button"
                          className="text-xs font-medium text-green-700 hover:underline"
                          onClick={() => markMutation.mutate({ id: lead.id, contacted: false })}
                        >
                          Contacted · undo
                        </button>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => markMutation.mutate({ id: lead.id, contacted: true })}
                          disabled={markMutation.isPending}
                        >
                          Mark contacted
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
