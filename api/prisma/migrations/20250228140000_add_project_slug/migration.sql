-- Add slug column (nullable initially for backfill). Table is "projects" (@@map).
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "slug" TEXT;

-- Backfill: generate slugs from names (lowercase, replace non-alphanumeric with hyphens)
UPDATE "projects" SET slug = COALESCE(
  NULLIF(
    LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(name), '[^a-zA-Z0-9\s]', '', 'g'), '\s+', '-', 'g')),
    ''
  ),
  id
) WHERE slug IS NULL;

-- Handle duplicates per org: append -2, -3, etc.
WITH ranked AS (
  SELECT id, slug, organization_id,
    ROW_NUMBER() OVER (PARTITION BY organization_id, slug ORDER BY created_at) AS rn
  FROM "projects"
)
UPDATE "projects" p
SET slug = CASE WHEN r.rn > 1 THEN r.slug || '-' || r.rn::text ELSE r.slug END
FROM ranked r WHERE p.id = r.id;

-- Make NOT NULL
ALTER TABLE "projects" ALTER COLUMN "slug" SET NOT NULL;

-- Unique per organization (Prisma @@unique([organizationId, slug]) on mapped table)
CREATE UNIQUE INDEX IF NOT EXISTS "projects_organization_id_slug_key" ON "projects"("organization_id", "slug");
