/** Public marketing site URL — set VITE_PUBLIC_SITE_URL in production if the canonical host differs. */
export const PUBLIC_SITE_URL =
  (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)?.replace(/\/$/, '') ||
  'https://kqsoftwaresolutions.com'

export const DEFAULT_SEO = {
  title: 'KQ-SOFT — Bank reconciliation & BRS for Ghana accounting teams',
  description:
    'Cloud bank reconciliation for Ghana: cash book and bank statement matching, Ecobank/GCB/Stanbic layouts, checker sign-off, and branded Bank Reconciliation Statement (BRS) exports. Pay in GHS via Paystack.',
  ogImage: `${PUBLIC_SITE_URL}/marketing/marketing-product-match.jpg`,
} as const

export const PUBLIC_ROUTES_SITEMAP = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/login', changefreq: 'monthly', priority: '0.3' },
  { path: '/register', changefreq: 'monthly', priority: '0.5' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.4' },
  { path: '/terms', changefreq: 'yearly', priority: '0.4' },
] as const
