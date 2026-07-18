-- Organisation layout memory: remember successful document column mappings
CREATE TABLE "document_layout_memories" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "document_type" "DocumentType" NOT NULL,
    "header_fingerprint" TEXT NOT NULL,
    "header_signature" JSONB NOT NULL,
    "field_mapping" JSONB NOT NULL,
    "parse_method_hint" TEXT,
    "use_count" INTEGER NOT NULL DEFAULT 1,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_layout_memories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "document_layout_memories_organization_id_document_type_header_fingerprint_key"
  ON "document_layout_memories"("organization_id", "document_type", "header_fingerprint");

CREATE INDEX "document_layout_memories_organization_id_document_type_idx"
  ON "document_layout_memories"("organization_id", "document_type");

ALTER TABLE "document_layout_memories"
  ADD CONSTRAINT "document_layout_memories_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
