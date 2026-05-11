import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Database, RefreshCw, Server } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { platformAdminDatabase, type PlatformDatabaseOpResult } from '../../lib/api'
import PageHeader from '../../components/layout/PageHeader'

function OutputBlock({ title, result }: { title: string; result: PlatformDatabaseOpResult | null }) {
  if (!result) return null
  const combined = [result.stdout, result.stderr].filter(Boolean).join('\n') || '(no output)'
  return (
    <div>
      <p className="text-sm font-medium text-gray-800 mb-1">
        {title}
        <span
          className={`ml-2 text-xs font-semibold ${result.success ? 'text-green-600' : 'text-red-600'}`}
        >
          {result.success ? 'OK' : 'Failed'}
        </span>
        <span className="ml-2 text-xs text-gray-500">exit {result.exitCode}</span>
      </p>
      <pre className="text-xs font-mono bg-slate-900 text-slate-100 rounded-lg p-4 max-h-80 overflow-auto whitespace-pre-wrap break-words">
        {combined}
      </pre>
    </div>
  )
}

export default function AdminDatabase() {
  const [migrateResult, setMigrateResult] = useState<PlatformDatabaseOpResult | null>(null)
  const [seedResult, setSeedResult] = useState<PlatformDatabaseOpResult | null>(null)

  const statusQuery = useQuery({
    queryKey: ['admin', 'database', 'status'],
    queryFn: platformAdminDatabase.status,
  })

  const migrateMutation = useMutation({
    mutationFn: platformAdminDatabase.migrate,
    onSuccess: (data) => setMigrateResult(data),
  })

  const seedMutation = useMutation({
    mutationFn: platformAdminDatabase.seed,
    onSuccess: (data) => setSeedResult(data),
  })

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform admin"
        title="Database"
        subtitle={
          <p className="text-gray-500 max-w-3xl">
            Run Prisma against the server&apos;s{' '}
            <code className="px-1 py-0.5 bg-gray-100 rounded text-xs font-mono text-gray-800">DATABASE_URL</code>. Use
            this if startup migrations did not apply (Coolify) or to load seed data after deploy.
          </p>
        }
        actions={
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-600 border border-primary-100 shadow-sm" aria-hidden>
            <Server className="w-5 h-5" />
          </span>
        }
      />

      <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/80 text-sm text-amber-900 shadow-sm max-w-4xl">
        <strong>Security:</strong> only platform admins can call these. Seed creates test users and a shared test password
        (see <code className="text-xs">api/prisma/seed.ts</code>); avoid running seed on a production instance with real customers unless you intend to.
      </div>

      <div className="space-y-6 max-w-4xl">
        <Card className="rounded-xl border-l-4 border-l-primary-500">
          <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <Database className="w-5 h-5" aria-hidden />
            Migration status
          </h2>
          <p className="text-sm text-gray-600 mb-4">Read-only. Does not change the database.</p>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => { void statusQuery.refetch() }}
              disabled={statusQuery.isFetching}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${statusQuery.isFetching ? 'animate-spin' : ''}`} />
              {statusQuery.isFetching ? 'Refreshing...' : 'Refresh status'}
            </Button>
          </div>
          {statusQuery.isError && (
            <p className="text-sm text-red-600 mb-2">{(statusQuery.error as Error).message}</p>
          )}
          <OutputBlock title="prisma migrate status" result={statusQuery.data ?? null} />
        </Card>

        <Card className="rounded-xl border-l-4 border-l-slate-500">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Apply migrations</h2>
          <p className="text-sm text-gray-600 mb-4">Runs <code className="text-xs">prisma migrate deploy</code> (same as API startup script).</p>
          <Button
            type="button"
            onClick={() => {
              setMigrateResult(null)
              migrateMutation.mutate()
            }}
            disabled={migrateMutation.isPending}
            className="mb-4"
          >
            {migrateMutation.isPending ? 'Running...' : 'Run migrate deploy'}
          </Button>
          <OutputBlock title="Output" result={migrateResult} />
        </Card>

        <Card className="rounded-xl border-l-4 border-l-amber-600">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Seed database</h2>
          <p className="text-sm text-gray-600 mb-4">Runs <code className="text-xs">prisma db seed</code> (plans, optional test orgs/users).</p>
          <Button
            type="button"
            onClick={() => {
              setSeedResult(null)
              seedMutation.mutate()
            }}
            disabled={seedMutation.isPending}
            className="mb-4 bg-amber-600 hover:bg-amber-700 text-white"
          >
            {seedMutation.isPending ? 'Running...' : 'Run seed'}
          </Button>
          <OutputBlock title="Output" result={seedResult} />
        </Card>
      </div>
    </div>
  )
}
