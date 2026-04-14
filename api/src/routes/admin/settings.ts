import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../../lib/prisma.js'
import { invalidatePlatformDefaultsCache } from '../../lib/platformDefaults.js'

const router = Router()
const KEY = 'generation'

const manualRatesSchema = z.object({
  GHS_USD: z.number().positive().optional(),
  GHS_EUR: z.number().positive().optional(),
})

const generationSchema = z.object({
  defaultReportTitle: z.string().optional(),
  defaultFooter: z.string().optional(),
  defaultPrimaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  defaultSecondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  apiRateLimitPerMin: z.number().int().min(10).max(1000).optional(),
  defaultCurrency: z.enum(['GHS', 'USD', 'EUR']).optional(),
  manualRates: manualRatesSchema.optional(),
  useManualRatesOnly: z.boolean().optional(),
  amountTolerance: z.number().min(0).max(100).optional(),
  dateWindowDays: z.number().int().min(0).max(90).optional(),
  dataRetentionYears: z.number().int().min(1).max(30).optional(),
})

router.get('/', async (_req, res) => {
  const row = await prisma.platformSettings.findUnique({ where: { key: KEY } })
  const value = (row?.value as Record<string, unknown>) ?? {}
  const manualRates = (value.manualRates as Record<string, number>) ?? {}
  res.json({
    defaultReportTitle: value.defaultReportTitle ?? 'Bank Reconciliation Statement',
    defaultFooter: value.defaultFooter ?? 'Prepared by your organisation',
    defaultPrimaryColor: value.defaultPrimaryColor ?? '#16a34a',
    defaultSecondaryColor: value.defaultSecondaryColor ?? '#15803d',
    apiRateLimitPerMin: value.apiRateLimitPerMin ?? 100,
    defaultCurrency: value.defaultCurrency ?? 'GHS',
    manualRates: { GHS_USD: manualRates.GHS_USD ?? null, GHS_EUR: manualRates.GHS_EUR ?? null },
    useManualRatesOnly: value.useManualRatesOnly ?? false,
    amountTolerance: value.amountTolerance ?? 0.01,
    dateWindowDays: value.dateWindowDays ?? 3,
    dataRetentionYears: value.dataRetentionYears ?? 7,
  })
})

router.put('/', async (req, res) => {
  const body = generationSchema.partial().parse(req.body)
  const existing = await prisma.platformSettings.findUnique({ where: { key: KEY } })
  const current = (existing?.value as Record<string, unknown>) ?? {}
  const value = { ...current, ...body }
  if (body.manualRates) {
    const prev = (current.manualRates as Record<string, number>) ?? {}
    value.manualRates = { ...prev, ...body.manualRates }
  }
  await prisma.platformSettings.upsert({
    where: { key: KEY },
    create: { key: KEY, value },
    update: { value },
  })
  invalidatePlatformDefaultsCache()
  res.json({ ok: true })
})

export default router
