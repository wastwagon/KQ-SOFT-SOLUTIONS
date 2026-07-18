-- Persist parse/auto-map job status on documents (deferred upload OCR).
ALTER TABLE "documents" ADD COLUMN "parse_status" TEXT NOT NULL DEFAULT 'ready';
ALTER TABLE "documents" ADD COLUMN "parse_status_message" TEXT;
ALTER TABLE "documents" ADD COLUMN "parse_started_at" TIMESTAMP(3);
ALTER TABLE "documents" ADD COLUMN "parse_finished_at" TIMESTAMP(3);

CREATE INDEX "documents_project_id_parse_status_idx" ON "documents"("project_id", "parse_status");
