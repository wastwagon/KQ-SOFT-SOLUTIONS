import { prisma } from '../lib/prisma.js'

/** Remove matches left with missing sides after transaction remap (e.g. bank tx deleted, cash_book item remains). */
export async function purgeOrphanMatches(projectId: string): Promise<number> {
  const matches = await prisma.match.findMany({
    where: { projectId },
    include: { _count: { select: { matchItems: true } } },
  })
  const orphanIds = matches
    .filter((m) => {
      const n = m._count.matchItems
      if (n === 0) return true
      if (m.type === 'one_to_one' && n !== 2) return true
      return false
    })
    .map((m) => m.id)
  if (!orphanIds.length) return 0
  const deleted = await prisma.match.deleteMany({ where: { id: { in: orphanIds } } })
  return deleted.count
}
