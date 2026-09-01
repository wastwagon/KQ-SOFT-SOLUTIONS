-- Persist Excel worksheet and column mapping after manual/auto map (fixes Sheet1 vs Sheet2 trap).
ALTER TABLE "documents" ADD COLUMN "excel_sheet_index" INTEGER;
ALTER TABLE "documents" ADD COLUMN "column_mapping" JSONB;
