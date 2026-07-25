import { Router } from 'express'
import { z } from 'zod'
import { runRetentionPrune } from '../../services/dataRetention.js'

const router = Router()

const bodySchema = z.object({
  /** Must be true to permanently delete. Default dry-run. */
  confirm: z.boolean().optional(),
  retentionYears: z.number().int().min(1).max(30).optional(),
  organizationId: z.string().min(1).optional(),
})

/** GET preview — always dry-run */
router.get('/', async (req, res) => {
  const retentionYears = req.query.years ? Number(req.query.years) : undefined
  const organizationId = typeof req.query.organizationId === 'string' ? req.query.organizationId : undefined
  const result = await runRetentionPrune({
    dryRun: true,
    retentionYears: Number.isFinite(retentionYears) && (retentionYears as number) > 0 ? retentionYears : undefined,
    organizationId,
  })
  res.json(result)
})

/** POST — dry-run unless confirm: true */
router.post('/', async (req, res) => {
  const parsed = bodySchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() })
    return
  }
  const { confirm, retentionYears, organizationId } = parsed.data
  const result = await runRetentionPrune({
    dryRun: confirm !== true,
    retentionYears,
    organizationId,
  })
  res.json(result)
})

export default router
