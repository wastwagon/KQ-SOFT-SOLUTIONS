/**
 * Platform admin only: run Prisma migrate / seed against DATABASE_URL.
 * Use when container startup migration failed or you need to apply seed (plans, test users) on server.
 */
import { Router, type Request, type Response } from 'express'
import { execFile } from 'node:child_process'
import { readdirSync, statSync } from 'node:fs'
import { promisify } from 'node:util'
import path from 'node:path'
import { z } from 'zod'

const router = Router()
const execFileAsync = promisify(execFile)

const CWD = process.cwd()
const SCHEMA_ARG = path.join('prisma', 'schema.prisma')
const MIGRATIONS_DIR = path.join(CWD, 'prisma', 'migrations')
const NPX_TIMEOUT_MS = 10 * 60 * 1000
const MAX_BUFFER = 20 * 1024 * 1024

type RunResult = { ok: boolean; exitCode: number; stdout: string; stderr: string }

async function runNpxPrisma(args: string[]): Promise<RunResult> {
  const fullArgs = ['prisma', ...args, '--schema', SCHEMA_ARG]
  try {
    const { stdout, stderr } = await execFileAsync('npx', fullArgs, {
      cwd: CWD,
      env: process.env,
      maxBuffer: MAX_BUFFER,
      timeout: NPX_TIMEOUT_MS,
    })
    return {
      ok: true,
      exitCode: 0,
      stdout: stdout?.toString() ?? '',
      stderr: stderr?.toString() ?? '',
    }
  } catch (err: unknown) {
    const e = err as { code?: number; status?: number; stdout?: Buffer; stderr?: Buffer; message?: string }
    const exitCode = typeof e.code === 'number' && e.code !== 0 ? e.code : 1
    return {
      ok: false,
      exitCode,
      stdout: e.stdout?.toString() ?? '',
      stderr: (e.stderr?.toString() || e.message || String(err)) ?? '',
    }
  }
}

async function runNpxTsx(scriptRelative: string): Promise<RunResult> {
  const script = path.join(CWD, scriptRelative)
  try {
    const { stdout, stderr } = await execFileAsync('npx', ['tsx', script], {
      cwd: CWD,
      env: process.env,
      maxBuffer: MAX_BUFFER,
      timeout: NPX_TIMEOUT_MS,
    })
    return {
      ok: true,
      exitCode: 0,
      stdout: stdout?.toString() ?? '',
      stderr: stderr?.toString() ?? '',
    }
  } catch (err: unknown) {
    const e = err as { code?: number; status?: number; stdout?: Buffer; stderr?: Buffer; message?: string }
    const exitCode = typeof e.code === 'number' && e.code !== 0 ? e.code : 1
    return {
      ok: false,
      exitCode,
      stdout: e.stdout?.toString() ?? '',
      stderr: (e.stderr?.toString() || e.message || String(err)) ?? '',
    }
  }
}

/** HTTP 200 always (so clients can read stdout/stderr). Use `success` for Prisma exit code. */
function sendOpResult(res: Response, r: RunResult) {
  res.json({
    success: r.ok,
    exitCode: r.exitCode,
    stdout: r.stdout,
    stderr: r.stderr,
  })
}

function listMigrationFolderNames(): string[] {
  try {
    return readdirSync(MIGRATIONS_DIR)
      .filter((name) => /^\d{14}_/.test(name) && statSync(path.join(MIGRATIONS_DIR, name)).isDirectory())
      .sort()
  } catch {
    return []
  }
}

const migrateResolveSchema = z.object({
  migrationName: z
    .string()
    .min(1)
    .regex(/^\d{14}_[a-z0-9_]+$/i, 'Invalid migration folder name'),
  action: z.enum(['rolled-back', 'applied']),
})

/** GET — list migration folder names (for resolve UI) */
router.get('/migrations', (_req: Request, res: Response) => {
  res.json({ migrations: listMigrationFolderNames() })
})

/** GET — read-only: migration status (non-zero exit may mean pending migrations; still JSON 200) */
router.get('/status', async (_req: Request, res: Response) => {
  const r = await runNpxPrisma(['migrate', 'status'])
  res.json({
    success: r.ok,
    exitCode: r.exitCode,
    stdout: r.stdout,
    stderr: r.stderr,
  })
})

/** POST — apply pending migrations (same as start-api.sh migrate deploy) */
router.post('/migrate', async (_req: Request, res: Response) => {
  const r = await runNpxPrisma(['migrate', 'deploy'])
  sendOpResult(res, r)
})

/**
 * POST — prisma db push (empty/partial DB recovery; same as start-api.sh bootstrap step).
 * Does not clear _prisma_migrations — pair with migrate-resolve applied if needed.
 */
router.post('/db-push', async (_req: Request, res: Response) => {
  const r = await runNpxPrisma(['db', 'push', '--skip-generate'])
  sendOpResult(res, r)
})

/**
 * POST — prisma migrate resolve (P3009 failed migration recovery; same as start-api.sh).
 * rolled-back: retry migrate deploy after. applied: mark applied without re-running SQL.
 */
router.post('/migrate-resolve', async (req: Request, res: Response) => {
  try {
    const body = migrateResolveSchema.parse(req.body)
    const known = listMigrationFolderNames()
    if (!known.includes(body.migrationName)) {
      return res.status(400).json({ error: `Unknown migration: ${body.migrationName}` })
    }
    const r = await runNpxPrisma(['migrate', 'resolve', `--${body.action}`, body.migrationName])
    sendOpResult(res, r)
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: e.errors[0]?.message ?? 'Invalid request' })
    }
    res.status(500).json({ error: 'Migrate resolve failed' })
  }
})

/** POST — idempotent subscription plans only (same as start-api.sh seed_plans) */
router.post('/seed-plans', async (_req: Request, res: Response) => {
  const r = await runNpxTsx('prisma/seed-plans.ts')
  sendOpResult(res, r)
})

/** POST — run prisma db seed (plans + demo users; see prisma/seed.ts) */
router.post('/seed', async (_req: Request, res: Response) => {
  const r = await runNpxPrisma(['db', 'seed'])
  sendOpResult(res, r)
})

export default router
