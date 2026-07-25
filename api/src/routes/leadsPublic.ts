import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { logger } from '../middleware/logging.js'
import { sendAlertWebhook } from '../lib/alertWebhook.js'
import { Resend } from 'resend'

const router = Router()

const leadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again later.' },
})

const SOURCES = ['newsletter', 'bank_feeds', 'sales', 'contact'] as const

const createLeadSchema = z.object({
  email: z.string().email().max(254),
  name: z.string().trim().max(120).optional(),
  company: z.string().trim().max(160).optional(),
  source: z.enum(SOURCES),
  message: z.string().trim().max(2000).optional(),
})

async function notifySalesInbox(lead: {
  email: string
  name?: string | null
  company?: string | null
  source: string
  message?: string | null
}) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  const to = process.env.LEADS_NOTIFY_EMAIL || 'info@kqsoftwaresolutions.com'
  if (!apiKey || !from) return
  try {
    const resend = new Resend(apiKey)
    await resend.emails.send({
      from,
      to,
      subject: `[KQ-SOFT lead] ${lead.source}: ${lead.email}`,
      text: [
        `Source: ${lead.source}`,
        `Email: ${lead.email}`,
        lead.name ? `Name: ${lead.name}` : null,
        lead.company ? `Company: ${lead.company}` : null,
        lead.message ? `Message:\n${lead.message}` : null,
      ]
        .filter(Boolean)
        .join('\n'),
    })
  } catch (err) {
    logger.warn({ err }, 'lead notify email failed')
  }
}

router.post('/leads', leadLimiter, async (req, res) => {
  const parsed = createLeadSchema.safeParse(req.body ?? {})
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0]?.message || 'Invalid lead' })
  }
  const body = parsed.data
  const email = body.email.trim().toLowerCase()

  // Soft dedupe: same email+source within 24h returns ok without creating another row.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const existing = await prisma.lead.findFirst({
    where: { email, source: body.source, createdAt: { gte: since } },
    select: { id: true },
  })
  if (existing) {
    return res.status(200).json({ ok: true, id: existing.id, duplicate: true })
  }

  const lead = await prisma.lead.create({
    data: {
      email,
      name: body.name || null,
      company: body.company || null,
      source: body.source,
      message: body.message || null,
      meta: {
        userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 300) : undefined,
      },
    },
  })

  void sendAlertWebhook({
    key: `lead:${lead.source}:${lead.email}`,
    title: `New lead (${lead.source})`,
    text: `${lead.email}${lead.company ? ` · ${lead.company}` : ''}`,
    severity: 'info',
    cooldownMs: 60_000,
    fields: {
      name: lead.name,
      company: lead.company,
      message: lead.message?.slice(0, 200),
    },
  })
  void notifySalesInbox(lead)

  res.status(201).json({ ok: true, id: lead.id })
})

export default router
