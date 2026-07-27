-- Heal prod DBs where 20260718110000 was marked applied but the table was never created.
-- Idempotent: safe when the table already exists from a correct prior apply.
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organization_match_memories_organization_id_fkey'
  ) THEN
    ALTER TABLE "organization_match_memories"
      ADD CONSTRAINT "organization_match_memories_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
