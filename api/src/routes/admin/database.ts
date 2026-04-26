/**
 * Platform admin only: run Prisma migrate / seed against DATABASE_URL.
 * Use when container startup migration failed or you need to apply seed (plans, test users) on server.
 */
import { Router, type Request, type Response } from 'express'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'

const router = Router()
const execFileAsync = promisify(execFile)

const CWD = process.cwd()
const SCHEMA_ARG = path.join('prisma', 'schema.prisma')
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

/** HTTP 200 always (so clients can read stdout/stderr). Use `success` for Prisma exit code. */
function sendMigrateOrSeedResult(res: Response, r: RunResult) {
  res.json({
    success: r.ok,
    exitCode: r.exitCode,
    stdout: r.stdout,
    stderr: r.stderr,
  })
}

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
  sendMigrateOrSeedResult(res, r)
})

/** POST — run prisma db seed (plans + optional test users; see prisma/seed.ts) */
router.post('/seed', async (_req: Request, res: Response) => {
  const r = await runNpxPrisma(['db', 'seed'])
  sendMigrateOrSeedResult(res, r)
})

export default router
