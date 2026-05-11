-- Link evidence uploads to matches (schema BrsAttachment.matchId).
ALTER TABLE "brs_attachments" ADD COLUMN "match_id" TEXT;

CREATE INDEX "brs_attachments_match_id_idx" ON "brs_attachments"("match_id");

ALTER TABLE "brs_attachments" ADD CONSTRAINT "brs_attachments_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
