# Account 4702 — TGL Properties / SCB (31 Dec 2019)

Corrected test pack for **Standard Chartered Bank** account `0100106024702`.

## Files to use in BRS

| File | Use |
|------|-----|
| `acct4702 cashbk.xlsx` | Upload as cash book **Receipts** and **Payments** (Sheet 2) |
| `acct 4702 bank statement.xlsx` | Upload as bank **Credits** and **Debits** (**Sheet 2 only**) |
| `acct 4702 brs.xlsx` | Manual answer key — **do not upload** |

## Do not upload

| File | Why |
|------|-----|
| `scb statement.xlsx` | Raw SCB export (Sheet 1, misaligned/glued rows). Same messy layout as Sheet 1 of the bank file. |
| Bank statement **Sheet 1** | Multiline glued cells — use **Sheet 2** (see note on Sheet 3). |

## Manual BRS targets

- Balance per bank: **GHS 540,206.03**
- Balance per cash book: **GHS 540,206.03**
- Fully reconciled (no timing differences in manual workbook)

## Automated local test

From repo root (API on `:9101`, Docker stack running):

```bash
BRS_TEST_EMAIL=firm@test.com BRS_TEST_PASSWORD='Test123!' node scripts/run-acct4702-test.mjs
```

This script prefers `file4702/` over legacy `testdataforacct4702/`.
