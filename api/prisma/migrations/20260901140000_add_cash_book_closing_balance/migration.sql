-- Optional declared cash book closing balance (as-per-IBIS / manual BRS)
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "cash_book_closing_balance" DECIMAL(18,2);
