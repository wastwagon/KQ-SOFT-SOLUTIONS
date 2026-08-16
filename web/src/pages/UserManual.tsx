import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useAuth } from '../store/auth'
import PageHeader from '../components/layout/PageHeader'
import Alert from '../components/ui/Alert'
import Badge from '../components/ui/Badge'
import Card from '../components/ui/Card'
import { PageBodySkeleton } from '../components/ui/Skeleton'

type TocItem = { id: string; label: string; level: 2 | 3 }

function slugifyHeading(label: string) {
  return label
    .toLowerCase()
    .replace(/&/g, '')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/ /g, '-')
}

function textFromNode(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textFromNode).join('')
  if (typeof node === 'object' && node && 'props' in node) {
    return textFromNode((node as { props: { children?: ReactNode } }).props.children)
  }
  return ''
}

function extractToc(md: string): TocItem[] {
  const items: TocItem[] = []
  for (const line of md.split('\n')) {
    const match = /^(#{2,3})\s+(.+)$/.exec(line)
    if (!match) continue
    const label = match[2].replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim()
    if (!label) continue
    items.push({
      id: slugifyHeading(label),
      label,
      level: match[1].length === 3 ? 3 : 2,
    })
  }
  return items
}

export default function UserManual() {
  const org = useAuth((s) => s.org)
  const [content, setContent] = useState('')
  const [error, setError] = useState('')
  const [activeId, setActiveId] = useState('')

  const loadManual = useCallback(() => {
    setError('')
    setContent('')
    fetch('/user-manual.md')
      .then(async (res) => {
        if (!res.ok) throw new Error('Manual file is not available')
        return res.text()
      })
      .then((text) => {
        setContent(text)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load manual')
      })
  }, [])

  useEffect(() => {
    loadManual()
  }, [loadManual])

  const toc = useMemo(() => extractToc(content), [content])

  useEffect(() => {
    if (toc[0] && !window.location.hash) setActiveId(toc[0].id)
  }, [toc])

  useEffect(() => {
    if (!content) return
    const hash = window.location.hash.slice(1)
    if (!hash) return
    requestAnimationFrame(() => {
      document.getElementById(hash)?.scrollIntoView({ block: 'start' })
      setActiveId(hash)
    })
  }, [content])

  useEffect(() => {
    if (!toc.length) return
    const headings = toc
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => !!el)
    if (!headings.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        const id = visible[0]?.target.id
        if (id) setActiveId(id)
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.1 }
    )
    headings.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [toc])

  const updatedMatch = content.match(/\*\*Updated:\*\*\s*(.+)/i)
  const lastUpdated = updatedMatch?.[1]?.trim() || null

  const heading =
    (Tag: 'h2' | 'h3') =>
    ({ children }: { children?: ReactNode }) => {
      const label = textFromNode(children)
      const id = slugifyHeading(label)
      const cls =
        Tag === 'h2'
          ? 'scroll-mt-24 text-xl font-semibold text-gray-900 mt-8 mb-3'
          : 'scroll-mt-24 text-lg font-semibold text-gray-900 mt-6 mb-2'
      return (
        <Tag id={id} className={cls}>
          <a
            href={`#${id}`}
            className="rounded hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            {children}
          </a>
        </Tag>
      )
    }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <PageHeader
        eyebrow="Administration"
        title="User manual"
        subtitle={
          <>
            {org?.name ? <p className="text-gray-700 font-medium">{org.name}</p> : null}
            <p className="text-gray-500">
              Guides for uploading statements, matching, review, and exporting a BRS. Open this anytime
              from the account menu or Search.
            </p>
          </>
        }
        actions={
          lastUpdated ? (
            <Badge tone="brand" size="sm">
              Last updated: {lastUpdated}
            </Badge>
          ) : undefined
        }
      />

      {error && (
        <Alert tone="error" title="Could not load user manual" onRetry={loadManual}>
          {error}
        </Alert>
      )}

      {!error && !content && (
        <PageBodySkeleton label="Loading manual" />
      )}

      {!!content && (
        <div className="lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8 lg:items-start">
          <nav aria-label="On this page" className="mb-6 lg:mb-0 lg:sticky lg:top-20">
            <Card className="max-h-[calc(100vh-6rem)]" noPadding>
              <div className="max-h-[calc(100vh-6rem)] overflow-y-auto p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-2">On this page</p>
            <ol className="space-y-0.5">
              {toc.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    onClick={() => setActiveId(item.id)}
                    className={`block rounded-lg py-1 text-sm leading-snug hover:text-primary-700 ${
                      item.level === 3 ? 'pl-3 text-gray-500' : 'text-gray-700'
                    } ${activeId === item.id ? 'font-semibold text-primary-700' : ''}`}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ol>
              </div>
            </Card>
          </nav>

          <Card>
            <div className="space-y-4 text-sm leading-7 text-gray-700">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => <h1 className="text-3xl font-bold text-gray-900 mt-2 mb-4">{children}</h1>,
                  h2: heading('h2'),
                  h3: heading('h3'),
                  p: ({ children }) => <p className="text-gray-700">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc pl-5 space-y-1">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-5 space-y-1">{children}</ol>,
                  li: ({ children }) => <li>{children}</li>,
                  hr: () => <hr className="my-6 border-gray-200" />,
                  table: ({ children }) => (
                    <div className="overflow-x-auto">
                      <table className="min-w-full border border-gray-200 text-sm">{children}</table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="border border-gray-200 bg-gray-50 px-3 py-2 text-left font-semibold">{children}</th>
                  ),
                  td: ({ children }) => <td className="border border-gray-200 px-3 py-2 align-top">{children}</td>,
                  code: ({ children }) => (
                    <code className="rounded bg-gray-100 px-1 py-0.5 text-xs text-gray-800">{children}</code>
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
