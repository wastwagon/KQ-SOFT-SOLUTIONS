import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Inbox, Mail } from 'lucide-react'
import Card from '../../components/ui/Card'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { Table, TableHead, TableBody, TableRow, TableTh, TableTd } from '../../components/ui/Table'
import PageHeader from '../../components/layout/PageHeader'
import EmptyState from '../../components/ui/EmptyState'
import { PageBodySkeleton } from '../../components/ui/Skeleton'
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

      {isLoading && <PageBodySkeleton label="Loading leads" />}

      {isError && (
        <Alert
          tone="error"
          title="Could not load leads"
          onRetry={() => void refetch()}
        >
          {error instanceof Error ? error.message : 'Something went wrong.'}
        </Alert>
      )}

      {!isLoading && !isError && leads.length === 0 && (
        <Card>
          <EmptyState
            icon={<Inbox className="w-6 h-6" />}
            title="No leads yet"
            description="Subscriptions from the landing page and bank-feed waitlist will appear here."
          />
        </Card>
      )}

      {leads.length > 0 && (
        <Card noPadding>
          <Table>
            <TableHead>
              <tr>
                <TableTh>When</TableTh>
                <TableTh>Source</TableTh>
                <TableTh>Email</TableTh>
                <TableTh>Details</TableTh>
                <TableTh>Status</TableTh>
              </tr>
            </TableHead>
            <TableBody>
              {leads.map((lead) => (
                <TableRow key={lead.id} className="align-top">
                  <TableTd className="whitespace-nowrap">
                    {formatDate(lead.createdAt)}
                  </TableTd>
                  <TableTd>
                    <Badge tone="neutral" size="sm">
                      {lead.source}
                    </Badge>
                  </TableTd>
                  <TableTd>
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
                  </TableTd>
                  <TableTd className="max-w-xs">
                    {lead.message || '—'}
                  </TableTd>
                  <TableTd>
                    {lead.contactedAt ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="text-green-700"
                        onClick={() => markMutation.mutate({ id: lead.id, contacted: false })}
                        isLoading={
                          markMutation.isPending &&
                          markMutation.variables?.id === lead.id &&
                          markMutation.variables?.contacted === false
                        }
                      >
                        Contacted · undo
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="xs"
                        variant="secondary"
                        onClick={() => markMutation.mutate({ id: lead.id, contacted: true })}
                        isLoading={
                          markMutation.isPending &&
                          markMutation.variables?.id === lead.id &&
                          markMutation.variables?.contacted === true
                        }
                      >
                        Mark contacted
                      </Button>
                    )}
                  </TableTd>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
