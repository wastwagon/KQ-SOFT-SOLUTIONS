-- Add slug column (nullable initially for backfill)
ALTER TABLE "Project" ADD COLUMN "slug" TEXT;

-- Backfill: generate slugs from names (lowercase, replace non-alphanumeric with hyphens)
UPDATE "Project" SET slug = COALESCE(
  NULLIF(
    LOWER(REGEXP_REPLACE(REGEXP_REPLACE(TRIM(name), '[^a-zA-Z0-9\s]', '', 'g'), '\s+', '-', 'g')),
    ''
  ),
  id
);

-- Handle duplicates per org: append -2, -3, etc.
WITH ranked AS (
  SELECT id, slug, organization_id,
    ROW_NUMBER() OVER (PARTITION BY organization_id, slug ORDER BY created_at) AS rn
  FROM "Project"
)
UPDATE "Project" p
SET slug = CASE WHEN r.rn > 1 THEN r.slug || '-' || r.rn ELSE r.slug END
FROM ranked r WHERE p.id = r.id;

-- Make NOT NULL
ALTER TABLE "Project" ALTER COLUMN "slug" SET NOT NULL;

-- Add unique constraint
CREATE UNIQUE INDEX "Project_organizationId_slug_key" ON "Project"("organizationId", "slug");
