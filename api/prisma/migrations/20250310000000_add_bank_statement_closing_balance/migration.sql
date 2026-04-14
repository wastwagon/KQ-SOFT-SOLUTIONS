-- Add optional bank statement closing balance to projects for audit comparison
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "bank_statement_closing_balance" DECIMAL(18,2);
