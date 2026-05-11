-- AlterTable
ALTER TABLE "documents" ADD COLUMN "content_hash" TEXT;

-- Speed duplicate detection (project + document slot + hash)
CREATE INDEX "documents_project_id_type_content_hash_idx" ON "documents"("project_id", "type", "content_hash");
