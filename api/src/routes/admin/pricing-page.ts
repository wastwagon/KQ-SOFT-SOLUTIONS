import { Router } from 'express'
import { z } from 'zod'
import {
  getPricingPageConfig,
  savePricingPageConfig,
  parsePricingPageConfig,
} from '../../services/pricingPageSettings.js'

const router = Router()

const featureRowSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(300),
  hint: z.string().max(500).optional(),
})

const featureGroupSchema = z.object({
  title: z.string().min(1).max(120),
  features: z.array(featureRowSchema).min(1).max(40),
})

const configSchema = z.object({
  featureGroups: z.array(featureGroupSchema).min(1).max(20),
  extraFeatureCatalog: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        label: z.string().min(1).max(120),
        hint: z.string().max(500).optional().default(''),
      })
    )
    .max(40)
    .optional(),
})

router.get('/', async (_req, res) => {
  const config = await getPricingPageConfig()
  res.json(config)
})

router.put('/', async (req, res) => {
  const body = configSchema.parse(req.body)
  const config = parsePricingPageConfig(body)
  await savePricingPageConfig(config)
  res.json(config)
})

export default router
