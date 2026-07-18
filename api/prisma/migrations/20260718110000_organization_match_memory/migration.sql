-- Organisation match memory: boost suggestions from confirmed pairs
CREATE TABLE "organization_match_memories" (
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

CREATE UNIQUE INDEX "organization_match_memories_organization_id_currency_side_kind_amount_minor_cash_book_fingerprint_bank_fingerprint_key"
  ON "organization_match_memories"("organization_id", "currency", "side_kind", "amount_minor", "cash_book_fingerprint", "bank_fingerprint");

CREATE INDEX "organization_match_memories_organization_id_currency_side_kind_amount_minor_idx"
  ON "organization_match_memories"("organization_id", "currency", "side_kind", "amount_minor");

ALTER TABLE "organization_match_memories"
  ADD CONSTRAINT "organization_match_memories_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
