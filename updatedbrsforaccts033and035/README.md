# Updated BRS — accounts 9033 & 9035

Manual workbook updates (Jul 2026) for the two Lordship Ecobank Q1 2026 projects.

## File → project mapping

| Updated file | Account | Data folder | Platform project | Test script |
|--------------|---------|-------------|------------------|-------------|
| `Account901 brs as at31.3.2026 updated.xlsx` | **Ecobank 1441001519033** (acct **033**) | `accountno552records/` | `Lordship – Ecobank 9033 Q1 2026 (accountno552)` | `scripts/run-accountno552-test.mjs` |
| `Account902 brs as at 31.3.2026 updated.xlsx` | **Ecobank 1441001519035** (acct **035**) | `accountno095details/` | `Lordship – Ecobank 9035 Q1 2026 (accountno095)` | `scripts/run-accountno095-test.mjs` |

Supporting source files (unchanged in this drop):

| Account | Cash book | Bank statement |
|---------|-----------|----------------|
| 9033 | `accountno552records/LIBcashbk1 2026 1qtr.xlsx` | `accountno552records/1778163944552 dated 4.6.26.xlsx` |
| 9035 | `accountno095details/LIBcashbk2 2026 1qtr.xlsx` | `accountno095details/1778676142095 dated 4.6.26.xlsx` |

## What changed in the updated workbooks

Both files add preparer annotations (** pairing marks, √ verified lines, ?? intermediate workbook steps). **Summary BRS totals are unchanged** from the prior manual targets.

### 9033 (Account901)

- Unpresented section (4 cheques): **8,000.26**
- Final BRS unpresented (with workbook Groups 2–3 netting): **10,660.97**
- Bank closing **18,643.29**, cash book **378,557.29**, bank-only debits **374,054.70**, bank-only credits **3,479.73**

### 9035 (Account902)

- Three cash-book payments marked **“duplication. Delete in cash book”** (Helina, Fred-Leon, Cocobod formal lines). The hyphen narration rows are kept and pair to bank clearing (**).
- Unpresented **2,623.18**, bank closing **4,899.28**, cash book **-63,299.04**, bank-only debits **236,614**, bank-only credits **311,018.52**

## Cleaned Excel outputs (project-ready)

Run:

```bash
node scripts/clean-specimen-bank-statements.mjs
```

| Output file | Source | Sheet2 for mapping |
|-------------|--------|-------------------|
| `scb statement - cleaned.xlsx` | `scb statement.xlsx` | ENTRY DATE, VALUE DATE, DESCRIPTION, DEBITS, CREDITS, BALANCE |
| `umb 1110005147028 statement - cleaned.xlsx` | UMB PDF | Same layout |

Each cleaned workbook has:
- **Sheet1** — statement header + transactions (human-readable)
- **Sheet2** — header row + transactions only (use this sheet when uploading, like acct4702 `BANK_SHEET_INDEX = 1`)


1. Copied updated BRS into each data folder (replacing `Account901…` / `Account902…`).
2. `scripts/lib/parse-manual-brs-xlsx.mjs` — reads manual targets from those workbooks.
3. `scripts/lib/clean-9035-cashbook.mjs` — removes the three duplicate 9035 payment rows before upload.
4. Test scripts load `MANUAL` from the updated xlsx instead of hard-coded numbers.

## Verify (when API + DB are running)

```bash
# 9033 first
API_URL=http://localhost:9101 node scripts/run-accountno552-test.mjs

# 9035 second (cleans cash book, then uploads/maps/matches)
API_URL=http://localhost:9101 node scripts/run-accountno095-test.mjs
```

For an existing 9035 project that already has documents uploaded, delete the project or clear documents before re-running so the cleaned cash book is imported.
