-- Per-project Ghana BRS workbook netting (SaaS: shared team setting, not browser localStorage)
ALTER TABLE "projects" ADD COLUMN "workbook_netting_mode" TEXT NOT NULL DEFAULT 'inherit';
