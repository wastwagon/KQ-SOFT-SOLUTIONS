-- AlterTable
ALTER TABLE "Project" ADD COLUMN "prepared_by_id" TEXT;
ALTER TABLE "Project" ADD COLUMN "prepared_at" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "reviewed_by_id" TEXT;
ALTER TABLE "Project" ADD COLUMN "reviewed_at" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN "approved_by_id" TEXT;
ALTER TABLE "Project" ADD COLUMN "approved_at" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_prepared_by_id_fkey" FOREIGN KEY ("prepared_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
