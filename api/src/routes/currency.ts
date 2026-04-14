import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.js'
import { getRates } from '../services/currencyConversion.js'

const router = Router()
router.use(authMiddleware)

/** GET /currency/rates — fetch FX rates for display/conversion. Attribution: ExchangeRate-API */
router.get('/rates', async (_req, res) => {
  const rates = await getRates()
  res.json({
    rates: { GHS: rates.GHS, USD: rates.USD, EUR: rates.EUR },
    attribution: 'Rates by ExchangeRate-API (https://www.exchangerate-api.com)',
  })
})

export default router
