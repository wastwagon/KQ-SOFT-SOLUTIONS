import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Database, RefreshCw, Server, Wrench } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { platformAdminDatabase, type PlatformDatabaseOpResult } from '../../lib/api'
import PageHeader from '../../components/layout/PageHeader'
import { useConfirm } from '../../components/ui/ConfirmDialog'

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
  const confirm = useConfirm()
  const queryClient = useQueryClient()

  const [migrateResult, setMigrateResult] = useState<PlatformDatabaseOpResult | null>(null)
  const [recoveryResult, setRecoveryResult] = useState<PlatformDatabaseOpResult | null>(null)
  const [seedPlansResult, setSeedPlansResult] = useState<PlatformDatabaseOpResult | null>(null)
  const [seedResult, setSeedResult] = useState<PlatformDatabaseOpResult | null>(null)
  const [resolveMigration, setResolveMigration] = useState('')
  const [resolveAction, setResolveAction] = useState<'rolled-back' | 'applied'>('rolled-back')

  const statusQuery = useQuery({
    queryKey: ['admin', 'database', 'status'],
    queryFn: platformAdminDatabase.status,
  })

  const migrationsQuery = useQuery({
    queryKey: ['admin', 'database', 'migrations'],
    queryFn: platformAdminDatabase.migrations,
  })

  const migrateMutation = useMutation({
    mutationFn: platformAdminDatabase.migrate,
    onSuccess: (data) => {
      setMigrateResult(data)
      void statusQuery.refetch()
    },
  })

  const dbPushMutation = useMutation({
    mutationFn: platformAdminDatabase.dbPush,
    onSuccess: (data) => {
      setRecoveryResult(data)
      void statusQuery.refetch()
    },
  })

  const migrateResolveMutation = useMutation({
    mutationFn: platformAdminDatabase.migrateResolve,
    onSuccess: (data) => {
      setRecoveryResult(data)
      void statusQuery.refetch()
    },
  })

  const seedPlansMutation = useMutation({
    mutationFn: platformAdminDatabase.seedPlans,
    onSuccess: (data) => setSeedPlansResult(data),
  })

  const seedMutation = useMutation({
    mutationFn: platformAdminDatabase.seed,
    onSuccess: (data) => setSeedResult(data),
  })

  const migrationOptions = migrationsQuery.data?.migrations ?? []

  const handleDbPush = async () => {
    const ok = await confirm({
      title: 'Run prisma db push?',
      description:
        'Syncs the database schema from prisma/schema.prisma without running migration SQL files. Use on empty or broken dev/staging DBs — not a substitute for migrate deploy on production with data.',
      confirmLabel: 'Run db push',
      tone: 'warning',
    })
    if (!ok) return
    setRecoveryResult(null)
    dbPushMutation.mutate()
  }

  const handleMigrateResolve = async () => {
    if (!resolveMigration) return
    const actionLabel = resolveAction === 'rolled-back' ? 'rolled back' : 'applied'
    const ok = await confirm({
      title: `Mark migration as ${actionLabel}?`,
      description: `Runs prisma migrate resolve --${resolveAction} ${resolveMigration}. Use rolled-back for P3009 failed migrations, then run migrate deploy again.`,
      confirmLabel: 'Run migrate resolve',
      tone: 'warning',
    })
    if (!ok) return
    setRecoveryResult(null)
    migrateResolveMutation.mutate({ migrationName: resolveMigration, action: resolveAction })
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Platform admin"
        title="Database"
        subtitle={
          <p className="text-gray-500 max-w-3xl">
            Run Prisma against the server&apos;s{' '}
            <code className="px-1 py-0.5 bg-gray-100 rounded text-xs font-mono text-gray-800">DATABASE_URL</code>. Use
            this when Coolify startup migrations fail, or to seed plans/users after deploy.
          </p>
        }
        actions={
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-600 border border-primary-100 shadow-sm" aria-hidden>
            <Server className="w-5 h-5" />
          </span>
        }
      />

      <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/80 text-sm text-amber-900 shadow-sm max-w-4xl">
        <strong>Recommended order after a failed deploy:</strong>{' '}
        1) Refresh migration status → 2) Migrate resolve (if P3009) → 3) Run migrate deploy → 4) Seed plans (safe) →
        5) Full seed only on staging/demo.
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
              onClick={() => {
                void statusQuery.refetch()
                void queryClient.invalidateQueries({ queryKey: ['admin', 'database', 'migrations'] })
              }}
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
          <p className="text-sm text-gray-600 mb-4">
            Runs <code className="text-xs">prisma migrate deploy</code> (same as API startup script).
          </p>
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

        <Card className="rounded-xl border-l-4 border-l-orange-500">
          <h2 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <Wrench className="w-5 h-5" aria-hidden />
            Recovery tools
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Same helpers as <code className="text-xs">start-api.sh</code> when automatic recovery did not run.
          </p>

          <div className="space-y-4 mb-4">
            <div>
              <p className="text-sm font-medium text-gray-800 mb-2">Db push (schema sync)</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => { void handleDbPush() }}
                disabled={dbPushMutation.isPending}
              >
                {dbPushMutation.isPending ? 'Running...' : 'Run db push'}
              </Button>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-800 mb-2">Migrate resolve (P3009)</p>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label htmlFor="resolve-migration" className="block text-xs text-gray-600 mb-1">
                    Migration
                  </label>
                  <select
                    id="resolve-migration"
                    value={resolveMigration}
                    onChange={(e) => setResolveMigration(e.target.value)}
                    className="min-w-[280px] px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                  >
                    <option value="">Select migration…</option>
                    {migrationOptions.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="resolve-action" className="block text-xs text-gray-600 mb-1">
                    Action
                  </label>
                  <select
                    id="resolve-action"
                    value={resolveAction}
                    onChange={(e) => setResolveAction(e.target.value as 'rolled-back' | 'applied')}
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                  >
                    <option value="rolled-back">rolled-back (retry deploy)</option>
                    <option value="applied">applied (mark done)</option>
                  </select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { void handleMigrateResolve() }}
                  disabled={!resolveMigration || migrateResolveMutation.isPending}
                >
                  {migrateResolveMutation.isPending ? 'Running...' : 'Run migrate resolve'}
                </Button>
              </div>
            </div>
          </div>

          <OutputBlock title="Recovery output" result={recoveryResult} />
        </Card>

        <Card className="rounded-xl border-l-4 border-l-emerald-600">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Seed subscription plans</h2>
          <p className="text-sm text-gray-600 mb-4">
            Runs <code className="text-xs">prisma/seed-plans.ts</code> (idempotent — same as startup). Safe to re-run;
            does not create demo users.
          </p>
          <Button
            type="button"
            onClick={() => {
              setSeedPlansResult(null)
              seedPlansMutation.mutate()
            }}
            disabled={seedPlansMutation.isPending}
            className="mb-4"
          >
            {seedPlansMutation.isPending ? 'Running...' : 'Run seed plans'}
          </Button>
          <OutputBlock title="Output" result={seedPlansResult} />
        </Card>

        <Card className="rounded-xl border-l-4 border-l-amber-600">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Full seed (plans + demo users)</h2>
          <p className="text-sm text-gray-600 mb-4">
            Runs <code className="text-xs">prisma db seed</code> — creates test orgs/users (
            <code className="text-xs">premium@test.com</code> / Test123!). Staging and demo only.
          </p>
          <Button
            type="button"
            onClick={() => {
              setSeedResult(null)
              seedMutation.mutate()
            }}
            disabled={seedMutation.isPending}
            className="mb-4 bg-amber-600 hover:bg-amber-700 text-white"
          >
            {seedMutation.isPending ? 'Running...' : 'Run full seed'}
          </Button>
          <OutputBlock title="Output" result={seedResult} />
        </Card>
      </div>
    </div>
  )
}
