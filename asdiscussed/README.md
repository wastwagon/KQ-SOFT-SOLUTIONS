# Lordship Insurance — asdiscussed test pack

Real client data for end-to-end BRS testing (Ecobank Tesano, Q1 2026).

## Best practice: two projects

Use **one project per bank account** — one cash book + one bank statement each. Do **not** put both cash books in a single project (the app merges all cash books in a project; bank accounts filter only the bank side).

| Project | Account | Cash book | Bank statement |
|---------|---------|-----------|----------------|
| **Lordship – Ecobank 9033 Q1 2026** | 1441001519033 | `LIBcashbk1 2026 1qtr.xlsx` | `1778163944552.pdf` |
| **Lordship – Ecobank 9035 Q1 2026** | 1441001519035 | `LIBcashbk2 2026 1qtr.xlsx` | `1778676142095.pdf` |

Dec 2025 BRS workpapers (reference only, do not upload):

- `2025 final brs for acct 901.xlsx` → **9033** (bank closing GHS 19,629.81 at 31-Dec-2025)
- `2025 final brs for acct 902.xlsx` → **9035** (bank closing GHS 34,122.05 at 31-Dec-2025)

## Test account (premium)

| Field | Value |
|--------|--------|
| Email | `asdiscussed@test.com` |
| Password | `Test123!` |
| Org | Lordship Insurance BRS Test (`test-asdiscussed`) |
| Plan | Premium |

Database for local dev: `postgresql://postgres:postgres@localhost:15440/brs_db` (container `kqsoft-brs-pg-fresh`).

## Run the stack

Port **9001** is often used by other apps. Use **9011** for the BRS API locally:

```bash
# Terminal 1 — API
cd api
PORT=9011 npm run dev

# Terminal 2 — Web
cd web
VITE_API_URL=http://localhost:9011 npm run dev
```

Log in with `asdiscussed@test.com` / `Test123!`.

## Upload both projects (CLI)

```bash
API_URL=http://localhost:9011 node scripts/upload-asdiscussed.mjs
```

Upload one account only:

```bash
API_URL=http://localhost:9011 node scripts/upload-asdiscussed.mjs 9033
API_URL=http://localhost:9011 node scripts/upload-asdiscussed.mjs 9035
```

Bank uploads default to **PDF** (fuller transaction count on Lordship FOP exports). Use `BRS_BANK_FORMAT=xlsx` for column-clean Excel if your export includes all rows.

**Auto-map on upload:** When column detection is confident (date + amount fields), the API maps transactions immediately after upload. The upload response includes `autoMap: { status: 'mapped', transactionCount }` or `skipped` with a reason. Set `AUTO_MAP_ON_UPLOAD=false` in `api/.env` to disable.

If auto-map skips (low confidence), apply mapping manually or via CLI:

```bash
API_URL=http://localhost:9011 node scripts/map-asdiscussed.mjs
```

Or in the UI: **Map** → **Apply suggested mapping to selected** (cash book maps automatically; bank maps Credit/Debit after Ecobank normalization).

## Manual workflow (per project)

1. Open **Lordship – Ecobank 9033 Q1 2026** or **9035 Q1 2026**.
2. **Upload** — cash book **Both**; bank statement **Both**; set account name/number for that account only.
3. **Map** — cash book: `DATE`, `DETAILS`, `AMT RECEIVED`, `AMT PAID`, `CHQ NO`. Bank: date, description, Payments, Deposits.
4. **Reconcile** → **Report** (single bank account per project; no account filter needed).

Delete the old combined project **Lordship Insurance – Q1 2026** if you created it earlier.

Q1 2026 files cover **Jan–Mar 2026**; 2025 BRS files are layout/benchmark only for December.
