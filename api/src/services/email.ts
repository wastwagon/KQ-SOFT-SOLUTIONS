/**
 * Email service — Resend when RESEND_API_KEY is set, otherwise logs to console.
 * Set RESEND_API_KEY and EMAIL_FROM in .env for production.
 * EMAIL_FROM must be a verified domain (or onboarding@resend.dev for testing).
 */
import { logger } from '../middleware/logging.js'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const EMAIL_FROM = process.env.EMAIL_FROM || 'BRS <onboarding@resend.dev>'
const APP_NAME = process.env.APP_NAME || 'Bank Reconciliation'

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<boolean> {
  if (RESEND_API_KEY) {
    try {
      const { Resend } = await import('resend')
      const resend = new Resend(RESEND_API_KEY)
      const { error } = await resend.emails.send({
        from: EMAIL_FROM,
        to: [to],
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''),
      })
      if (error) {
        logger.error({ err: error, to, subject }, 'email: Resend API returned error')
        return false
      }
      return true
    } catch (err) {
      logger.error({ err, to, subject }, 'email: send failed')
      return false
    }
  }
  // Fallback: log in development so engineers can see reset links without Resend.
  if (process.env.NODE_ENV === 'development') {
    const link = html.match(/https?:\/\/[^\s"'<>]+/)?.[0] || '(no URL)'
    logger.info({ to, subject, link }, 'email: would send (no RESEND_API_KEY)')
  }
  return true
}

export interface PasswordResetOptions {
  /** Organisation name for white-label footer, e.g. "Sent by [Org Name]" */
  orgName?: string | null
}

export async function sendPasswordReset(to: string, resetUrl: string, options?: PasswordResetOptions): Promise<boolean> {
  const displayName = options?.orgName?.trim() || APP_NAME
  const subject = `Reset your ${displayName} password`
  const footer = options?.orgName?.trim()
    ? `<p style="margin-top:1.5em;font-size:0.85em;color:#6b7280;">Sent by ${escapeHtml(options.orgName.trim())}</p>`
    : ''
  const html = `
    <p>You requested a password reset for ${escapeHtml(displayName)}.</p>
    <p><a href="${resetUrl}">Reset your password</a></p>
    <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
    ${footer}
  `.trim()
  return sendEmail({ to, subject, html })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
