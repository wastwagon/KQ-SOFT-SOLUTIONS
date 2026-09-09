import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { api } from '../../lib/api'
import { formatDate } from '../../lib/format'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import PageHeader from '../../components/layout/PageHeader'
import Alert from '../../components/ui/Alert'
import Badge from '../../components/ui/Badge'
import { Table, TableHead, TableBody, TableRow, TableTh, TableTd } from '../../components/ui/Table'
import { PageBodySkeleton } from '../../components/ui/Skeleton'
import { useToast } from '../../components/ui/Toast'

type Payment = {
  id: string
  organizationId: string
  amount: number
  currency: string
  plan: string
  period: string
  reference: string | null
  status: string
  createdAt: string
  organization: { id: string; name: string; slug?: string }
}

export default function AdminPayments() {
  const [page, setPage] = useState(1)
  const [orgId, setOrgId] = useState('')
  const [verifyReference, setVerifyReference] = useState('')
  const toast = useToast()
  const queryClient = useQueryClient()

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'payments', page, orgId],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (orgId.trim()) params.set('orgId', orgId.trim())
      return api(`/admin/payments?${params}`) as Promise<{
        payments: Payment[]
        pagination: { page: number; limit: number; total: number; totalPages: number }
      }>
    },
  })

  const verifyMutation = useMutation({
    mutationFn: (reference: string) =>
      api('/admin/payments/verify', {
        method: 'POST',
        body: JSON.stringify({ reference }),
      }) as Promise<{
        status: string
        reference: string
        plan?: string
        orgId?: string
        alreadyApplied?: boolean
        message?: string
      }>,
    onSuccess: (result) => {
      if (result.status === 'success') {
        toast.success(
          result.alreadyApplied ? 'Already applied' : 'Payment applied',
          result.plan ? `Organisation plan is now ${result.plan}.` : 'Subscription updated from Paystack.'
        )
        setVerifyReference('')
        void queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] })
        void queryClient.invalidateQueries({ queryKey: ['admin', 'subscribers'] })
      } else {
        toast.error('Not confirmed', result.message || 'Paystack has not marked this charge as successful.')
      }
    },
    onError: (err) => {
      toast.error('Could not confirm payment', err instanceof Error ? err.message : undefined)
    },
  })

  const fmt = (n: number, currency = 'GHS') =>
    new Intl.NumberFormat('en-GH', { style: 'currency', currency, minimumFractionDigits: 2 }).format(n)

  if (isError) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Platform admin"
          title="Payments"
          subtitle={<p className="text-gray-500">All subscription payments across the platform.</p>}
        />
        <Alert tone="error" title="Could not load payments" onRetry={() => void refetch()}>
          {error instanceof Error ? error.message : 'Something went wrong.'}
        </Alert>
      </div>
    )
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Platform admin"
          title="Payments"
          subtitle={<p className="text-gray-500">All subscription payments across the platform.</p>}
        />
        <PageBodySkeleton label="Loading payments" />
      </div>
    )
  }

  const { payments, pagination } = data
  const { page: p, totalPages, total } = pagination

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform admin"
        title="Payments"
        subtitle={<p className="text-gray-500">All subscription payments across the platform.</p>}
      />

      <Card>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="w-64">
            <Input
              type="text"
              placeholder="Filter by org ID"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setPage(1)}
              aria-label="Filter by org ID"
            />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setPage(1)}>
            Apply
          </Button>
        </div>
        <form
          className="flex flex-wrap items-end gap-3 mb-4"
          onSubmit={(e) => {
            e.preventDefault()
            const reference = verifyReference.trim()
            if (!reference) return
            verifyMutation.mutate(reference)
          }}
        >
          <div className="w-80 max-w-full">
            <Input
              type="text"
              placeholder="Paystack reference (e.g. brs_…)"
              value={verifyReference}
              onChange={(e) => setVerifyReference(e.target.value)}
              aria-label="Paystack reference to confirm"
            />
          </div>
          <Button type="submit" size="sm" isLoading={verifyMutation.isPending}>
            Confirm from Paystack
          </Button>
        </form>
        <p className="text-xs text-gray-500 mb-4">
          If a customer paid on Paystack but the workspace plan did not update, paste the transaction reference here
          to verify the charge and apply the plan.
        </p>

        <Table>
          <TableHead>
            <tr>
              <TableTh>Date</TableTh>
              <TableTh>Organization</TableTh>
              <TableTh>Plan</TableTh>
              <TableTh>Period</TableTh>
              <TableTh className="text-right">Amount</TableTh>
              <TableTh>Status</TableTh>
              <TableTh>Reference</TableTh>
            </tr>
          </TableHead>
          <TableBody>
            {payments.length === 0 ? (
              <TableRow>
                <TableTd className="text-center text-gray-500" colSpan={7}>
                  No payments found.
                </TableTd>
              </TableRow>
            ) : (
              payments.map((pay) => (
                <TableRow key={pay.id}>
                  <TableTd className="whitespace-nowrap">
                    {formatDate(pay.createdAt, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </TableTd>
                  <TableTd>
                    <Link
                      to={`/platform-admin/organizations/${pay.organization.slug || pay.organization.id}`}
                      className="text-primary-600 hover:underline"
                    >
                      {pay.organization.name}
                    </Link>
                  </TableTd>
                  <TableTd className="capitalize">{pay.plan}</TableTd>
                  <TableTd className="capitalize">{pay.period}</TableTd>
                  <TableTd className="text-right font-medium text-gray-900">
                    {fmt(Number(pay.amount), pay.currency)}
                  </TableTd>
                  <TableTd>
                    <Badge
                      tone={
                        pay.status === 'success'
                          ? 'success'
                          : pay.status === 'failed'
                            ? 'danger'
                            : 'neutral'
                      }
                      size="sm"
                      className="capitalize"
                    >
                      {pay.status}
                    </Badge>
                  </TableTd>
                  <TableTd className="font-mono text-xs text-gray-500 max-w-[12rem] truncate" title={pay.reference || ''}>
                    {pay.reference || '—'}
                  </TableTd>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
            <p className="text-sm text-gray-500">
              Page {p} of {totalPages} • {total} total
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={p <= 1}
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={p >= totalPages}
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
