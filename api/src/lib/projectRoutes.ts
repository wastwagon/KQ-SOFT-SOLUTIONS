/** Canonical project deep links — keep in sync with `web/src/lib/projectRoutes.ts`. */
export function projectPathForStatus(slug: string, status: string, opts?: { reportsView?: boolean }) {
  if (opts?.reportsView || status === 'completed' || status === 'approved') {
    return `/projects/${slug}/report`
  }
  if (status === 'submitted_for_review') return `/projects/${slug}/review`
  if (status === 'reconciling') return `/projects/${slug}/reconcile`
  if (status === 'mapping') return `/projects/${slug}/map`
  return `/projects/${slug}`
}
