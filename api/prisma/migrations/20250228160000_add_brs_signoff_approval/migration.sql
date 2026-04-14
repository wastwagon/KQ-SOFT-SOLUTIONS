-- AlterTable (mapped table names: projects, users)
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "prepared_by_id" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "prepared_at" TIMESTAMP(3);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "reviewed_by_id" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP(3);
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "approved_by_id" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_prepared_by_id_fkey";
ALTER TABLE "projects" ADD CONSTRAINT "projects_prepared_by_id_fkey" FOREIGN KEY ("prepared_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_reviewed_by_id_fkey";
ALTER TABLE "projects" ADD CONSTRAINT "projects_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "projects" DROP CONSTRAINT IF EXISTS "projects_approved_by_id_fkey";
ALTER TABLE "projects" ADD CONSTRAINT "projects_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
