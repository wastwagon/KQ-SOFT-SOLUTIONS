-- Phase 1: Document type enum + AuditLog has projectId (relation only in Prisma, no DB change for AuditLog)
-- Create enum for document type to enforce valid values
CREATE TYPE "DocumentType" AS ENUM ('cash_book_receipts', 'cash_book_payments', 'bank_credits', 'bank_debits');

-- Change documents.type from TEXT to DocumentType (existing data matches enum values)
ALTER TABLE "documents" ALTER COLUMN "type" TYPE "DocumentType" USING "type"::"DocumentType";
