import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Building2, ChevronRight } from 'lucide-react'
import { clients, subscription, isSubscriptionInactiveError, unlessSubscriptionInactive } from '../lib/api'
import { normalizeClientsPayload } from '../lib/clientsPayload'
import { useAuth } from '../store/auth'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Alert from '../components/ui/Alert'
import Modal from '../components/ui/Modal'
import { Table, TableHead, TableBody, TableRow, TableTh, TableTd } from '../components/ui/Table'
import { TableRowSkeleton } from '../components/ui/Skeleton'
import { useToast } from '../components/ui/Toast'
import SubscriptionRenewalPanel from '../components/SubscriptionRenewalPanel'
import PageHeader from '../components/layout/PageHeader'

export default function Clients() {
  const queryClient = useQueryClient()
  const toast = useToast()
  const org = useAuth((s) => s.org)
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [addOpen, setAddOpen] = useState(false)

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
  const { data: clientsRaw, isLoading, isError, error: clientsListError } = clientsQuery
  const { clients: list, unassignedProjectCount, totalProjectCount } = normalizeClientsPayload(clientsRaw)
  const paywallBlocked = isSubscriptionInactiveError(clientsQuery.error)

  const closeAdd = () => {
    setAddOpen(false)
    setName('')
    setError('')
  }

  const createMutation = useMutation({
    mutationFn: clients.create,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Client added', `"${variables.name}" is ready to be assigned to a project.`)
      closeAdd()
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
        <Alert
          tone="error"
          title="Could not load clients"
          onRetry={() => queryClient.invalidateQueries({ queryKey: ['clients'] })}
        >
          {clientsListError instanceof Error ? clientsListError.message : 'Something went wrong.'}
        </Alert>
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
            <p className="text-gray-500">
              Entities you reconcile for.
              {!features.multi_client && (
                <span> Filtering projects by client requires the Firm plan.</span>
              )}
            </p>
          </>
        }
        actions={
          <Button type="button" onClick={() => setAddOpen(true)}>
            Add client
          </Button>
        }
      />

      {unassignedProjectCount > 0 && (
        <Alert
          tone="warning"
          title={`${unassignedProjectCount} project${unassignedProjectCount === 1 ? '' : 's'} not assigned to a client`}
          className="max-w-2xl"
        >
          Those jobs still appear under{' '}
          <Link to="/projects" className="font-semibold underline hover:text-amber-950">
            Projects
          </Link>
          {totalProjectCount > 0 ? ` (${totalProjectCount} total)` : ''}. Assign a client when creating or
          editing a project.
        </Alert>
      )}

      <Card noPadding>
        {isLoading ? (
          <Table>
            <TableHead>
              <tr>
                <TableTh>Client</TableTh>
                <TableTh>Assigned projects</TableTh>
              </tr>
            </TableHead>
            <TableBody>
              {[1, 2, 3, 4].map((i) => (
                <TableRowSkeleton key={i} cols={2} />
              ))}
            </TableBody>
          </Table>
        ) : list.length === 0 ? (
          <div className="py-14 px-6">
            <EmptyState
              icon={<Building2 className="w-7 h-7" />}
              title="No clients yet"
              description="Add a client, then attach them when you create a reconciliation project."
              action={
                <Button type="button" onClick={() => setAddOpen(true)}>
                  Add client
                </Button>
              }
            />
          </div>
        ) : (
          <Table>
            <TableHead>
              <tr>
                <TableTh>Client</TableTh>
                <TableTh>Assigned projects</TableTh>
              </tr>
            </TableHead>
            <TableBody>
              {list.map((c) => (
                <TableRow key={c.id}>
                  <TableTd className="font-medium text-gray-900">{c.name}</TableTd>
                  <TableTd>
                    <Link
                      to={`/projects?clientId=${c.id}`}
                      className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-800 font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded-lg group/row"
                    >
                      {c._count?.projects ?? 0} project{(c._count?.projects ?? 0) === 1 ? '' : 's'}
                      <ChevronRight
                        className="w-4 h-4 opacity-70 group-hover/row:translate-x-0.5 transition-transform"
                        aria-hidden
                      />
                    </Link>
                  </TableTd>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Modal
        open={addOpen}
        title="Add client"
        onClose={closeAdd}
        footer={
          <>
            <Button type="button" variant="outline" onClick={closeAdd}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="add-client-form"
              disabled={createMutation.isPending || !name.trim()}
              isLoading={createMutation.isPending}
            >
              Add client
            </Button>
          </>
        }
      >
        <form id="add-client-form" onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <Alert tone="error" title="Could not add client">
              {error}
            </Alert>
          )}
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ghana Cocoa Board"
            label="Client name"
            autoFocus
          />
        </form>
      </Modal>
    </div>
  )
}
