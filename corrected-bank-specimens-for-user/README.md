# Corrected bank statement specimens (BRS upload-ready)

Exported: 2026-07-17T19:29:57.236Z

This folder packages every bank/cashbook specimen we fixed in the BRS platform. Each bank subfolder contains:

- **original/** — your source PDF or Excel file (unchanged)
- **parsed-excel/** — transaction table extracted by the BRS parser (what the system now reads on upload)

## How to compare

1. Open the **parsed-excel** file — this is the corrected transaction layout (dates, descriptions, debits, credits).
2. Compare totals in row 7–8 of the Excel export (sum debits / sum credits) against your PDF statement footers.
3. Upload the **original** file in BRS — it should auto-map without manual column mapping.

## Banks included

### Ecobank (Lordship) (`01-ecobank/`)
  - Bank statement acct 9033: 93 rows, debits/payments 509,114.29, credits/receipts 508,127.77 (ecobank_pdf)
  - Bank statement acct 9035: 101 rows, debits/payments 653,066.76, credits/receipts 623,843.99 (ecobank_pdf)
  - Cash book 1: 69 rows, debits/payments 135,070.35, credits/receipts 508,115.54 (excel)
  - Cash book 2: 79 rows, debits/payments 394,336.04, credits/receipts 315,825.47 (excel)
  - BRS summary acct 901: Reference BRS workbook — not a bank upload format
  - BRS summary acct 902: Reference BRS workbook — not a bank upload format

### NIB (`02-nib/`)
  - Bank statement PDF: 12 rows, debits/payments 40,976, credits/receipts 108,132.15 (nib_pdf)
  - NIB cash book (ERP G/L — different GL account from PDF): 16 rows, debits/payments 3,894.82, credits/receipts 49,168.5 (excel)

### ADB (`03-adb/`)
  - Call deposit statement: 59 rows, debits/payments 13,317,026.31, credits/receipts 13,626,604.73 (adb_pdf)
  - Purchase account statement: 51 rows, debits/payments 1,267,746.09, credits/receipts 1,267,746.09 (adb_pdf)
  - ERP cash book (GLPTLS1): 18 rows, debits/payments 13,323,810.34, credits/receipts 13,499,243.51 (excel)

### GCB (`04-gcb/`)
  - Republic House corporate statement: 292 rows, debits/payments 5,191,022.26, credits/receipts 5,208,032.26 (gcb_pdf)
  - Republic House cash book (ERP): 537 rows, debits/payments 1,292,812.38, credits/receipts 6,295,825.72 (excel)

### Absa (`05-absa/`)
  - Call deposit statement PDF: 8 rows, debits/payments 731,178,280.19, credits/receipts 731,178,282.19 (absa_pdf)
  - Call deposit statement Excel: 8 rows, debits/payments 731,178,280.19, credits/receipts 731,178,282.19 (excel)

### Bank of Africa (`06-bank-of-africa/`)
  - Bank statement xlsm: 17 rows, debits/payments 395,366.36, credits/receipts 406,040.29 (excel)
  - COCOBOD current xlsm: 17 rows, debits/payments 395,366.36, credits/receipts 406,040.29 (excel)

### UMB (`07-umb/`)
  - Cocoa Purchases statement PDF: 9 rows, debits/payments 61,965,360.36, credits/receipts 61,965,360.36 (umb_pdf)
  - UMB cleaned Excel (manual layout): 10 rows, debits/payments 61,965,360.36, credits/receipts 61,965,360.36 (excel)

### Standard Chartered (SCB) (`08-scb/`)
  - SCB statement raw: 841 rows, debits/payments 11,756,548.18, credits/receipts 12,296,754.21 (excel)
  - SCB statement cleaned: 841 rows, debits/payments 11,756,548.18, credits/receipts 12,296,754.21 (excel)

### TGL acct 4702 cash book (`09-tgl-acct4702/`)
  - TGL ERP cash book: 779 rows, debits/payments 12,296,754.21, credits/receipts 11,756,548.18 (excel)

### Prudential Bank (`10-prudential/`)
  - September 2023 statement: 284 rows, debits/payments 419,133,070.68, credits/receipts 428,126,625.12 (prudential_pdf)

### Lordship Ecobank 9033 Q1 2026 (`11-lordship-9033-q1-2026/`)
  - Cash book Q1 2026: 76 rows, debits/payments 149,188.06, credits/receipts 508,115.54 (excel)
  - Bank statement Q1 2026 (Excel upload): 95 rows, debits/payments 446,566.51, credits/receipts 577,610.55 (excel)
  - Bank statement Q1 2026 (PDF): 93 rows, debits/payments 509,114.29, credits/receipts 508,127.77 (ecobank_pdf)
  - Manual BRS workbook: Manual reconciliation target — compare platform report against this
  - Platform export snapshot: BRS platform output for comparison
  - Preparer questions PDF: Reference notes from manual review
  - Updated manual BRS (Jul 2026): Latest preparer workbook with pairing marks — same totals as prior manual BRS

### Lordship Ecobank 9035 Q1 2026 (`12-lordship-9035-q1-2026/`)
  - Cash book Q1 2026 (duplicates removed): 79 rows, debits/payments 394,336.04, credits/receipts 315,825.47 (excel) — Removed 0 duplicate payment row(s)
  - Bank statement Q1 2026 (Excel upload): 103 rows, debits/payments 392,423.85, credits/receipts 890,486.9 (excel)
  - Bank statement Q1 2026 (PDF): 101 rows, debits/payments 653,066.76, credits/receipts 623,843.99 (ecobank_pdf)
  - Manual BRS workbook: Manual reconciliation target — compare platform report against this
  - Platform export snapshot: BRS platform output for comparison
  - Updated manual BRS (Jul 2026): Latest preparer workbook — flags 3 duplicate cash-book payments removed on upload

### Bank of Ghana (BOG) (`13-bog/`)
  - COCOBOD operational account statement: 47 rows, debits/payments 5,812,737.69, credits/receipts 7,000,000 (excel)

### Account 002 test data (`14-acct002-test-data/`)
  - Cash book: 28 rows, debits/payments 0, credits/receipts 0 (excel)
  - Bank statement: 57 rows, debits/payments 23,580, credits/receipts 22,725 (excel)
  - Manual BRS: Reference manual BRS workbook
  - Platform export: BRS platform output for comparison
  - Platform export PDF: 139 rows, debits/payments 0, credits/receipts 0 (native_text)

### Account 4702 test data (`15-acct4702-test-data/`)
  - Bank statement: 841 rows, debits/payments 11,756,548.18, credits/receipts 12,296,754.21 (excel)
  - Cash book (copy): 779 rows, debits/payments 12,296,754.21, credits/receipts 11,756,548.18 (excel)
  - Manual BRS: Reference manual BRS workbook
  - Platform export: BRS platform output for comparison

### Account 430 test data (`16-acct430-test-data/`)
  - Bank statement: 10 rows, debits/payments 6,803.71, credits/receipts 220 (excel)
  - Cash book: 70 rows, debits/payments 55,170.67, credits/receipts 96,327.82 (excel) — includes euro/FC amount rows
  - Manual BRS: Reference manual BRS workbook
  - Platform export: BRS platform output for comparison

## Notes

- **Ecobank PDFs**: page-break duplicates removed; footer totals match exactly.
- **Lordship 9035 cash book**: 3 duplicate payment rows removed before upload (see `parsed-excel/*duplicates removed.xlsx`).
- **Cash books (TGL ERP / GLPTLS1)**: ERP exports normalized to AMT RECEIVED / AMT PAID columns.
- **NIB cash book**: ERP G/L export — different GL account from the NIB PDF specimen.
- **BRS / platform-export xlsx**: manual targets and platform snapshots for reconciliation comparison — not bank upload formats.
- **BOG**: Excel statement with glued overflow cells recovered by parser.

Generated by `scripts/export-corrected-specimens.mjs`
