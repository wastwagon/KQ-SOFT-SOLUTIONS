import { prisma } from '../lib/prisma.js'
import { isProjectInUploadStage, isProjectSourceIdentityLocked } from '../lib/permissions.js'

/** True for every project that has left upload, including ones created before this rule. */
export async function isExistingProjectSourceLocked(
  projectId: string,
  status: string | null | undefined
): Promise<boolean> {
  if (!isProjectInUploadStage(status)) return isProjectSourceIdentityLocked(status, false)
  const mapped = await prisma.transaction.findFirst({
    where: { document: { projectId } },
    select: { id: true },
  })
  return isProjectSourceIdentityLocked(status, mapped != null)
}
