import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { clients, projects, isSubscriptionInactiveError, unlessSubscriptionInactive } from '../lib/api'
import {
  canDeleteProject,
  canEditProject,
  canExportReport,
  canMapDocuments,
  canReconcile,
  canReopenProject,
} from '../lib/permissions'
import { useAuth } from '../store/auth'
import { useToast } from '../components/ui/Toast'
import ProjectHeader, { type ProjectHeaderProject } from '../components/project/ProjectHeader'
import ProjectStepNav, { type ProjectStep } from '../components/project/ProjectStepNav'
import ProjectStageCard from '../components/project/ProjectStageCard'
import ProjectUploadStep from '../components/project/ProjectUploadStep'
import Skeleton from '../components/ui/Skeleton'
import ProjectMap from './ProjectMap'
import ProjectReconcile from './ProjectReconcile'
import ProjectReview from './ProjectReview'
import ProjectReport from './ProjectReport'
import SubscriptionRenewalPanel from '../components/SubscriptionRenewalPanel'

const STEPS: readonly ProjectStep[] = [
  { id: 'upload', label: 'Upload' },
  { id: 'map', label: 'Map' },
  { id: 'reconcile', label: 'Reconcile' },
  { id: 'review', label: 'Review' },
  { id: 'report', label: 'Report' },
]

const HASH_TO_STEP: Record<string, number> = Object.fromEntries(
  STEPS.map((s, i) => [s.id, i])
)

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
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const role = useAuth((s) => s.role)
  const queryClient = useQueryClient()
  const toast = useToast()

  const [step, setStepState] = useState(() => {
    if (typeof window === 'undefined') return 0
    const h = window.location.hash.slice(1).toLowerCase()
    return HASH_TO_STEP[h] ?? 0
  })

  // Sync URL hash → step so deep links like /projects/foo#review still work.
  const syncHashToStep = useCallback(() => {
    const h = (typeof window !== 'undefined' ? window.location.hash : location.hash)
      .slice(1)
      .toLowerCase()
    const idx = HASH_TO_STEP[h]
    if (idx !== undefined) setStepState(idx)
  }, [location.hash])

  useEffect(() => {
    window.addEventListener('hashchange', syncHashToStep)
    return () => window.removeEventListener('hashchange', syncHashToStep)
  }, [syncHashToStep])

  const setStep = useCallback(
    (i: number) => {
      setStepState(i)
      const newHash = STEPS[i]?.id
      if (newHash) {
        const url = `${location.pathname}${location.search}#${newHash}`
        window.history.replaceState(null, '', url)
      }
    },
    [location.pathname, location.search]
  )

  const projectQuery = useQuery<ProjectResponse>({
    queryKey: ['project', slug],
    queryFn: () => projects.get(slug!) as Promise<ProjectResponse>,
    enabled: !!slug,
  })
  const { data: project, isLoading, isPending: projectPending, isError: projectQueryFailed } = projectQuery

  const clientsQuery = useQuery({
    queryKey: ['clients'],
    queryFn: clients.list,
  })
  const { data: clientsList = [], isError: clientsQueryFailed } = clientsQuery
  const paywallBlocked =
    isSubscriptionInactiveError(projectQuery.error) || isSubscriptionInactiveError(clientsQuery.error)
  const loadFailed = !paywallBlocked && (projectQueryFailed || clientsQueryFailed)

  const updateMutation = useMutation({
    mutationFn: (body: {
      name: string
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

  if (!slug) {
    return <ProjectDetailSkeleton />
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
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 max-w-xl">
          <p className="font-medium text-red-900">Could not load project</p>
          <p className="mt-1">{err instanceof Error ? err.message : 'Something went wrong.'}</p>
          <button
            type="button"
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: ['project', slug] })
              void queryClient.invalidateQueries({ queryKey: ['clients'] })
            }}
            className="mt-3 px-3 py-1.5 text-sm font-medium rounded-lg bg-white border border-red-300 text-red-900 hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }
  if ((isLoading || projectPending) && !project) {
    return <ProjectDetailSkeleton />
  }
  if (!project) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900">Project not found</h1>
        <p className="mt-2 text-sm text-gray-500">
          The project may have been deleted or you may not have permission to view it.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <ProjectHeader
        project={project}
        clients={clientsList as { id: string; name: string }[]}
        canEdit={canEditProject(role)}
        canDelete={canDeleteProject(role)}
        isUpdating={updateMutation.isPending}
        isDeleting={deleteMutation.isPending}
        onSave={(body) => updateMutation.mutate(body)}
        onDelete={() => deleteMutation.mutate()}
      />

      <ProjectStepNav steps={STEPS} current={step} onChange={setStep} />

      {step === 0 && (
        <ProjectUploadStep
          projectSlug={slug}
          documents={project.documents ?? []}
          role={role}
          onProceed={() => setStep(1)}
        />
      )}
      {step === 1 && (
        <ProjectStageCard ariaLabel="Map columns">
          <ProjectMap
            projectId={slug}
            canMap={canMapDocuments(role)}
            onProceedToReconcile={() => setStep(2)}
          />
        </ProjectStageCard>
      )}
      {step === 2 && (
        <ProjectStageCard ariaLabel="Reconcile transactions">
          <ProjectReconcile
            projectId={slug}
            canReconcile={canReconcile(role)}
            onProceedToReview={() => setStep(3)}
          />
        </ProjectStageCard>
      )}
      {step === 3 && (
        <ProjectStageCard ariaLabel="Review and approve">
          <ProjectReview
            projectId={slug}
            onGoToReconcile={() => setStep(2)}
            onGoToReport={() => setStep(4)}
          />
        </ProjectStageCard>
      )}
      {step === 4 && (
        <ProjectStageCard ariaLabel="Report">
          <ProjectReport
            projectId={slug}
            onGoToReview={() => setStep(3)}
            onReopen={() => setStep(2)}
            onRollForward={(newProjectId) => {
              navigate(`/projects/${newProjectId}`)
            }}
            canExport={canExportReport(role)}
            canReopen={canReopenProject(role)}
          />
        </ProjectStageCard>
      )}
    </div>
  )
}

/** Branded skeleton shown while the project query resolves. */
function ProjectDetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading project">
      <div className="space-y-3">
        <Skeleton className="h-3 w-32" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <Skeleton className="h-4 w-44" />
      </div>
      <Skeleton className="h-16 w-full rounded-2xl" />
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  )
}
