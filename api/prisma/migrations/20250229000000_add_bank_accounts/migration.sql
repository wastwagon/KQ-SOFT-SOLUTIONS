-- Phase 11: Multi-bank — BankAccount model and bankAccountId on Document
CREATE TABLE "bank_accounts" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bank_name" TEXT,
    "account_no" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bank_accounts_project_id_idx" ON "bank_accounts"("project_id");

ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_project_id_fkey" 
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add bank_account_id to documents (nullable for backward compatibility)
ALTER TABLE "documents" ADD COLUMN "bank_account_id" TEXT;

CREATE INDEX "documents_bank_account_id_idx" ON "documents"("bank_account_id");

ALTER TABLE "documents" ADD CONSTRAINT "documents_bank_account_id_fkey" 
  FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
