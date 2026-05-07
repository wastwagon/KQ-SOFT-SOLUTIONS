# BRS Demo Flow

This script creates a new project with sample data containing **doc_ref**, **chq_no**, and all required columns, then uploads and maps the documents.

## Prerequisites

1. **Database**: Ensure PostgreSQL is running and `DATABASE_URL` is set in `api/.env`
2. **API**: The BRS API must be running on port 9001

## Qtest / LICL workbook pack (root `new-test-data/`)

Uses **`Qtestcash book.xlsx`** and **`Qtestbank statement.xlsx`**. Golden template figures (4,566.86 / 4,000 / 5,400 / 833.14 / 0 → 4,000) are recorded in **`new-test-data/qtest-licl-golden.json`**.

- **Lock / regression:** from `api/`, run `npm run test:licl-qtest`.
- **Demo upload + map (API must be running):** from repo root, `npm run demo:flow:qtest`. Then reconcile in the UI to match the workbook; the JSON above is the target BRS line totals.

## Quick Start

### Terminal 1 – Start the API

```bash
cd api
npm run dev
```

### Terminal 2 – Run the demo flow

```bash
# From project root
npm run demo:flow
```

Or directly:

```bash
./scripts/run-full-flow.sh
```

## What the script does

1. Seeds the database (creates test user `admin@kqsoftwaresolutions.com` / `Test123!`)
2. Logs in and creates a new project
3. Uploads `sample_data/cashbook_full.csv` as receipts and payments
4. Uploads `sample_data/bank_statement_full.csv` as credits and debits
5. Maps all documents with correct column indices (including `doc_ref`, `chq_no`)

## Sample data

- **`sample_data/cashbook_full.csv`** – Cash book with `doc_ref` (INV-001, PO-002, etc.) and `chq_no` (CHQ 1925, CHQ 1926, etc.)
- **`sample_data/bank_statement_full.csv`** – Bank statement (Ecobank format); `chq_no` is extracted from descriptions

## After the script

1. Open the web UI: `http://localhost:9100`
2. Log in with `admin@kqsoftwaresolutions.com` / `Test123!`
3. Open the created project
4. Go to **Reconcile** to match transactions
5. Go to **Review** then **Report** to generate the BRS

## Troubleshooting

- **Login failed**: Ensure the BRS API is running (`cd api && npm run dev`)
- **Port in use**: Stop any process on port 9001 or set `API_URL` (e.g. `API_URL=http://localhost:9002 ./scripts/run-full-flow.sh`)
