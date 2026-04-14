-- CreateTable
CREATE TABLE "brs_attachments" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "filepath" TEXT NOT NULL,
    "mime_type" TEXT,
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brs_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brs_attachments_project_id_idx" ON "brs_attachments"("project_id");

-- AddForeignKey
ALTER TABLE "brs_attachments" ADD CONSTRAINT "brs_attachments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brs_attachments" ADD CONSTRAINT "brs_attachments_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
