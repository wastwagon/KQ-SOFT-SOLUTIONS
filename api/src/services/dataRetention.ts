/**
 * Data retention prune — delete completed/approved projects older than the
 * platform retention window, including upload files on disk.
 *
 * Default dryRun=true. Pass confirm=true (admin API) or --execute (CLI) to delete.
 */
import { prisma } from '../lib/prisma.js'
import { getPlatformDefaults } from '../lib/platformDefaults.js'
import { logger } from '../middleware/logging.js'
import { deleteStoredFile } from '../lib/storage.js'

const ELIGIBLE_STATUSES = ['completed', 'approved'] as const

export type RetentionPruneOptions = {
  /** When false, permanently delete eligible projects. Default true. */
  dryRun?: boolean
  /** Override retention years (otherwise platform defaults). */
  retentionYears?: number
  /** Optional org filter (admin / ops). */
  organizationId?: string
  now?: Date
}

export type RetentionPruneResult = {
  dryRun: boolean
  retentionYears: number
  cutoffIso: string
  eligibleProjects: number
  deletedProjects: number
  filesRemoved: number
  projects: Array<{
    id: string
    name: string
    organizationId: string
    status: string
    anchorDate: string
    documentCount: number
  }>
}

/** Anchor date for retention: reconciliationDate if set, else updatedAt. */
export function retentionAnchorDate(project: {
  reconciliationDate: Date | null
  updatedAt: Date
}): Date {
  return project.reconciliationDate ?? project.updatedAt
}

export function retentionCutoff(retentionYears: number, now = new Date()): Date {
  const d = new Date(now)
  d.setFullYear(d.getFullYear() - retentionYears)
  return d
}

export async function runRetentionPrune(opts: RetentionPruneOptions = {}): Promise<RetentionPruneResult> {
  const dryRun = opts.dryRun !== false
  const defaults = await getPlatformDefaults()
  const retentionYears =
    typeof opts.retentionYears === 'number' && opts.retentionYears > 0
      ? opts.retentionYears
      : defaults.dataRetentionYears ?? 7
  const now = opts.now ?? new Date()
  const cutoff = retentionCutoff(retentionYears, now)

  const projects = await prisma.project.findMany({
    where: {
      status: { in: [...ELIGIBLE_STATUSES] },
      ...(opts.organizationId ? { organizationId: opts.organizationId } : {}),
      OR: [
        { reconciliationDate: { not: null, lt: cutoff } },
        { reconciliationDate: null, updatedAt: { lt: cutoff } },
      ],
    },
    select: {
      id: true,
      name: true,
      organizationId: true,
      status: true,
      reconciliationDate: true,
      updatedAt: true,
      documents: { select: { id: true, filepath: true } },
    },
    orderBy: { updatedAt: 'asc' },
    take: 500,
  })

  const summary: RetentionPruneResult['projects'] = projects.map((p) => ({
    id: p.id,
    name: p.name,
    organizationId: p.organizationId,
    status: p.status,
    anchorDate: retentionAnchorDate(p).toISOString(),
    documentCount: p.documents.length,
  }))

  if (dryRun) {
    return {
      dryRun: true,
      retentionYears,
      cutoffIso: cutoff.toISOString(),
      eligibleProjects: projects.length,
      deletedProjects: 0,
      filesRemoved: 0,
      projects: summary,
    }
  }

  let filesRemoved = 0
  let deletedProjects = 0

  for (const project of projects) {
    for (const doc of project.documents) {
      try {
        await deleteStoredFile(doc.filepath)
        filesRemoved += 1
      } catch (err) {
        logger.warn({ err, filepath: doc.filepath, projectId: project.id }, 'retention: failed to unlink upload')
      }
    }

    const attachments = await prisma.brsAttachment.findMany({
      where: { projectId: project.id },
      select: { filepath: true },
    })
    for (const att of attachments) {
      try {
        await deleteStoredFile(att.filepath)
        filesRemoved += 1
      } catch (err) {
        logger.warn({ err, filepath: att.filepath, projectId: project.id }, 'retention: failed to unlink attachment')
      }
    }

    await prisma.project.delete({ where: { id: project.id } })
    deletedProjects += 1
  }

  logger.info(
    { retentionYears, cutoff: cutoff.toISOString(), deletedProjects, filesRemoved },
    'retention prune completed'
  )

  return {
    dryRun: false,
    retentionYears,
    cutoffIso: cutoff.toISOString(),
    eligibleProjects: projects.length,
    deletedProjects,
    filesRemoved,
    projects: summary,
  }
}
