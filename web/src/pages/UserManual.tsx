import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function UserManual() {
  const [content, setContent] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    fetch('/user-manual.md')
      .then(async (res) => {
        if (!res.ok) throw new Error('Manual file is not available')
        return res.text()
      })
      .then((text) => {
        if (!mounted) return
        setContent(text)
      })
      .catch((err) => {
        if (!mounted) return
        setError(err instanceof Error ? err.message : 'Failed to load manual')
      })

    return () => {
      mounted = false
    }
  }, [])

  const updatedMatch = content.match(/\*\*Updated:\*\*\s*(.+)/i)
  const lastUpdated = updatedMatch?.[1]?.trim() || null

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">User Manual</h1>
        <p className="text-sm text-gray-600 mt-1">
          This page is published with your platform. Update `web/public/user-manual.md` anytime and redeploy to publish changes.
        </p>
        {lastUpdated && (
          <div className="mt-3 inline-flex items-center rounded-full border border-primary-200 bg-primary-50 px-3 py-1 text-xs font-medium text-primary-800">
            Last updated: {lastUpdated}
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {!error && !content && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
          Loading manual...
        </div>
      )}

      {!!content && (
        <article className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="space-y-4 text-sm leading-7 text-gray-700">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <h1 className="text-3xl font-bold text-gray-900 mt-2 mb-4">{children}</h1>,
                h2: ({ children }) => <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">{children}</h2>,
                h3: ({ children }) => <h3 className="text-lg font-semibold text-gray-900 mt-6 mb-2">{children}</h3>,
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
                th: ({ children }) => <th className="border border-gray-200 bg-gray-50 px-3 py-2 text-left font-semibold">{children}</th>,
                td: ({ children }) => <td className="border border-gray-200 px-3 py-2 align-top">{children}</td>,
                code: ({ children }) => <code className="rounded bg-gray-100 px-1 py-0.5 text-xs text-gray-800">{children}</code>,
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </article>
      )}
    </div>
  )
}
