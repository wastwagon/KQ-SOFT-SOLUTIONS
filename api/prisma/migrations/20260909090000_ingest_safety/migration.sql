-- Safe ingest metadata (checksum, locale, auto-map policy) and org import locale.
-- Existing rows stay null → previous Ghana DMY / US-decimal / no-checksum behaviour.

ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "ingest_meta" JSONB;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "import_locale" JSONB;
