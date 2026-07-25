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

-- Short names: Postgres truncates identifiers to 63 chars; the default Prisma
-- names for these two indexes collide after truncation.
CREATE UNIQUE INDEX "omm_org_cur_side_amt_cash_bank_key"
  ON "organization_match_memories"("organization_id", "currency", "side_kind", "amount_minor", "cash_book_fingerprint", "bank_fingerprint");

CREATE INDEX "omm_org_cur_side_amt_idx"
  ON "organization_match_memories"("organization_id", "currency", "side_kind", "amount_minor");

ALTER TABLE "organization_match_memories"
  ADD CONSTRAINT "organization_match_memories_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
