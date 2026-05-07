import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { absolutePublicUrl, getSiteOrigin } from '../lib/siteUrl'

const defaultDesc =
  'RexGroup Freight, Transportation & Logistics — sea, air, and land freight, warehousing, and import/export across Ghana and worldwide.'

const defaultOgImagePath = '/assets/images/rexgroupimage-1.jpeg'

function setNamedMeta(name: string, content: string) {
  let el = document.querySelector(`meta[name="${name}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('name', name)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setPropertyMeta(property: string, content: string) {
  let el = document.querySelector(`meta[property="${property}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute('property', property)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function setLinkCanonical(href: string) {
  let el = document.querySelector('link[rel="canonical"]')
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

export type PageMetaOptions = {
  /** Path under public URL for OG/Twitter image */
  ogImagePath?: string
  /** Set on error pages */
  noindex?: boolean
}

/**
 * Updates title, description, canonical, Open Graph, and Twitter meta for SPA routes.
 * Set `VITE_SITE_URL` (e.g. https://www.example.com) in production for correct sharing URLs.
 */
export function usePageMeta(
  pageTitle: string,
  description: string = defaultDesc,
  options: PageMetaOptions = {},
) {
  const location = useLocation()
  const { ogImagePath = defaultOgImagePath, noindex = false } = options

  useEffect(() => {
    const fullTitle = pageTitle.startsWith('RexGroup') ? pageTitle : `${pageTitle} | RexGroup`
    document.title = fullTitle

    let meta = document.querySelector('meta[name="description"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.setAttribute('name', 'description')
      document.head.appendChild(meta)
    }
    meta.setAttribute('content', description)

    const origin = getSiteOrigin()
    const basePrefix = import.meta.env.BASE_URL.replace(/\/$/, '')
    const pathPart = location.pathname === '/' ? '/' : location.pathname
    const canonicalHref = origin ? `${origin}${basePrefix}${pathPart}` : ''

    if (canonicalHref) {
      setLinkCanonical(canonicalHref)
    }

    if (noindex) {
      setNamedMeta('robots', 'noindex, follow')
    } else {
      document.querySelector('meta[name="robots"]')?.remove()
    }

    setPropertyMeta('og:type', 'website')
    setPropertyMeta('og:site_name', 'RexGroup')
    setPropertyMeta('og:title', fullTitle)
    setPropertyMeta('og:description', description)
    if (canonicalHref) {
      setPropertyMeta('og:url', canonicalHref)
    }

    const ogImage = absolutePublicUrl(ogImagePath)
    setPropertyMeta('og:image', ogImage)
    setPropertyMeta('og:image:alt', fullTitle)

    setNamedMeta('twitter:card', 'summary_large_image')
    setNamedMeta('twitter:title', fullTitle)
    setNamedMeta('twitter:description', description)
    setNamedMeta('twitter:image', ogImage)
  }, [pageTitle, description, location.pathname, ogImagePath, noindex])
}
