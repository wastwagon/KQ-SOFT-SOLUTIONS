-- Heal prod DBs where match-memory was marked applied but the table was never created.
-- Keep statements simple: Prisma db execute may wrap the file in one transaction; avoid
-- failing the whole create if the FK already exists or organizations naming differs.
CREATE TABLE IF NOT EXISTS "organization_match_memories" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GHS',
    "side_kind" TEXT NOT NULL,
    "amount_minor" INTEGER NOT NULL,
    "cash_book_fingerprint" TEXT NOT NULL,
    "bank_fingerprint" TEXT NOT NULL,
    "confirmation_count" INTEGER NOT NULL DEFAULT 1,
    "last_confirmed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "organization_match_memories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "omm_org_cur_side_amt_cash_bank_key"
  ON "organization_match_memories"("organization_id", "currency", "side_kind", "amount_minor", "cash_book_fingerprint", "bank_fingerprint");

CREATE INDEX IF NOT EXISTS "omm_org_cur_side_amt_idx"
  ON "organization_match_memories"("organization_id", "currency", "side_kind", "amount_minor");
