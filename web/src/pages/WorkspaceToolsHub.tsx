import { Link } from 'react-router-dom'
import { ArrowRight, FileSpreadsheet, Landmark } from 'lucide-react'
import Card from '../components/ui/Card'
import PageHeader from '../components/layout/PageHeader'

const TOOLS = [
  {
    to: '/tools/clean-bank-statement',
    label: 'Clean bank statement',
    hint: 'Upload PDF/Excel → preview, sample, or full cleaned export',
    icon: Landmark,
  },
  {
    to: '/tools/clean-cash-book',
    label: 'Clean cash book',
    hint: 'Upload cash book → preview, sample, or full cleaned export',
    icon: FileSpreadsheet,
  },
] as const

export default function WorkspaceToolsHub() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Work"
        title="Tools"
        subtitle={
          <p className="text-gray-500">
            Validate formats with the same parsers used in reconciliation. Preview is free; full exports use your
            plan&apos;s monthly clean-export quota.
          </p>
        }
      />

      <Card title="Clean & export" sublabel="Same tools as the sidebar and ⌘K palette — deep links preserved.">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl">
          {TOOLS.map(({ to, label, hint, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="flex items-start gap-3 rounded-xl border border-border shadow-card px-4 py-3 hover:shadow-card-hover hover:border-primary-300 hover:bg-primary-50/50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-600 shrink-0">
                <Icon className="w-4 h-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-sm font-medium text-gray-900">
                  {label}
                  <ArrowRight className="w-3.5 h-3.5 text-gray-400" aria-hidden />
                </span>
                <span className="block text-xs text-gray-500 mt-0.5">{hint}</span>
              </span>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  )
}
