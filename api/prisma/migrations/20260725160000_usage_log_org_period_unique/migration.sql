-- Deduplicate usage_logs (keep highest counters per org+period), then enforce uniqueness.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY organization_id, period
      ORDER BY projects_count DESC, transactions_count DESC, created_at DESC, id DESC
    ) AS rn
  FROM usage_logs
)
DELETE FROM usage_logs
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

CREATE UNIQUE INDEX "usage_logs_organization_id_period_key" ON "usage_logs"("organization_id", "period");
