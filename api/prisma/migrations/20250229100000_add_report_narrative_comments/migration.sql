-- Phase D: Report narrative and preparer/reviewer comments
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "report_narrative" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "preparer_comment" TEXT;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "reviewer_comment" TEXT;
