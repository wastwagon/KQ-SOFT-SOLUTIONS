-- Super-admin plan CMS: quarterly price, seats, export quota, feature flags.

ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "quarterly_ghs" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "bank_accounts" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "clean_exports_per_month" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "users_limit" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "features" JSONB;

UPDATE "plans" SET "quarterly_ghs" = ROUND("monthly_ghs" * 2.85) WHERE "slug" <> 'firm' AND "quarterly_ghs" = 0 AND "monthly_ghs" > 0;

UPDATE "plans" SET "bank_accounts" = 5, "clean_exports_per_month" = 5, "users_limit" = 1 WHERE "slug" = 'basic';
UPDATE "plans" SET "bank_accounts" = 10, "clean_exports_per_month" = 20, "users_limit" = 3 WHERE "slug" = 'standard';
UPDATE "plans" SET "bank_accounts" = 30, "clean_exports_per_month" = 60, "users_limit" = 5 WHERE "slug" = 'premium';
UPDATE "plans" SET "bank_accounts" = -1, "clean_exports_per_month" = -1, "users_limit" = -1, "quarterly_ghs" = 0 WHERE "slug" = 'firm';
