import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Server } from 'lucide-react'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'
import Badge from '../../components/ui/Badge'
import Select from '../../components/ui/Select'
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
        <Badge tone={result.success ? 'success' : 'danger'} size="sm" className="ml-2">
          {result.success ? 'OK' : 'Failed'}
        </Badge>
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

      <Alert tone="warning" title="Recommended order after a failed deploy" className="max-w-4xl">
        1) Refresh migration status → 2) Migrate resolve (if P3009) → 3) Run migrate deploy → 4) Seed
        plans (safe) → 5) Full seed only on staging/demo.
      </Alert>

      <div className="space-y-6 max-w-4xl">
        <Card
          title="Migration status"
          sublabel="Read-only. Does not change the database."
        >
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
              Refresh status
            </Button>
          </div>
          {statusQuery.isError && (
            <Alert
              tone="error"
              title="Could not load migration status"
              className="mb-2"
              onRetry={() => void statusQuery.refetch()}
            >
              {(statusQuery.error as Error).message}
            </Alert>
          )}
          <OutputBlock title="prisma migrate status" result={statusQuery.data ?? null} />
        </Card>

        <Card
          title="Apply migrations"
          sublabel={
            <>
              Runs <code className="text-xs">prisma migrate deploy</code> (same as API startup script).
            </>
          }
        >
          <Button
            type="button"
            onClick={() => {
              setMigrateResult(null)
              migrateMutation.mutate()
            }}
            disabled={migrateMutation.isPending}
            isLoading={migrateMutation.isPending}
            className="mb-4"
          >
            Run migrate deploy
          </Button>
          <OutputBlock title="Output" result={migrateResult} />
        </Card>

        <Card
          title="Recovery tools"
          sublabel={
            <>
              Same helpers as <code className="text-xs">start-api.sh</code> when automatic recovery did not run.
            </>
          }
        >

          <div className="space-y-4 mb-4">
            <div>
              <p className="text-sm font-medium text-gray-800 mb-2">Db push (schema sync)</p>
              <Button
                type="button"
                variant="outline"
                onClick={() => { void handleDbPush() }}
                disabled={dbPushMutation.isPending}
                isLoading={dbPushMutation.isPending}
              >
                Run db push
              </Button>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-800 mb-2">Migrate resolve (P3009)</p>
              {migrationsQuery.isError && (
                <Alert
                  tone="error"
                  title="Could not load migrations"
                  className="mb-2"
                  onRetry={() => void migrationsQuery.refetch()}
                >
                  {migrationsQuery.error instanceof Error
                    ? migrationsQuery.error.message
                    : 'Something went wrong.'}
                </Alert>
              )}
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[280px] flex-1">
                  <Select
                    id="resolve-migration"
                    label="Migration"
                    value={resolveMigration}
                    onChange={(e) => setResolveMigration(e.target.value)}
                  >
                    <option value="">Select migration…</option>
                    {migrationOptions.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="w-56 shrink-0">
                  <Select
                    id="resolve-action"
                    label="Action"
                    value={resolveAction}
                    onChange={(e) => setResolveAction(e.target.value as 'rolled-back' | 'applied')}
                  >
                    <option value="rolled-back">rolled-back (retry deploy)</option>
                    <option value="applied">applied (mark done)</option>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { void handleMigrateResolve() }}
                  disabled={!resolveMigration}
                  isLoading={migrateResolveMutation.isPending}
                >
                  Run migrate resolve
                </Button>
              </div>
            </div>
          </div>

          <OutputBlock title="Recovery output" result={recoveryResult} />
        </Card>

        <Card
          title="Seed subscription plans"
          sublabel={
            <>
              Runs <code className="text-xs">prisma/seed-plans.ts</code> (idempotent — same as startup). Safe to
              re-run; does not create demo users.
            </>
          }
        >
          <Button
            type="button"
            onClick={() => {
              setSeedPlansResult(null)
              seedPlansMutation.mutate()
            }}
            disabled={seedPlansMutation.isPending}
            isLoading={seedPlansMutation.isPending}
            className="mb-4"
          >
            Run seed plans
          </Button>
          <OutputBlock title="Output" result={seedPlansResult} />
        </Card>

        <Card
          title="Full seed (plans + demo users)"
          sublabel={
            <>
              Runs <code className="text-xs">prisma db seed</code>.
            </>
          }
        >
          <Alert tone="warning" title="Staging and demo only" className="mb-4">
            Creates test orgs/users (<code className="text-xs">premium@test.com</code> / Test123!). Do not run
            on production with real tenants.
          </Alert>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              setSeedResult(null)
              seedMutation.mutate()
            }}
            disabled={seedMutation.isPending}
            isLoading={seedMutation.isPending}
            className="mb-4"
          >
            Run full seed
          </Button>
          <OutputBlock title="Output" result={seedResult} />
        </Card>
      </div>
    </div>
  )
}
