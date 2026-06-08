/**
 * Role-based permissions for BRS UI.
 * Roles: admin | reviewer | preparer | viewer
 */

export type OrgRole = 'admin' | 'reviewer' | 'preparer' | 'viewer'

export function canDeleteProject(role: OrgRole | string | null): boolean {
  return role === 'admin'
}

export function canReopenProject(role: OrgRole | string | null): boolean {
  return role === 'admin' || role === 'reviewer'
}

export function canEditBankRules(role: OrgRole | string | null): boolean {
  return role === 'admin' || role === 'reviewer'
}

export function canEditBranding(role: OrgRole | string | null): boolean {
  return role === 'admin'
}

export function canManageBilling(role: OrgRole | string | null): boolean {
  return role === 'admin'
}

export function canManageMembers(role: OrgRole | string | null): boolean {
  return role === 'admin'
}

export function canExportReport(role: OrgRole | string | null): boolean {
  return role === 'admin' || role === 'reviewer' || role === 'preparer'
}

export function canCreateProject(role: OrgRole | string | null): boolean {
  return role !== 'viewer'
}

export function canUploadDocuments(role: OrgRole | string | null): boolean {
  return role !== 'viewer'
}

export function canMapDocuments(role: OrgRole | string | null): boolean {
  return role !== 'viewer'
}

export function canReconcile(role: OrgRole | string | null): boolean {
  return role !== 'viewer'
}

export function canEditProject(role: OrgRole | string | null): boolean {
  return role === 'admin' || role === 'reviewer' || role === 'preparer'
}

export function canSubmitForReview(role: OrgRole | string | null): boolean {
  return role === 'admin' || role === 'reviewer' || role === 'preparer'
}

export function canApprove(role: OrgRole | string | null): boolean {
  return role === 'admin' || role === 'reviewer'
}

export function canDeleteAttachment(role: OrgRole | string | null): boolean {
  return role === 'admin' || role === 'reviewer'
}

/** Project statuses that lock upload, map, and reconcile */
export const LOCKED_STATUSES = ['submitted_for_review', 'approved', 'completed'] as const

export function isProjectEditable(status: string | null | undefined): boolean {
  return !!status && !LOCKED_STATUSES.includes(status as (typeof LOCKED_STATUSES)[number])
}
