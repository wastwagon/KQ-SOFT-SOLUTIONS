import { prisma } from '../lib/prisma.js'

export type AuditAction =
  | 'document_uploaded'
  | 'document_mapped'
  | 'match_created'
  | 'match_deleted'
  | 'match_bulk'
  | 'report_generated'
  | 'report_exported'
  | 'project_reopened'
  | 'project_submitted'
  | 'project_approved'
  | 'attachment_uploaded'
  | 'attachment_deleted'
  | 'reconciliation_undone'

export async function logAudit(params: {
  organizationId: string
  userId?: string
  projectId?: string
  action: AuditAction
  details?: Record<string, unknown>
}) {
  await prisma.auditLog.create({
    data: {
      organizationId: params.organizationId,
      userId: params.userId,
      projectId: params.projectId,
      action: params.action,
      details: params.details ? (params.details as object) : undefined,
    },
  })
}
