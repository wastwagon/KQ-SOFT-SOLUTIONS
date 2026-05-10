import type { Request, Response } from 'express'
import { prisma } from '../lib/prisma.js'
import { logger } from './logging.js'

/**
 * Liveness — has the process started successfully and is the event loop
 * responsive?  Always cheap; never touches the DB.  Coolify / k8s should use
 * this for the liveness probe so a temporarily slow DB does not cause an
 * unnecessary container restart.
 */
export function livenessHandler(_req: Request, res: Response) {
  res.status(200).json({ status: 'ok', service: 'brs-api' })
}

/**
 * Readiness — is this instance ready to handle real traffic right now?  Used
 * by orchestrators for rolling deploys and load-balancer routing.  We probe
 * Postgres with a quick `SELECT 1` and time it out so a wedged DB connection
 * does not pin the request.
 *
 * Returns 200 only when every dependency is reachable; otherwise 503 with a
 * `checks` object so operators can see which dependency is unhappy.
 */
const READINESS_DB_TIMEOUT_MS = Number(process.env.READINESS_DB_TIMEOUT_MS || 1500)

export async function readinessHandler(_req: Request, res: Response) {
  const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {}

  const dbStart = Date.now()
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`db check timed out after ${READINESS_DB_TIMEOUT_MS}ms`)),
          READINESS_DB_TIMEOUT_MS
        )
      ),
    ])
    checks.db = { ok: true, latencyMs: Date.now() - dbStart }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'db check failed'
    checks.db = { ok: false, latencyMs: Date.now() - dbStart, error: message }
    logger.warn({ err }, 'readiness: db check failed')
  }

  const ready = Object.values(checks).every((c) => c.ok)
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    service: 'brs-api',
    checks,
  })
}
