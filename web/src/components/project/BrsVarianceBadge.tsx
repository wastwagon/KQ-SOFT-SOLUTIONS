import { useQuery } from '@tanstack/react-query'
import { report } from '../../lib/api'
import { formatAmount } from '../../lib/format'
import { brsTieOutVariance, brsVarianceLabel } from '../../lib/brsVariance'

export default function BrsVarianceBadge({
  projectId,
  currency = 'GHS',
  compact = false,
}: {
  projectId: string
  currency?: string
  compact?: boolean
}) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['report', 'summary', projectId],
    queryFn: () => report.get(projectId, { summaryOnly: true }),
    staleTime: 120_000,
    enabled: !!projectId,
  })

  const resolvedCurrency = data?.currency || currency
  const variance = brsTieOutVariance(data)
  const label = brsVarianceLabel(variance)

  if (isLoading) {
    return <span className="text-xs text-gray-400">{compact ? '…' : 'Loading BRS…'}</span>
  }
  if (isError || variance == null || !label) {
    return <span className="text-xs text-gray-400">—</span>
  }
  if (label === 'Tied out') {
    return (
      <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-800 ring-1 ring-inset ring-green-600/15">
        Tied out
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${
        Math.abs(variance) < 0.01
          ? 'bg-green-50 text-green-800 ring-green-600/15'
          : variance > 0
            ? 'bg-amber-50 text-amber-900 ring-amber-600/15'
            : 'bg-red-50 text-red-800 ring-red-600/15'
      }`}
      title={`BRS variance: ${formatAmount(variance, resolvedCurrency)}`}
    >
      {label} {formatAmount(Math.abs(variance), resolvedCurrency)}
    </span>
  )
}
