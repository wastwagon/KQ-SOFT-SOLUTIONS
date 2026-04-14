# Testing upload flow with sample data

## Sample files (complex – both sides in one document)

- **`samples/cashbook_combined_Jan2025.csv`** – Cash book with both receipts and payments (columns: amt_received, amt_paid).
- **`samples/bank_statement_combined_Ecobank_Jan2025.csv`** – Bank statement with both Credit and Debit columns (Ecobank-style).

## 1. Start the BRS API

Make sure nothing else is using the API port (e.g. 9001). If 9001 is in use, set a different port:

```bash
# In api/
PORT=9002 npm run dev
```

Then set the API URL for the upload script and frontend (e.g. `VITE_API_URL=http://localhost:9002` in `web/.env` if using 9002).

**App URL:** The web app runs at **http://localhost:9100/** (not 5173 when using Docker or custom config).

## 2. Upload samples via command line

From the project root:

```bash
# Use default API http://localhost:9001 (or set VITE_API_URL / API_URL)
node scripts/upload-sample-docs.mjs

# Or target a specific project by slug (e.g. oceancyber-brs-2026)
node scripts/upload-sample-docs.mjs oceancyber-brs-2026
```

Login uses `premium@test.com` / `Test123!` (from seed). The script will:

- Log in
- Use the first existing project or create "OceanCyber BRS 2026"
- Upload the cash book file **twice** (as receipts and as payments – "Both")
- Upload the bank statement file **twice** (as credits and as debits – "Both")

So one combined document is used for both sides without splitting files manually.

## 3. Verify in the browser

1. Start the web app (or use Docker). App URL: **http://localhost:9100/**.
2. Log in as `premium@test.com` / `Test123!`.
3. Open the project used by the script.
4. **Upload step**: You should see "✓ 1 document(s) uploaded" (or more) for Cash book and for Bank statement, and the "Uploaded files" section listing the files.
5. **Map step**: Go to "2. Map". You should see four documents (cash book receipts, cash book payments, bank credits, bank debits). Map columns for each; the system can suggest mappings for the bank format.
6. **Reconcile**: Proceed to Reconcile to match and run the full flow.

## Optional: manual upload in the UI

Without running the script:

1. Open the project → Upload.
2. **Cash book**: Leave "Use as" on **Both (receipts + payments)**. Choose `samples/cashbook_combined_Jan2025.csv` → Upload.
3. **Bank statement**: Leave "Use as" on **Both (credits + debits)**. Optionally set Account name (e.g. Ecobank Main). Choose `samples/bank_statement_combined_Ecobank_Jan2025.csv` → Upload.

This tests the same "one document, both sides" flow via the UI.
