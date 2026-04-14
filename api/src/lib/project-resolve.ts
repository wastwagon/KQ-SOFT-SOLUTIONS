import { prisma } from './prisma.js'

/** Resolve project id from slug or id. CUIDs are 25 chars; slugs contain hyphens. */
function isSlug(slugOrId: string): boolean {
  return slugOrId.includes('-') || slugOrId.length !== 25 || !/^[a-z0-9]+$/i.test(slugOrId)
}

export async function resolveProjectId(slugOrId: string, orgId: string): Promise<string | null> {
  const project = await prisma.project.findFirst({
    where: isSlug(slugOrId)
      ? { organizationId: orgId, slug: slugOrId }
      : { id: slugOrId, organizationId: orgId },
    select: { id: true },
  })
  return project?.id ?? null
}
