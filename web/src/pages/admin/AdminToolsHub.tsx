import { Link } from 'react-router-dom'
import { ArrowRight, FileSpreadsheet, Landmark } from 'lucide-react'
import Card from '../../components/ui/Card'
import PageHeader from '../../components/layout/PageHeader'

const TOOLS = [
  {
    to: '/platform-admin/tools/clean-bank-statement',
    label: 'Clean bank statement',
    hint: 'Platform worker — preview / sample / full cleaned export',
    icon: Landmark,
  },
  {
    to: '/platform-admin/tools/clean-cash-book',
    label: 'Clean cash book',
    hint: 'Platform worker — preview / sample / full cleaned export',
    icon: FileSpreadsheet,
  },
] as const

export default function AdminToolsHub() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform admin"
        title="Tools"
        subtitle={
          <p className="text-gray-500">
            Same clean/export tools as in the app, routed under platform admin for support. Deep links
            unchanged.
          </p>
        }
      />

      <Card title="Document cleaners" sublabel="Also listed under Tools in the admin sidebar.">
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
