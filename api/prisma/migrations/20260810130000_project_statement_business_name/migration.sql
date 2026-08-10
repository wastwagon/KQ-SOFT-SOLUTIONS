-- Optional statement business / account-holder name for BRS letterhead tracking.
-- Nullable: existing projects keep using organization name on reports.
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "statement_business_name" TEXT;
