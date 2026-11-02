/**
 * Keep public/sitemap.xml aligned with indexable routes (see src/lib/publicSeo.ts).
 */
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const site =
  (process.env.VITE_PUBLIC_SITE_URL || 'https://kqsoftwaresolutions.com').replace(/\/$/, '')

/** Paths listed in sitemap — login is noindex and omitted. */
const ROUTES = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/register', changefreq: 'monthly', priority: '0.5' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.4' },
  { path: '/terms', changefreq: 'yearly', priority: '0.4' },
]

const urls = ROUTES.map(
  (r) => `  <url>
    <loc>${site}${r.path === '/' ? '/' : r.path}</loc>
    <changefreq>${r.changefreq}</changefreq>
    <priority>${r.priority}</priority>
  </url>`
).join('\n')

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`

const out = join(root, 'public', 'sitemap.xml')
writeFileSync(out, xml, 'utf8')
console.log(`Wrote ${out} (${ROUTES.length} URLs, site ${site})`)
