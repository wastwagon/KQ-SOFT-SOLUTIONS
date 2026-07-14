# Mapping & Matching Transactions — User Guide

**Product:** KQ Bank Reconciliation System (BRS)  
**Company:** KQ SOFT SOLUTIONS  
**Audience:** Preparers, reviewers, and trainers  
**Updated:** June 2026

This guide explains how to **map** uploaded files to the correct columns and **match** cash book lines to bank statement lines. It is the detailed companion to the main [User Manual](../web/public/user-manual.md).

---

## Table of contents

1. [Before you start](#1-before-you-start)
2. [Key concepts](#2-key-concepts)
3. [Step 2 — Map columns](#3-step-2--map-columns)
4. [Step 3 — Match transactions](#4-step-3--match-transactions)
5. [What to leave unmatched](#5-what-to-leave-unmatched)
6. [Bank rules (Standard plan and above)](#6-bank-rules-standard-plan-and-above)
7. [Plan features for mapping & matching](#7-plan-features-for-mapping--matching)
8. [Troubleshooting](#8-troubleshooting)
9. [Quick reference](#9-quick-reference)
10. [Glossary](#10-glossary)

---

## 1. Before you start

Mapping and matching happen **after Upload** in every project:

| Step | What you do |
|------|-------------|
| **Upload** | Add cash book and bank statement files |
| **Map** | Tell the system which column is Date, Amount, Description, etc. |
| **Reconcile** | Link cash book rows to bank rows |
| **Review** | Check exceptions and variance |
| **Report** | Generate the Bank Reconciliation Statement (BRS) |

### Prepare your files

Good source data makes mapping and matching much easier:

- Use **one reporting period** per project (e.g. January 2026 only).
- Prefer **Excel (.xlsx)** or **CSV** for highest accuracy. PDF and scanned images are supported but may need more review.
- Keep **dates** and **amounts** in dedicated columns.
- Put **cheque numbers** and **references** in their own columns when possible.
- Avoid duplicate header rows inside the data.
- For bank statements that contain **both credits and debits in one file**, upload as **Both** on the Upload step — you do not need to split the file manually.

---

## 2. Key concepts

### Cash book vs bank statement

| Term | Meaning | Match to |
|------|---------|----------|
| **Cash book receipts** | Money your business recorded as received | **Bank credits** |
| **Cash book payments** | Money your business recorded as paid (e.g. cheques issued) | **Bank debits** |
| **Bank credits** | Money the bank credited to your account | Cash book receipts |
| **Bank debits** | Money the bank debited from your account | Cash book payments |

### Mapping vs matching

- **Mapping** — One-time column setup. You tell the system: “Column C is Date, Column F is Amount Received.” The system then extracts a table of transactions from each file.
- **Matching** — Ongoing reconciliation work. You link an extracted cash book row to the corresponding bank row (or leave it unmatched as an exception on the BRS).

### Document types (logical streams)

Even when you upload one physical file, the system may store it as separate logical documents:

| Type | Used for |
|------|----------|
| `cash_book_receipts` | Receipt / income rows |
| `cash_book_payments` | Payment / expense rows |
| `bank_credits` | Credits on the bank statement |
| `bank_debits` | Debits on the bank statement |

If you uploaded a cash book as **Both**, you will see two documents to map — one for receipts (`amt_received`) and one for payments (`amt_paid`). Same idea for bank **Both** → credits and debits documents.

---

## 3. Step 2 — Map columns

Open your project → **Map** tab.

### What the Map step does

1. Reads your uploaded file (spreadsheet, PDF, or image).
2. Detects column headers (Date, Amount, Credit, Debit, etc.).
3. Suggests how each column maps to standard fields.
4. Extracts transactions you can match in Reconcile.

> **Required:** Every document must have a **date** column mapped. Without a date, matching cannot run reliably.

### Fast path — bulk apply

For most monthly reconciliations:

1. Review the **Bulk apply — which files?** panel.
2. Leave all files ticked (new uploads are ticked automatically).
3. Click **Apply suggested mapping to selected**.
4. Check the summary (transaction count, warnings).
5. Click **Proceed to Reconcile**.

The system picks the best Excel worksheet automatically when a workbook has multiple tabs (the sheet with date + amount columns).

### Individual mapping (when you need to adjust)

1. Under **Or select a document to map or adjust**, choose a file.
2. Review the **preview table** (first few rows and column indices).
3. For each **canonical field**, pick the matching source column from the dropdown.
4. Read any **Fix required / Check / Tip** messages.
5. Click **Apply mapping**.

Confidence labels (**high**, **medium**, **low**) show how sure the system is about each field mapping.

### Fields to map — cash book

| Field | Label in app | Required? | Notes |
|-------|--------------|-----------|-------|
| `date` | Date | **Yes** | Excel serial dates (e.g. 46023) are converted automatically |
| `amt_received` | Amount received | Yes for receipts doc | Map for `cash_book_receipts` |
| `amt_paid` | Amount paid | Yes for payments doc | Map for `cash_book_payments` |
| `name` | Name | Optional | Payer / payee |
| `details` | Details | Optional | Particulars / narrative |
| `doc_ref` | Doc ref | Optional | Document reference |
| `chq_no` | Cheque no. | Optional | Strongly recommended for cheque matching |
| `accode` | Account code | Optional | Chart of accounts code |

### Fields to map — bank statement

| Field | Label in app | Required? | Notes |
|-------|--------------|-----------|-------|
| `transaction_date` | Transaction date | **Yes** | |
| `credit` | Credit | Yes for credits doc | Map for `bank_credits` |
| `debit` | Debit | Yes for debits doc | Map for `bank_debits` |
| `description` | Description | Recommended | Improves match suggestions; cheque numbers can be read from text |

### Signed amount mode (one amount column)

If your file uses **one column** for both sides (positive = receipt/credit, negative = payment/debit):

- Map the **same column** to both amount fields (e.g. both `amt_received` and `amt_paid`, or both `credit` and `debit`).
- The app shows a **Signed amount mode** notice.
- Positive values → receipts / credits; negative values → payments / debits.

This is common in accounting exports with a single “Amount” column.

### Ghana bank auto-detection

For supported banks, the system may:

- Detect the bank format automatically (green badge on preview).
- Suggest normalized column mappings.
- Apply mapping on upload when confidence is medium or high.

**Supported banks include:** Ecobank, GCB, Standard Chartered (SCB), NIB, ADB, Bank of Africa, Bank of Ghana (BOG), Prudential, UMB, Access, Stanbic, Fidelity, UBA, and Absa. See [Supported Ghana Banks](../docs/SUPPORTED_BANKS.md) for column layouts.

**Ecobank tip:** If you see Payments/Deposits layout, prefer Excel exports. Map **Debit** for the bank debits document and **Credit** for the bank credits document (Payments → Debit, Deposits → Credit after normalization).

**SCB tip:** Excel exports use ENTRY DATE, VALUE DATE, DEBITS, CREDITS. We prefer **Value Date** for transaction date. Description drives INW CLG / sweep matching in Reconcile.

**BOG tip:** Map **Post Date** for transaction date.

**GCB tip:** PDF uploads are normalized to Transaction Date, Description, Debit, Credit — map those columns for credits/debits documents.

**ERP cash book tip:** Large G/L exports (Doc. Date, Debits, Credits) may contain hundreds of rows — map Doc. Date and amount columns; filter to your bank account in the source system when possible.

### After mapping — read the results

| Message | Meaning |
|---------|---------|
| **X transaction(s) extracted** | Mapping succeeded |
| **Sign warnings** | Some amounts have unexpected signs (e.g. negative in a receipts column) — review preview |
| **Skipped duplicate rows** | Identical date + amount + narrative rows were deduplicated |
| **Skipped zero-amount rows** | Empty or zero lines ignored |
| **PDF truncation** | Only the first N pages were processed — split the PDF or raise the page limit |
| **Some files have no extracted transactions** | That document still needs mapping or contains no data |

**Sign summary buckets:**

| Bucket | Meaning |
|--------|---------|
| Primary | Expected sign for this document type |
| Cross-ref | Opposite sign (may be valid in signed-amount mode) |
| Zero | Zero amount |
| Empty | Missing amount |

When mapping is complete for all files, click **Proceed to Reconcile**.

---

## 4. Step 3 — Match transactions

Open your project → **Reconcile** tab.

### Choose your view

Use the tabs at the top:

| View | When to use |
|------|-------------|
| **Receipts vs Credits** | Match money received in cash book to bank credits |
| **Payments vs Debits** | Match money paid in cash book to bank debits |
| **Cash book (all)** | Overview only — **switch to Receipts or Payments to match** |

If you have multiple bank accounts, use the **bank account** dropdown to filter.

### How matching works

Each match links:

- One or more **cash book** transaction(s) on one side, and  
- One or more **bank** transaction(s) on the other side.

| Match type | Selection | Plan |
|------------|-----------|------|
| **1-to-1** | 1 cash book + 1 bank | All plans |
| **1-to-many** | 1 cash book + 2+ bank | Premium+ |
| **Many-to-1** | 2+ cash book + 1 bank | Premium+ |
| **Many-to-many** | 2+ cash book + 2+ bank | Premium+ |

A matched row cannot be matched again until you **unmatch** it.

### Manual matching (step by step)

1. Switch to **Receipts vs Credits** or **Payments vs Debits**.
2. Click a **cash book** row to select it.
3. Click the corresponding **bank** row.
4. A floating bar appears: **X Book ↔ Y Bank**.
5. Click **Confirm Match**.

Rows with a 🔗 icon have suggested matches — hover for details.

### Suggested matches

The **Suggested matches** panel lists likely pairs the system found using amount, date, reference, and cheque number.

**To use a suggestion:**

- **Click** a suggestion to pre-select both rows, then **Confirm Match**, or  
- **Tick** suggestions and use bulk actions (Standard plan and above).

**Matching Settings** (gear icon) control how suggestions are generated:

| Preset | Amount | Date | Reference | Cheque no. |
|--------|--------|------|-----------|------------|
| **Strict** | ✓ | ✓ | ✓ | ✓ |
| **Amount + Date** | ✓ | ✓ | | |
| **Amount only** | ✓ | | | |

- Start with **Strict** for cheques and high-value items.
- Use **Amount + Date** when references differ between cash book and bank.
- Use **Amount only** only as a last resort — review every match carefully.

Settings are saved per project in your browser.

### Bulk and auto actions (Standard plan and above)

| Button | What it does |
|--------|----------------|
| **Auto-match all (safe → Ecobank)** | Applies high-confidence matches in phases (90%+ safe, then Ecobank/receipt 85%+) |
| **Match high confidence (95%+)** | Bulk-applies only very confident suggestions |
| **Match selected** | Applies ticked suggestions |
| **Match all visible** | Applies all suggestions in the list (review carefully) |

Bulk match is limited to **50 pairs** per action. Ambiguous pairs (e.g. duplicate cheque numbers) are skipped.

### Split suggestions (Premium plan and above)

**Split suggestions** appear when several cash book lines likely belong to one bank deposit (or vice versa). Click a card to select the whole group, then **Confirm Match**.

### Confirmed matches

The **Confirmed matches** panel lists pairs you have already linked. From here you can:

- **Unmatch** — remove a single incorrect pairing  
- **Clear all** — remove all matches (use with care)  
- **Upload evidence** — attach a supporting file to a match (e.g. remittance advice)

### Ecobank Ghana tips

When the Ecobank Ghana BRS profile is active:

- Clearing matches use a wider **date window**.
- Prefer suggestions tagged **Clearing**, **Transfer**, or **Withdrawal** before generic payment↔debit pairs.
- Inward clearing / HSE deposits appear as bank **credits** — look for **Clearing** suggestions.

### Best practice for cheques

- Match cheques only when **amount** matches (and **reference/cheque number** when available).
- If you see **duplicate cheque numbers** in the cash book warning, match each row individually — do not bulk-match ambiguous pairs.

### When you are done

Click **Proceed to Review** to check unmatched items and variance before generating the report.

Expand **What do these terms mean?** on the Reconcile page for in-app help on unmatched causes.

---

## 5. What to leave unmatched

Not every row should be matched in the current period. These are **normal exceptions** on the BRS:

| Exception | What it is | What to do |
|-----------|------------|------------|
| **Uncredited lodgments** | Receipt in cash book, not yet on bank statement | Leave unmatched — BRS adds it to bank balance |
| **Unpresented cheques** | Payment in cash book, cheque not yet presented | Leave unmatched — BRS deducts from bank balance |
| **Bank charges / interest** | On bank statement, not in cash book | Enter in cash book and re-map, or note on BRS |
| **Direct credits** | On bank statement, not in cash book | Add receipt to cash book, re-upload/map, then match |
| **Timing differences** | Same transaction, different dates across period end | Match if visible in this or next statement |

---

## 6. Bank rules (Standard plan and above)

**Settings → Bank rules** lets admins and reviewers define automatic behaviour:

| Setting | Options |
|---------|---------|
| **Condition** | e.g. Description **contains** `SALARY` |
| **Action** | Suggest match, or Flag for review |
| **Priority** | Higher number runs first |

Rules influence suggestions during Reconcile — they do not replace your review for high-risk items.

---

## 7. Plan features for mapping & matching

| Feature | Basic | Standard | Premium | Firm |
|---------|-------|----------|---------|------|
| Column mapping | ✓ | ✓ | ✓ | ✓ |
| 1-to-1 manual match | ✓ | ✓ | ✓ | ✓ |
| Suggested matches | | ✓ | ✓ | ✓ |
| Bulk match | | ✓ | ✓ | ✓ |
| Auto-match (phased) | | ✓ | ✓ | ✓ |
| Bank rules | | ✓ | ✓ | ✓ |
| 1-to-many / many-to-many | | | ✓ | ✓ |
| Split suggestions | | | ✓ | ✓ |
| Match evidence upload | | ✓ | ✓ | ✓ |

If a feature is greyed out or shows an upgrade notice, your organisation’s plan does not include it.

---

## 8. Troubleshooting

### Mapping

| Problem | Likely cause | Fix |
|---------|--------------|-----|
| No transactions extracted | Wrong worksheet, wrong amount column, or PDF truncation | Pick correct Excel tab; re-map amount fields; split PDF |
| “Date column is required” | Date not mapped | Map `date` or `transaction_date` |
| Wrong receipts/payments split | Signed amount or wrong column | Use signed amount mode or map correct amt_received / amt_paid |
| Ecobank debits/credits swapped | Payments/Deposits layout | Map Debit on debits doc, Credit on credits doc |
| Mapped MONTH instead of DATE | Wrong column selected | Map the DATE column (often Excel serial numbers) |
| Far fewer rows than expected | Duplicates skipped, zero amounts, footer rows | Check import stats in mapping summary |

### Matching

| Problem | Likely cause | Fix |
|---------|--------------|-----|
| No suggestions | Standard plan required; or settings too strict | Upgrade plan or relax Matching Settings |
| Too many wrong suggestions | Amount-only mode too broad | Use Strict or Amount + Date |
| Cannot match in Cash book (all) view | Matching disabled in overview | Switch to Receipts or Payments view |
| “Already matched” error | Row linked in another pair | Unmatch first, or pick a different row |
| Cheque won’t match | Different amount or reference on bank | Verify mapping; check bank description for truncated cheque no. |
| Duplicate cheque warning | Same chq no. on multiple rows | Match individually, not bulk |

### Data quality

| Problem | Fix |
|---------|-----|
| Amounts don’t match | Re-check mapping; verify currency and decimal format |
| Dates off by one day | Normal near month-end — use Amount + Date mode |
| Missing bank lines | Confirm full statement uploaded and PDF not truncated |

---

## 9. Quick reference

### Map — minimum required fields

**Cash book receipts:** `date` + `amt_received`  
**Cash book payments:** `date` + `amt_paid`  
**Bank credits:** `transaction_date` + `credit`  
**Bank debits:** `transaction_date` + `debit`

### Reconcile — typical monthly workflow

1. **Receipts vs Credits** → match or leave lodgments unmatched  
2. **Payments vs Debits** → match or leave unpresented cheques unmatched  
3. Review **Suggested matches** with **Strict** settings first  
4. Use **Auto-match all** for remaining safe pairs (Standard+)  
5. Manually match exceptions  
6. **Proceed to Review**

### Keyboard / selection tips

- Click rows to toggle selection  
- Use **Clear** on the floating bar to deselect  
- Filter by bank account when reconciling multiple accounts  

---

## 10. Glossary

| Term | Definition |
|------|------------|
| **Mapping** | Assigning source file columns to system fields (Date, Amount, etc.) |
| **Matching** | Linking a cash book transaction to a bank transaction |
| **Canonical fields** | Standard field names the system uses internally |
| **Uncredited lodgment** | Receipt recorded in cash book, not yet on bank statement |
| **Unpresented cheque** | Payment recorded in cash book, cheque not yet debited by bank |
| **Signed amount mode** | One column holds both positive and negative amounts |
| **Confidence** | How likely a suggested match is correct (0–100%) |
| **BRS** | Bank Reconciliation Statement — final report |

---

## Training checklist (for team leads)

Use this when onboarding preparers:

- [ ] Upload sample cash book as **Both** and bank statement as **Both**
- [ ] Complete **bulk apply** mapping on first run
- [ ] Re-map one document individually and read mapping issues
- [ ] Match 5 receipt↔credit pairs manually
- [ ] Match 5 payment↔debit pairs manually
- [ ] Try **Strict** vs **Amount + Date** matching settings
- [ ] Leave one lodgment and one unpresented cheque unmatched
- [ ] Unmatch and re-match one pair
- [ ] Proceed to Review and confirm exceptions appear correctly

---

*For the full platform guide (upload, review, report, settings, billing), see the [User Manual](/user-manual.md) in the app under **User Manual** in the navigation menu.*
