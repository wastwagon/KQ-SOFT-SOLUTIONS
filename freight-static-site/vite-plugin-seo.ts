import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

/** Writes `sitemap.xml` and `robots.txt` into the build output using `VITE_SITE_URL` and `VITE_BASE`. */
export function seoStaticFiles(): Plugin {
  return {
    name: 'seo-static-files',
    apply: 'build',
    closeBundle() {
      const siteUrl = (process.env.VITE_SITE_URL || 'https://www.rexgroupfreighttransport.com').replace(/\/$/, '')
      const basePrefix = (process.env.VITE_BASE || '/').replace(/\/$/, '')
      const routes = ['/', '/about', '/contact']

      const absoluteUrl = (route: string) => `${siteUrl}${basePrefix}${route === '/' ? '/' : route}`

      const urls = routes.map((route) => ({
        loc: absoluteUrl(route),
        changefreq: route === '/' ? 'weekly' : 'monthly',
        priority: route === '/' ? '1.0' : '0.8',
      }))

      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`

      const outDir = resolve(process.cwd(), 'dist')
      writeFileSync(resolve(outDir, 'sitemap.xml'), sitemap, 'utf8')

      const robots = `User-agent: *
Allow: /

Sitemap: ${siteUrl}${basePrefix}/sitemap.xml
`
      writeFileSync(resolve(outDir, 'robots.txt'), robots, 'utf8')
    },
  }
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
}
