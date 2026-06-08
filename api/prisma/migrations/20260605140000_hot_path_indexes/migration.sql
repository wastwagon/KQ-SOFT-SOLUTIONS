-- Hot-path indexes for report/reconcile project loads (non-breaking, online-safe).
CREATE INDEX IF NOT EXISTS "projects_organization_id_idx" ON "projects"("organization_id");
CREATE INDEX IF NOT EXISTS "transactions_document_id_idx" ON "transactions"("document_id");
CREATE INDEX IF NOT EXISTS "matches_project_id_idx" ON "matches"("project_id");
