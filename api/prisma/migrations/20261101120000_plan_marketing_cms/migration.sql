-- Plan marketing copy for public pricing (CMS)
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "marketing" JSONB;
