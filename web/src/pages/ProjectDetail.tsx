import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useLocation, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clients, projects, isSubscriptionInactiveError, unlessSubscriptionInactive } from '../lib/api'
import { normalizeClientsList } from '../lib/clientsPayload'
import {
  canDeleteProject,
  canEditProject,
  canExportReport,
  canMapDocuments,
  canReconcile,
  canReopenProject,
  isProjectEditable,
  isProjectSourceIdentityLocked,
} from '../lib/permissions'
import { useAuth } from '../store/auth'
import { useToast } from '../components/ui/Toast'
import PageLoadError from '../components/ui/PageLoadError'
import Card from '../components/ui/Card'
import EmptyState from '../components/ui/EmptyState'
import ProjectHeader, { type ProjectHeaderProject } from '../components/project/ProjectHeader'
import ProjectStepNav, { type ProjectStep } from '../components/project/ProjectStepNav'
import ProjectStageCard from '../components/project/ProjectStageCard'
import ProjectUploadStep from '../components/project/ProjectUploadStep'
import WorkflowStepSkeleton from '../components/project/WorkflowStepSkeleton'
import Skeleton from '../components/ui/Skeleton'
import SubscriptionRenewalPanel from '../components/SubscriptionRenewalPanel'
import {
  isProjectStepId,
  projectStepIndex,
  projectStepPath,
} from '../lib/projectRoutes'
import { rememberRecentNav } from '../lib/commandPaletteRecent'
import CopyProjectLinkButton from '../components/project/CopyProjectLinkButton'

const ProjectMap = lazy(() => import('./ProjectMap'))
const ProjectReconcile = lazy(() => import('./ProjectReconcile'))
const ProjectReview = lazy(() => import('./ProjectReview'))
const ProjectReport = lazy(() => import('./ProjectReport'))

const STEPS: readonly ProjectStep[] = [
  { id: 'upload', label: 'Upload' },
  { id: 'map', label: 'Map' },
  { id: 'reconcile', label: 'Reconcile' },
  { id: 'review', label: 'Review' },
  { id: 'report', label: 'Report' },
]

interface ProjectResponse extends ProjectHeaderProject {
  documents?: { filename: string; type: string; id?: string; _count?: { transactions?: number } }[]
}

/**
 * Project workflow shell.  Acts as an orchestrator only — header, step nav,
 * and the upload step live in dedicated components under
 * `web/src/components/project/`.  The four downstream steps (Map, Reconcile,
 * Review, Report) are mounted inside <ProjectStageCard> which provides the
 * shared chrome and per-stage error boundary.
 */
export default function ProjectDetail() {
  const { slug, step: stepParam } = useParams<{ slug: string; step?: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const role = useAuth((s) => s.role)
  const queryClient = useQueryClient()
  const toast = useToast()

  const [step, setStepState] = useState(0)

  const setStep = useCallback(
    (i: number) => {
      setStepState(i)
      const stepId = STEPS[i]?.id
      if (!slug || !stepId) return
      navigate(projectStepPath(slug, stepId))
    },
    [navigate, slug]
  )

  // Path-based steps (`/projects/:slug/reconcile`) + legacy `#step` hashes.
  useEffect(() => {
    if (!slug) return
    const hash = location.hash.slice(1).toLowerCase()
    if (!stepParam && hash && isProjectStepId(hash)) {
      navigate(projectStepPath(slug, hash), { replace: true })
      return
    }
    const fromPath = projectStepIndex(stepParam?.toLowerCase())
    const fromHash = projectStepIndex(hash)
    const idx = fromPath ?? fromHash
    if (idx !== undefined) setStepState(idx)
  }, [slug, stepParam, location.hash, navigate])

  const projectQuery = useQuery<ProjectResponse>({
    queryKey: ['project', slug],
    queryFn: () => projects.get(slug!) as Promise<ProjectResponse>,
    enabled: !!slug,
  })
  const { data: project, isLoading, isPending: projectPending, isError: projectQueryFailed } = projectQuery

  // Completed / approved jobs open on Report unless the URL names another step.
  useEffect(() => {
    if (!project || !slug) return
    if (isProjectEditable(project.status)) return
    const hash = location.hash.slice(1).toLowerCase()
    if (projectStepIndex(stepParam?.toLowerCase()) !== undefined) return
    if (projectStepIndex(hash) !== undefined) return
    setStepState(4)
    navigate(projectStepPath(slug, 'report'), { replace: true })
  }, [project, slug, stepParam, location.hash, navigate])

  const clientsQuery = useQuery({
    queryKey: ['clients'],
    queryFn: clients.list,
  })
  const { data: clientsRaw, isError: clientsQueryFailed } = clientsQuery
  const clientsList = useMemo(() => normalizeClientsList(clientsRaw), [clientsRaw])
  const paywallBlocked =
    isSubscriptionInactiveError(projectQuery.error) || isSubscriptionInactiveError(clientsQuery.error)
  const loadFailed = !paywallBlocked && (projectQueryFailed || clientsQueryFailed)

  const updateMutation = useMutation({
    mutationFn: (body: {
      name: string
      statementBusinessName: string | null
      clientId: string | null
      currency: 'GHS' | 'USD' | 'EUR'
    }) => projects.update(slug!, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', slug] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project updated')
    },
    onError: (err) =>
      unlessSubscriptionInactive(err, (e) =>
        toast.error('Could not update project', e instanceof Error ? e.message : undefined)
      ),
  })

  const deleteMutation = useMutation({
    mutationFn: () => projects.delete(slug!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project deleted')
      navigate('/projects')
    },
    onError: (err) =>
      unlessSubscriptionInactive(err, (e) =>
        toast.error('Could not delete project', e instanceof Error ? e.message : undefined)
      ),
  })

  const workflowStepId = STEPS[step]?.id

  useEffect(() => {
    if (!slug || !project?.name || !workflowStepId) return
    rememberRecentNav({
      id: `project-${slug}`,
      label: project.name,
      to: projectStepPath(slug, workflowStepId),
      hint: STEPS[step]?.label,
    })
  }, [slug, project?.name, step, workflowStepId])

  if (!slug) {
    return <ProjectDetailSkeleton />
  }

  if (stepParam && !isProjectStepId(stepParam.toLowerCase())) {
    return <Navigate to={projectStepPath(slug)} replace />
  }
  if (paywallBlocked) {
    return (
      <div className="space-y-6">
        <SubscriptionRenewalPanel />
      </div>
    )
  }
  if (loadFailed) {
    const err = projectQuery.error ?? clientsQuery.error
    return (
      <div className="space-y-6">
        <PageLoadError
          title="Could not load project"
          error={err}
          onRetry={() => {
            void queryClient.invalidateQueries({ queryKey: ['project', slug] })
            void queryClient.invalidateQueries({ queryKey: ['clients'] })
          }}
        />
      </div>
    )
  }
  if ((isLoading || projectPending) && !project) {
    return <ProjectDetailSkeleton />
  }
  if (!project) {
    return (
      <Card>
        <EmptyState
          title="Project not found"
          description="The project may have been deleted or you may not have permission to view it."
        />
      </Card>
    )
  }

  const sourceIdentityLocked = isProjectSourceIdentityLocked(project.status, project.documents)

  return (
    <div className="space-y-6">
      <ProjectHeader
        project={project}
        clients={clientsList}
        canEdit={canEditProject(role) && isProjectEditable(project.status)}
        canEditName={canEditProject(role) && !sourceIdentityLocked}
        canDelete={canDeleteProject(role)}
        isUpdating={updateMutation.isPending}
        isDeleting={deleteMutation.isPending}
        onSave={(body) => updateMutation.mutate(body)}
        onDelete={() => deleteMutation.mutate()}
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <ProjectStepNav steps={STEPS} current={step} onChange={setStep} />
        </div>
        <CopyProjectLinkButton slug={slug} stepId={workflowStepId} />
      </div>

      {step === 0 && (
        <ProjectUploadStep
          projectSlug={slug}
          documents={project.documents ?? []}
          role={role}
          sourceUploadsLocked={sourceIdentityLocked}
          onProceed={() => setStep(1)}
        />
      )}
      {step === 1 && (
        <ProjectStageCard ariaLabel="Map columns">
          <Suspense fallback={<WorkflowStepSkeleton />}>
            <ProjectMap
              projectId={slug}
              canMap={canMapDocuments(role)}
              onProceedToReconcile={() => setStep(2)}
            />
          </Suspense>
        </ProjectStageCard>
      )}
      {step === 2 && (
        <ProjectStageCard ariaLabel="Reconcile transactions">
          <Suspense fallback={<WorkflowStepSkeleton />}>
            <ProjectReconcile
              projectId={slug}
              canReconcile={canReconcile(role)}
              onProceedToReview={() => setStep(3)}
            />
          </Suspense>
        </ProjectStageCard>
      )}
      {step === 3 && (
        <ProjectStageCard ariaLabel="Review and approve">
          <Suspense fallback={<WorkflowStepSkeleton />}>
            <ProjectReview
              projectId={slug}
              onGoToReconcile={() => setStep(2)}
              onGoToReport={() => setStep(4)}
            />
          </Suspense>
        </ProjectStageCard>
      )}
      {step === 4 && (
        <ProjectStageCard ariaLabel="Report">
          <Suspense fallback={<WorkflowStepSkeleton />}>
            <ProjectReport
              projectId={slug}
              onGoToReview={() => setStep(3)}
              onReopen={(mode) => setStep(mode === 'sources' ? 1 : 2)}
              onRollForward={(newProjectId) => {
                navigate(projectStepPath(newProjectId, 'upload'))
              }}
              canExport={canExportReport(role)}
              canReopen={canReopenProject(role)}
            />
          </Suspense>
        </ProjectStageCard>
      )}
    </div>
  )
}

/** Branded skeleton shown while the project query resolves. */
function ProjectDetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading project">
      <div className="rounded-xl border border-border bg-white shadow-card px-5 py-5 sm:px-7 sm:py-6 space-y-4">
        <Skeleton className="h-4 w-36 rounded-xl" />
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-9 w-56 sm:w-72 rounded-xl" />
          <Skeleton className="h-8 w-28 rounded-full" />
        </div>
        <Skeleton className="h-4 w-52 rounded-xl" />
      </div>
      <Skeleton className="h-14 w-full rounded-xl shadow-sm" />
      <Skeleton className="h-72 w-full rounded-xl shadow-sm" />
    </div>
  )
}
