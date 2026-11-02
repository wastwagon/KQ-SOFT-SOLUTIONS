import { useEffect } from 'react'
import { DEFAULT_SEO, PUBLIC_SITE_URL } from '../../lib/publicSeo'

type PublicPageSeoProps = {
  title?: string
  description?: string
  /** Path only, e.g. `/privacy` */
  path?: string
  /** When true, adds noindex (auth shells). */
  noIndex?: boolean
  jsonLd?: Record<string, unknown> | Record<string, unknown>[]
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  if (typeof document === 'undefined') return
  let el = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.content = content
}

function upsertLink(rel: string, href: string) {
  if (typeof document === 'undefined') return
  let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null
  if (!el) {
    el = document.createElement('link')
    el.rel = rel
    document.head.appendChild(el)
  }
  el.href = href
}

/**
 * Updates document title and meta tags for public SPA routes (crawlers that execute JS + social previews on subpages).
 */
export default function PublicPageSeo({
  title,
  description = DEFAULT_SEO.description,
  path = '/',
  noIndex = false,
  jsonLd,
}: PublicPageSeoProps) {
  const fullTitle = title ?? DEFAULT_SEO.title
  const canonical = `${PUBLIC_SITE_URL}${path.startsWith('/') ? path : `/${path}`}`

  useEffect(() => {
    document.title = fullTitle
    upsertMeta('name', 'description', description)
    upsertMeta('name', 'robots', noIndex ? 'noindex, follow' : 'index, follow')
    upsertMeta('property', 'og:title', fullTitle)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:url', canonical)
    upsertMeta('property', 'og:image', DEFAULT_SEO.ogImage)
    upsertMeta('property', 'og:locale', 'en_GH')
    upsertMeta('name', 'twitter:title', fullTitle)
    upsertMeta('name', 'twitter:description', description)
    upsertMeta('name', 'twitter:image', DEFAULT_SEO.ogImage)
    upsertLink('canonical', canonical)

    const scriptId = 'public-page-jsonld'
    const existing = document.getElementById(scriptId)
    if (existing) existing.remove()
    if (jsonLd) {
      const script = document.createElement('script')
      script.id = scriptId
      script.type = 'application/ld+json'
      script.text = JSON.stringify(jsonLd)
      document.head.appendChild(script)
    }

    return () => {
      document.getElementById(scriptId)?.remove()
    }
  }, [fullTitle, description, canonical, noIndex, jsonLd])

  return null
}
