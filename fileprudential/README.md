# fileprudential — Grace Baptist Academy, cash book 2 (not Prudential Bank)

Despite the folder name, these files are **Grace Baptist Academy** (Ecobank Madina), **BANK CASH BOOK 2**, as at **31 Aug 2018**. They are **not** Prudential Bank statements (`0091900180008` / `0091900183015`).

## Files

| File | Role |
|------|------|
| `cash book acct 2.xlsx` | Cash book (use **Sheet2** for mapping) |
| `bs acct 2.xlsx` | Bank statement for **Sep 2017 – Aug 2018** (upload this for the BRS) |
| `brs acct 2.xlsx` | Manual BRS — **do not upload** (answer key only) |
| `GRACE BAPTIST STATEMENT.pdf` | Full Ecobank statement **01-Jan-2015 → 31-Dec-2022** (reference / source PDF) |

## Manual BRS (as at 31/8/2018)

Bank closing **GHS 490.74** = cash book **GHS 490.74**. Fully reconciled (no unpresented / uncredited / bank-only).

## PDF review notes

- Bank: **Ecobank**, Madina Branch — **Grace Baptist Academy**
- Account in pack: **0055500330003** (also appears in narration)
- PDF period is **8 years**; `bs acct 2.xlsx` is the **cash-book-2 window** only
- On **31 Aug 2018**, PDF running balance = **490.74** (matches xlsx + manual BRS)
- App PDF auto-parse currently mis-tags this file as `prudential_pdf` and drops **credit** lines in-period — **keep using the xlsx** for the live project

## Create / verify project

```bash
API_URL=http://localhost:9101 BRS_TEST_EMAIL=firm@test.com \
  BRS_DATA_DIR=fileprudential \
  BRS_ACCT002_PROJECT_NAME='Grace Baptist Academy – Cash book 2 (fileprudential Aug 2018)' \
  node scripts/run-acct002-test.mjs
```

Project: http://localhost:9100/projects/grace-baptist-academy-cash-book-2-fileprudential-aug-2018
