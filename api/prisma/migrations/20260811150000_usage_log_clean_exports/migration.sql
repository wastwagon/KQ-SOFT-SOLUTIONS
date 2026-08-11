-- Monthly meter for full Tools clean Excel/PDF exports (sample downloads do not count).
ALTER TABLE "usage_logs" ADD COLUMN IF NOT EXISTS "clean_exports_count" INTEGER NOT NULL DEFAULT 0;
