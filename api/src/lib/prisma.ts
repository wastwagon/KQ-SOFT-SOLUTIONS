import { PrismaClient } from '@prisma/client'

/** Shared client — `let` so integration tests can reconnect to Testcontainers. */
export let prisma = new PrismaClient()

/** Point the shared Prisma client at a different DATABASE_URL (tests only). */
export async function reconnectPrisma(databaseUrl: string): Promise<void> {
  await prisma.$disconnect().catch(() => undefined)
  prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  })
}
