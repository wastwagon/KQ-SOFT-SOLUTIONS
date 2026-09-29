/**
 * Role-based permissions for BRS.
 * Roles: admin | reviewer | preparer | viewer
 * admin: full access
 * reviewer: preparer + reopen, approve, export, edit bank rules
 * preparer: upload, map, reconcile, create projects; no delete, reopen, bank rules, billing
 * viewer: read-only (projects, report, audit); no create/edit/delete/match/export
 */

export type OrgRole = 'admin' | 'reviewer' | 'preparer' | 'viewer'

export function canDeleteProject(role: OrgRole | string | null | undefined): boolean {
  return role === 'admin'
}

export function canReopenProject(role: OrgRole | string | null | undefined): boolean {
  return role === 'admin' || role === 'reviewer'
}

export function canEditBankRules(role: OrgRole | string | null | undefined): boolean {
  return role === 'admin' || role === 'reviewer'
}

export function canEditBranding(role: OrgRole | string | null | undefined): boolean {
  return role === 'admin'
}

export function canManageBilling(role: OrgRole | string | null | undefined): boolean {
  return role === 'admin'
}

export function canManageMembers(role: OrgRole | string | null | undefined): boolean {
  return role === 'admin'
}

export function canViewAudit(role: OrgRole | string | null | undefined): boolean {
  return true // all roles can view audit
}

export function canExportReport(role: OrgRole | string | null | undefined): boolean {
  return role === 'admin' || role === 'reviewer' || role === 'preparer'
}

export function canCreateProject(role: OrgRole | string | null | undefined): boolean {
  return role !== 'viewer'
}

export function canUploadDocuments(role: OrgRole | string | null | undefined): boolean {
  return role !== 'viewer'
}

export function canMapDocuments(role: OrgRole | string | null | undefined): boolean {
  return role !== 'viewer'
}

export function canReconcile(role: OrgRole | string | null | undefined): boolean {
  return role !== 'viewer'
}

export function canEditProject(role: OrgRole | string | null | undefined): boolean {
  return role === 'admin' || role === 'reviewer' || role === 'preparer'
}

export function canSubmitForReview(role: OrgRole | string | null | undefined): boolean {
  return role === 'admin' || role === 'reviewer' || role === 'preparer'
}

export function canApprove(role: OrgRole | string | null | undefined): boolean {
  return role === 'admin' || role === 'reviewer'
}

export function canDeleteAttachment(role: OrgRole | string | null | undefined): boolean {
  return role === 'admin' || role === 'reviewer'
}

/** Project statuses that lock editing (upload, map, reconcile) */
export const LOCKED_STATUSES = ['submitted_for_review', 'approved', 'completed']

export const PROJECT_LOCKED_ERROR =
  'Project is locked (completed, submitted for review, or approved). Reopen to edit.'

export const PROJECT_NAME_LOCKED_ERROR =
  'Project name cannot be changed after this project leaves upload.'

export const SOURCE_FILES_LOCKED_ERROR =
  'Source files cannot be added or replaced after this project leaves upload.'

export function isProjectEditable(status: string | null | undefined): boolean {
  return !!status && !LOCKED_STATUSES.includes(status)
}

/** Name changes and new source files are only allowed while the project is still on upload. */
export function isProjectInUploadStage(status: string | null | undefined): boolean {
  return status === 'draft'
}

/**
 * Existing projects are locked once they have left upload, or once source
 * files have already been mapped (even if status was never moved off draft).
 */
export function isProjectSourceIdentityLocked(
  status: string | null | undefined,
  hasMappedSourceData: boolean
): boolean {
  return !isProjectInUploadStage(status) || hasMappedSourceData
}
