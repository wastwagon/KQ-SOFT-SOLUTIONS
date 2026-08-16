import { useEffect, useMemo, useState } from 'react'
import { Globe2, Loader2 } from 'lucide-react'
import { formatGhs, planAmountForPeriod, type BillingPeriod, type MarketingPlan } from '../../lib/plans'
import Select from '../ui/Select'
import { Table, TableHead, TableBody, TableRow, TableTh, TableTd } from '../ui/Table'

type FxCode = 'USD' | 'EUR' | 'GBP'

/** Used only when the public FX endpoint is unreachable (CORS/offline). */
const FALLBACK_PER_GHS: Record<FxCode, number> = {
  USD: 0.064,
  EUR: 0.059,
  GBP: 0.051,
}

function formatForeign(amount: number, code: FxCode): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
      maximumFractionDigits: amount >= 100 ? 0 : 2,
    }).format(amount)
  } catch {
    return `${code} ${amount.toFixed(2)}`
  }
}

/**
 * Indicative subscription prices in USD/EUR/GBP for international visitors.
 * Checkout stays in GHS (Paystack); workspace BRS currency is chosen per project in-app.
 */
export default function SubscriptionFxReference({
  plans,
  billingPeriod,
}: {
  plans: MarketingPlan[]
  billingPeriod: BillingPeriod
}) {
  const [code, setCode] = useState<FxCode>('USD')
  const [rates, setRates] = useState<Record<string, number> | null>(null)
  const [live, setLive] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch('https://open.er-api.com/v6/latest/GHS')
        if (!res.ok) throw new Error('bad status')
        const data = (await res.json()) as { result?: string; conversion_rates?: Record<string, number> }
        if (cancelled) return
        if (data.result === 'success' && data.conversion_rates && typeof data.conversion_rates.USD === 'number') {
          setRates(data.conversion_rates)
          setLive(true)
        } else {
          setRates(null)
          setLive(false)
        }
      } catch {
        if (!cancelled) {
          setRates(null)
          setLive(false)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const unitPerGhs = useMemo(() => {
    const r = rates?.[code]
    if (typeof r === 'number' && r > 0) return r
    return FALLBACK_PER_GHS[code]
  }, [rates, code])

  const rows = useMemo(() => {
    return plans
      .filter((p) => p.monthlyGhs > 0)
      .map((p) => {
        const ghs = planAmountForPeriod(p, billingPeriod)
        const foreign = ghs * unitPerGhs
        return { slug: p.slug, name: p.name, ghs, foreign }
      })
  }, [plans, billingPeriod, unitPerGhs])

  return (
    <div className="mt-10 rounded-xl border border-gray-200/80 bg-white/90 backdrop-blur-sm p-5 sm:p-6 shadow-sm ring-1 ring-gray-100">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700 ring-1 ring-primary-100">
            <Globe2 className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h3 className="text-sm font-bold text-gray-900">Reference pricing ({code})</h3>
            <p className="mt-1 text-xs text-gray-600 leading-relaxed max-w-xl">
              Subscriptions are charged in <strong>GHS</strong> through Paystack. Amounts below help you compare in
              your currency — they are <strong>indicative only</strong> and do not change what you pay. Inside the app,
              each project&apos;s BRS can use <strong>GHS, USD, or EUR</strong> independently.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-28">
            <Select
              id="fx-currency"
              value={code}
              onChange={(e) => setCode(e.target.value as FxCode)}
              aria-label="Reference currency"
            >
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </Select>
          </div>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" aria-label="Loading rates" />}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
        <Table>
          <TableHead>
            <tr>
              <TableTh>Plan</TableTh>
              <TableTh className="tabular-nums">Billed (GHS)</TableTh>
              <TableTh className="tabular-nums">≈ {code}</TableTh>
            </tr>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.slug}>
                <TableTd className="font-medium text-gray-900">{row.name}</TableTd>
                <TableTd className="tabular-nums">{formatGhs(row.ghs)}</TableTd>
                <TableTd className="tabular-nums font-semibold text-gray-900">
                  {formatForeign(row.foreign, code)}
                </TableTd>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="mt-3 text-[11px] text-gray-500 leading-relaxed">
        {live
          ? 'Live mid-market rates (1 GHS cross-rate). Not financial advice; card/bank fees may differ.'
          : 'Showing approximate rates — live feed unavailable. Refresh to retry.'}
      </p>
    </div>
  )
}
