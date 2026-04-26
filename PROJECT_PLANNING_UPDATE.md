# Bank Reconciliation SaaS — Project Planning Update
## KQ-SOFT SOLUTIONS LIMITED | Ghana | World-Class Vision

**Last Updated:** February 2026  
**Status:** Planning Phase

---

## Part 1: Excel Files — Thorough Review (Real Manual Records)

### 1.1 BRRSAMPLE.xlsx — Bank Reconciliation OUTPUT Report

**Purpose:** This is the *output* of a completed bank reconciliation — the professional report KQ-SOFT delivers to clients.

| Section | Content | Column Structure |
|--------|---------|------------------|
| **Header** | Company: LORDSHIP INSURANCE COMPANY LIMITED | — |
| | Bank Reconciliation Statement as at 31-Dec-2025 | — |
| | ECOBANK TESANO Account No: 1441001519035 | — |
| **Closing balance** | Balance per bank statement | GH₵ 34,122.05 |
| **Uncredited lodgments** | Deposits in cash book not yet on bank | DATE \| NAME/DETAILS \| DOC REF \| AMT RECEIVED |
| **Unmatched receipts in cash book** | Cash book entries with no bank match | Same structure |
| **Unmatched credits in bank statement** | Bank credits not in cash book | Transaction Date \| Description \| Credit |
| **Unpresented cheques** | Cheques issued, not yet cleared | DATE \| NAME-DETAILS \| CHQ NO \| AMT PAID |
| **Unmatched payments in cash book** | Cash book payments not on bank | Same as unpresented |
| **Balance per cash book** | Final cash book balance | GH₵ 24,101.84 |

**Key observations:**
- Sections use different header variants (e.g. "NAME / DETAILS" vs "NAME - DETAILS")
- S/NO used in Sheet2
- Totals: Unpresented cheques total GH₵30,156.99; Unmatched payments total -GH₵112.11
- Real Ghana payees: Philip Akuffo, Emmanuel Tetteh, ECG, GRA, Alex Avorkpo, Helina Yeboah, Glico, David Afodoanyi, etc.
- Real cheque numbers: 001893, 001957, 002037, 002038, 002050, etc.

---

### 1.2 BRRsample2.xlsx — Source Data (Cash Book + Bank Statement INPUTS)

This file represents the *inputs* KQ-SOFT uses before reconciliation.

#### Sheet 1: MATCHED RECEIPTS IN CASH BOOK

| Column | Header | Sample Values |
|--------|--------|---------------|
| A | DATE | 2025-01-06, 2025-01-10, 2025-01-13 |
| B | NAME | (often blank; detail in C) |
| C | DETAILS | "Enterprise Life Assurance / Commissions received via transfer" |
| D | DOC REF | (reference) |
| E | CHQ NO | "REDDEMED" (for T-Bills), cheque numbers |
| F | ACCODE | 1020 (commission), 4300, 3000 (T-Bills) |
| G | AMT RECEIVED | 29584.84, 128, 93462 |
| … | dr/cr status, count | Matching metadata |

**Ghana transaction types observed:**
- Insurance commissions (Enterprise, Star, Glico, Hollard, Loyalty, Vanguard, etc.)
- GIPS mobile transfer (Ameyaw Boadu)
- 182-DAY T-Bills (Ecobank)
- Cheque deposits (Access, OMNI, CBG, ADB, GCB, Prudential bank cheques)

#### Sheet 2: MATCHED CREDITS IN BANK STATEMENT

| Column | Header | Sample Values |
|--------|--------|---------------|
| A | Transaction Date | 2025-01-06 |
| B | Description | "FUNDS TRANSFER - INWARD GHAAO00625HWE6R trf b/o 1/ENTERPRISE LIFE ASSURANCE COMPANY..." |
| C | (blank) | |
| D | Credit | 29584.84 |

**Bank statement description formats (Ecobank):**
- `FUNDS TRANSFER - INWARD` + reference
- `OTHER BANKS INWARD TRANSFER ACH`
- `TREASURY BILLS MATURED 182-DAY Bill`
- `MOBILE TRANSFER RRN:xxx-GIP INCOMING B/O [name]`
- `CHEQUE CLEARING - OUTWARD LCY [Bank] CHQ# [no]`
- `JOURNAL ENTRY - NON COT`
- `STAFF SALARIES - PAYMENT OVERRIDING COMMISSION`

#### Sheet 3 & 4: MATCHED DEBITS (Cash Book Payments ↔ Bank Withdrawals)

| Cash Book | Bank Statement |
|-----------|----------------|
| DATE, NAME, DETAILS, DOC REF, CHQ NO, ACCODE, AMT PAID | Transaction Date, Description, Debit |

**Ghana banks referenced:** Ecobank, Access, OMNI, CBG, ADB, GCB, Prudential, Consolidated Bank

---

## Part 2: Ghana-Based Cash Book & Bank Statement Structures (Real Data, No Placeholders)

### 2.1 Canonical Cash Book Schema (Derived from KQ-SOFT Data)

```
CASH BOOK — RECEIPTS (Credits)
─────────────────────────────────────────────────────────────────
| S/NO | DATE       | NAME           | DETAILS                    | DOC REF | CHQ NO | ACCODE | AMT RECEIVED |
|------|------------|----------------|----------------------------|---------|--------|--------|--------------|
| 1    | 2025-01-06 | Enterprise Life| Commissions via transfer   |         |        | 1020   | 29,584.84    |
| 2    | 2025-01-15 | Ameyaw Boadu   | GIPS transfer              |         |        | 4300   | 10,000.00    |

CASH BOOK — PAYMENTS (Debits)
─────────────────────────────────────────────────────────────────
| S/NO | DATE       | NAME         | DETAILS                     | DOC REF   | CHQ NO | ACCODE | AMT PAID  |
|------|------------|--------------|-----------------------------|-----------|--------|--------|-----------|
| 1    | 2025-01-09 | Philip Akuffo| Cost of office repairs      | OP005/01  | 001930 | 2140   | 920.00    |
| 2    | 2025-01-15 | Ecobank      | 182-DAY T-Bills redeemed    |           | 3000   | 3000   | 93,461.79 |

Account codes (examples): 1020=Commissions, 2040=Commissions payable, 2110=Repairs, 2123=Servicing, 2140=Office, 4300=Receivables, 7400=Salaries, 7200=Staff deductions
```

### 2.2 Canonical Bank Statement Schema (Ecobank / Ghana Format)

```
BANK STATEMENT — CREDITS
─────────────────────────────────────────────────────────────────
| Transaction Date | Description                                              | Credit    |
|------------------|----------------------------------------------------------|-----------|
| 2025-01-06       | FUNDS TRANSFER - INWARD GHAAO00625HWE6R trf b/o ENTERPRISE LIFE... | 29,584.84 |
| 2025-01-15       | MOBILE TRANSFER RRN:137232165441-GIP INCOMING B/O AMEYAW BOADU...   | 10,000.00 |

BANK STATEMENT — DEBITS
─────────────────────────────────────────────────────────────────
| Transaction Date | Description                                              | Debit     |
|------------------|----------------------------------------------------------|-----------|
| 2025-01-03       | CHEQUE WITHDRAWAL CHQ NO 1925 PAID TO AKUFFO PHILIP...   | 3,615.00  |
| 2025-01-13       | TREASURY BILLS MATURED 182-DAY...                         | 93,461.79 |
```

### 2.3 Ghana Banks to Support (from real data)

| Bank | Code/Reference | Transaction Types |
|------|----------------|-------------------|
| Ecobank | ECOBANK TESANO | Funds transfer, T-Bills, Mobile, Cheque clearing |
| Access Bank | Access | Cheque clearing |
| Consolidated Bank | CBG | Cheque |
| GCB Bank | GCB | Cheque |
| ADB | ADB | Cheque |
| Prudential Bank | Prudential | Cheque |
| OMNI Bank | OMNI | Cheque |

---

## Part 3: Yearly Subscriptions — Recommendation

### 3.1 Should You Offer Yearly Plans? **YES**

| Benefit | Impact |
|---------|--------|
| **Lower churn** | ~30% lower churn vs monthly-only |
| **Higher retention** | ~15% higher retention on annual vs monthly |
| **Revenue** | ~20–30% higher when both options exist |
| **Cash flow** | Upfront annual payment helps operations |

### 3.2 Pricing Structure (Suggested)

| Plan | Monthly (GH₵) | Yearly (GH₵) | Discount | Projects/mo | Transactions/mo |
|------|---------------|--------------|----------|-------------|-----------------|
| **Basic** | 150 | 1,500 (12 mo) | ~17% | 5 | 500 |
| **Standard** | 400 | 4,000 (12 mo) | ~17% | 20 | 2,000 |
| **Premium** | 900 | 9,000 (12 mo) | ~17% | 100 | 10,000 |

**Discount guidance:** 15–20% for yearly is common; 17% is a clean “2 months free” message.

### 3.3 Alternative: Tiered Annual Discounts

- 12 months: 15% off  
- 24 months: 20% off  
- 36 months: 25% off  

---

## Part 4: World-Class Web App — Vision & Pre-UI

### 4.1 Design Principles

- **Clarity:** Finance professionals need clear data, no clutter.
- **Trust:** Professional look, secure handling of financial data.
- **Efficiency:** Minimal clicks from upload to report.
- **Ghana-first:** GHS, local banks, ICAG/IFRS terminology.

### 4.2 High-End Calculations Engine

| Feature | Description | Complexity |
|---------|-------------|------------|
| **Fuzzy amount matching** | ±0.01 tolerance for float errors | Medium |
| **Date window matching** | ±3 days for timing differences | Low |
| **Reference extraction** | Parse cheque #, CHQ#, RRN from descriptions | High |
| **Running balance** | Real-time cash book & bank balance | Medium |
| **Reconciliation algorithm** | Bipartite matching (cash book ↔ bank) | High |
| **Variance analysis** | Highlight amount/date/description mismatches | Medium |
| **Duplicate detection** | Same transaction in multiple lines | Medium |
| **Roll-forward** | Carry unpresented cheques to next period | High |

### 4.3 Professional Presentations

| View | Purpose |
|------|---------|
| **Dashboard** | Projects, usage, subscription, recent activity |
| **Upload** | Drag-drop for cash book + bank statement, format preview |
| **Mapping** | Map columns to canonical schema with AI suggestions |
| **Reconciliation** | Side-by-side cash book vs bank, match status |
| **Discrepancies** | Filtered list with recommended actions |
| **Recommendations** | Actionable steps: “Add to cash book”, “Follow up with bank” |
| **Report preview** | BRS preview before download |
| **Settings** | Branding, team, billing |

### 4.4 Pre-UI — Wireframe Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  LOGO    Dashboard | Projects | Reports | Settings | [Avatar]   [Upgrade]   │
└─────────────────────────────────────────────────────────────────────────────┘

DASHBOARD
┌──────────────────────┬──────────────────────┬──────────────────────┐
│  Active Projects     │  Transactions Used    │  Subscription        │
│  3 / 20              │  847 / 2,000          │  Standard (Monthly)  │
└──────────────────────┴──────────────────────┴──────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  Recent Projects                                           [+ New Project]  │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Lordship Insurance BRS Dec 2025     Completed     Dec 31, 2025    [View]   │
│  KQ-SOFT SOLUTIONS Jan 2025           In Progress   Jan 15, 2025    [Resume] │
└─────────────────────────────────────────────────────────────────────────────┘

PROJECT WORKFLOW
┌─────────┬─────────┬─────────┬─────────┬─────────┐
│ 1.Upload│ 2.Map   │ 3.Recon │ 4.Review│ 5.Report│
│   ●     │   ○     │   ○     │   ○     │   ○     │
└─────────┴─────────┴─────────┴─────────┴─────────┘

UPLOAD STEP
┌─────────────────────────────────────────────────────────────────────────────┐
│  Cash Book                    │  Bank Statement                             │
│  ┌─────────────────────────┐  │  ┌─────────────────────────┐                │
│  │  📄 Drop file or browse │  │  │  📄 Drop file or browse │                │
│  │  Excel, CSV, PDF, Image │  │  │  PDF, Excel, Image      │                │
│  └─────────────────────────┘  │  └─────────────────────────┘                │
│  cash_book_dec2025.xlsx ✓     │  ecobank_statement.pdf ✓                    │
└─────────────────────────────────────────────────────────────────────────────┘

RECONCILIATION VIEW (Side-by-Side)
┌─────────────────────────────────┬─────────────────────────────────┐
│ Cash Book (Receipts)             │ Bank Statement (Credits)        │
│ ─────────────────────────────── │ ─────────────────────────────── │
│ ✓ 06-Jan   Enterprise Life 29,584│ ✓ 06-Jan  FUNDS TRANSFER 29,584 │
│ ✓ 10-Jan   Star Assurance  128   │ ✓ 10-Jan  ACH PAYMENT     128   │
│ ○ 24-Jan   [Unknown]       1,520 │ ✓ 24-Jan  STAFF SALARIES  1,520 │
│ ✗ 15-Jan   Ameyaw Boadu   10,000 │ (unmatched)                    │
└─────────────────────────────────┴─────────────────────────────────┘

RECOMMENDATIONS PANEL
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔴 Action Required                                                           │
│ • Uncredited lodgments: Ameyaw Boadu GH₵10,000 — Await bank clearance       │
│ • Bank fee GH₵112.11 not in cash book — Add expense, debit bank charges     │
│                                                                              │
│ 🟡 Review                                                                     │
│ • Cheque 002037 — Same amount (601) on 2 lines, possible duplicate          │
└─────────────────────────────────────────────────────────────────────────────┘

REPORT PREVIEW
┌─────────────────────────────────────────────────────────────────────────────┐
│  [Client Logo]                                                               │
│  LORDSHIP INSURANCE COMPANY LIMITED                                          │
│  BANK RECONCILIATION STATEMENT AS AT 31-DECEMBER-2025                        │
│  ECOBANK TESANO ACCOUNT NO: 1441001519035                                    │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Balance as per bank statement              GH₵ 34,122.05                    │
│  Add: Uncredited lodgments                  GH₵ 30,156.99                    │
│  Less: Unpresented cheques                  GH₵ 30,156.99                    │
│  Adjusted bank balance                      GH₵ 34,122.05                    │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Balance as per cash book                   GH₵ 24,101.84                    │
│  Add: Bank credits not recorded             GH₵ 10,020.21                    │
│  Less: Bank charges not recorded            GH₵    112.11                    │
│  Adjusted cash book balance                 GH₵ 34,122.05                    │
│  ─────────────────────────────────────────────────────────────────────────  │
│  ✓ Reconciled                               GH₵ 34,122.05                    │
│                                                                              │
│                              [Download PDF] [Download Excel]                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.5 Custom Branding (White-Label Reports)

| Element | Editable |
|---------|----------|
| Logo | Upload PNG/JPG |
| Company name | Text |
| Primary colour | Hex picker |
| Secondary colour | Hex picker |
| Letterhead/address | Text block |
| Report title | Text (default: "Bank Reconciliation Statement") |
| Footer | Text (e.g. "Prepared by KQ-SOFT SOLUTIONS LIMITED") |

### 4.6 Technical Stack (Align with Coolify + Docker)

| Layer | Technology |
|-------|------------|
| Frontend | React + TypeScript + Tailwind |
| State | Zustand or TanStack Query |
| Backend | Node.js (FastAPI/Python alternative) |
| Database | PostgreSQL |
| File storage | MinIO/S3-compatible |
| OCR | Tesseract (images) + Document AI (PDFs) |
| Queue | Redis + Bull |
| Auth | JWT + refresh |
| Payments | Paystack (GHS) |

---

## Part 5: Next Steps Before Development

- [ ] Lock canonical schemas (cash book, bank statement) from this doc  
- [ ] Collect 3–5 more bank statement samples (GCB, Zenith, Access)  
- [ ] Confirm subscription tiers and prices (monthly + yearly)  
- [ ] Design DB schema (projects, documents, transactions, matches)  
- [ ] Build document parsing POC (Excel + PDF)  
- [ ] Implement matching algorithm POC  
- [ ] Create Figma/wireframes from pre-UI above  
- [ ] Set up repo + Docker Compose for local dev  

---

## Appendix: Real Data Snippets (Ghana)

**Cash book receipt:**
> Enterprise Life Assurance / Commissions received via transfer | ACCODE 1020 | GH₵29,584.84

**Bank statement credit:**
> FUNDS TRANSFER - INWARD GHAAO00625HWE6R trf b/o 1/ENTERPRISE LIFE ASSURANCE COMPANY iro ifo 1/LORDSHIP INSURANCE BROKERS / / //H98INFT250060275 06-Jan-2025

**Unpresented cheque:**
> Philip Akuffo / Cost of office vehicle repairs | CHQ 002038 | GH₵640.00
