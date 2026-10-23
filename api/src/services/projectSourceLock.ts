import { isProjectSourceIdentityLocked } from '../lib/permissions.js'

/** True when reconcile (or later) — uploads are closed for this project period. */
export async function isExistingProjectSourceLocked(
  _projectId: string,
  status: string | null | undefined
): Promise<boolean> {
  return isProjectSourceIdentityLocked(status)
}
