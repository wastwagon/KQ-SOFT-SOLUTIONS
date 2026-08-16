import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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
  organization: { id: string; name: string }
}

export default function AdminPayments() {
  const [page, setPage] = useState(1)
  const [orgId, setOrgId] = useState('')

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

        <Table>
          <TableHead>
            <tr>
              <TableTh>Date</TableTh>
              <TableTh>Organization</TableTh>
              <TableTh>Plan</TableTh>
              <TableTh>Period</TableTh>
              <TableTh className="text-right">Amount</TableTh>
              <TableTh>Status</TableTh>
            </tr>
          </TableHead>
          <TableBody>
            {payments.length === 0 ? (
              <TableRow>
                <TableTd colSpan={6} className="text-center text-gray-500">
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
                      to={`/platform-admin/organizations/${pay.organization.id}`}
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
