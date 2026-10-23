/** BRS workflow steps — must match `ProjectDetail` STEPS ids. */
export const PROJECT_STEP_IDS = ['upload', 'map', 'reconcile', 'review', 'report'] as const
export type ProjectStepId = (typeof PROJECT_STEP_IDS)[number]

export const PROJECT_STEP_LABELS: Record<ProjectStepId, string> = {
  upload: 'Upload',
  map: 'Map',
  reconcile: 'Reconcile',
  review: 'Review',
  report: 'Report',
}

const STEP_INDEX: Record<ProjectStepId, number> = Object.fromEntries(
  PROJECT_STEP_IDS.map((id, i) => [id, i])
) as Record<ProjectStepId, number>

export function isProjectStepId(value: string): value is ProjectStepId {
  return (PROJECT_STEP_IDS as readonly string[]).includes(value)
}

export function projectStepIndex(stepId: string | undefined): number | undefined {
  if (!stepId) return undefined
  const key = stepId.toLowerCase()
  if (!isProjectStepId(key)) return undefined
  return STEP_INDEX[key]
}

/** Canonical path for a project workflow step (`upload` → `/projects/:slug`). */
export function projectStepPath(slug: string, step?: ProjectStepId | string) {
  const id = step?.toLowerCase()
  if (!id || id === 'upload' || !isProjectStepId(id)) {
    return `/projects/${slug}`
  }
  return `/projects/${slug}/${id}`
}

/** Deep link target from project status (dashboard, command palette, tables). */
export function projectPathForStatus(
  slug: string,
  status: string,
  opts?: { reportsView?: boolean }
) {
  if (opts?.reportsView || status === 'completed' || status === 'approved') {
    return projectStepPath(slug, 'report')
  }
  if (status === 'submitted_for_review') return projectStepPath(slug, 'review')
  if (status === 'reconciling') return projectStepPath(slug, 'reconcile')
  if (status === 'mapping') return projectStepPath(slug, 'map')
  return projectStepPath(slug, 'upload')
}
