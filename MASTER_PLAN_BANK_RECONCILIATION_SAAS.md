# Master Plan: Bank Reconciliation SaaS
## Q-SOFT SOLUTIONS LIMITED | Ghana | Advanced | Gaps Closed

**Version:** 1.0  
**Last Updated:** February 2026  
**Status:** Planning Complete — Build Once, No Return  
**Hosting:** VPS + Coolify + Docker

---

## 1. Executive Summary

Advanced bank reconciliation web app for accounting firms in Ghana. Collects cash books and bank statements (Excel, CSV, PDF, scanned images), extracts data via AI/OCR, reconciles using intelligent matching, and generates professional branded reports. SaaS model with Basic, Standard, Premium tiers. All gaps from QuickBooks, Xero, Sage Intacct, Zoho Books, BlackLine, Wave, and NetSuite have been incorporated.

---

## 2. Scope — What We Are Building

| Component | Description |
|-----------|-------------|
| **Document ingestion** | Excel, CSV, PDF, scanned images (PNG, JPG, TIFF) |
| **AI extraction** | OCR, table detection, format-agnostic parsing |
| **Canonical schema** | Ghana cash book + bank statement structures |
| **Matching engine** | Fuzzy amount, date window, reference extraction, 1-to-many |
| **Bank rules** | Custom rules for auto-matching (priority order) |
| **Bulk operations** | Bulk match (50+ transactions), bulk categorize |
| **Reconciliation** | Side-by-side view, suggested matches, exception flagging |
| **Reports** | BRS, discrepancy, missing cheques, audit trail |
| **Branding** | White-label reports (logo, colours, letterhead) |
| **Roll-forward** | Carry unpresented cheques to next period |
| **SaaS** | Projects/transactions limits, monthly/yearly, Paystack (GHS) |
| **Firm mode** | Multi-client dashboard for accounting firms |

---

## 3. Competitor Analysis — Gaps Closed

### 3.1 Feature Adoption Matrix

| Feature | QB | Xero | Sage | Zoho | BlackLine | Wave | NetSuite | **Q-SOFT** |
|---------|----|------|------|------|-----------|------|----------|------------|
| Bank feeds / import | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ Manual + API (future) |
| Manual statement upload | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ Excel, CSV, PDF, Image |
| Auto-suggested matches | ✓ | ✓ | ✓ | ✓ | ✓ | L | ✓ | ✓ AI + amount/date/ref |
| Bank rules (custom) | L | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ Priority order |
| Bulk reconciliation | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ 50+ transactions |
| AI-powered matching | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ Field prediction |
| 1-to-many matching | L | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ |
| Many-to-many matching | ✗ | L | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ |
| Discrepancy report | ✓ | ✓ | ✓ | ✓ | ✓ | B | ✓ | ✓ |
| Missing cheques report | ✓ | ✓ | ✓ | ✓ | ✓ | B | ✓ | ✓ |
| Reopen past periods | ✓ | ✓ | ✓ | ✓ | ✓ | L | ✓ | ✓ Audit trail |
| Auto journal entries | ✓ | ✓ | ✓ | ✓ | ✓ | L | ✓ | ✓ Suggestions |
| Full audit trail | ✓ | ✓ | ✓ | ✓ | ✓ | B | ✓ | ✓ Immutable log |
| Multi-currency | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ GHS primary |
| Document attachment | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Role/approval workflow | ✓ | ✓ | ✓ | ✓ | ✓ | L | ✓ | ✓ |
| Dashboard | B | ✓ | ✓ | ✓ | ✓ | B | ✓ | ✓ |
| OCR / scanned docs | ✓ | ✓ | L | ✓ | ✓ | P | L | ✓ Tesseract + optional cloud |
| Threshold approval | ✗ | ✗ | ✓ | ✗ | ✓ | ✗ | ✓ | ✓ Configurable |
| Rule prioritization | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ |
| Machine learning (learns) | L | B | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ From corrections |
| Side-by-side view | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Filter by amount/date | ✓ | ✓ | ✓ | ✓ | ✓ | L | ✓ | ✓ |
| Exception handling | B | ✓ | ✓ | ✓ | A | B | ✓ | ✓ Flagged + suggested actions |
| Roll-forward | ✗ | L | ✓ | L | ✓ | ✗ | ✓ | ✓ Unpresented cheques |
| Firm/accountant view | ✓ | ✓ | ✓ | ✓ | ✓ | L | ✓ | ✓ Multi-client dashboard |
| Ghana bank parsers | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ Ecobank, GCB, Access, etc. |
| White-label reports | L | L | L | L | L | ✗ | L | ✓ Full branding |
| Yearly subscription | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ ~17% discount |

**Legend:** ✓ Yes | L Limited | B Basic | A Advanced | P Pro only

---

## 4. Subscription Tiers — Final

| Plan | Monthly (GH₵) | Yearly (GH₵) | Discount | Projects/mo | Transactions/mo | Users |
|------|---------------|--------------|----------|-------------|-----------------|-------|
| **Basic** | 150 | 1,500 | 17% | 5 | 500 | 1 |
| **Standard** | 400 | 4,000 | 17% | 20 | 2,000 | 3 |
| **Premium** | 900 | 9,000 | 17% | 100 | 10,000 | 5+ |
| **Firm** | Custom | Custom | — | Unlimited | Unlimited | Unlimited |

**Intro offer:** 50% off first 2 months (new customers).  
**Alternative annual:** 12mo 15% | 24mo 20% | 36mo 25%.

---

## 5. Canonical Schemas (Locked)

### 5.1 Cash Book — Receipts

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| s_no | integer | No | Serial number |
| date | date | Yes | Transaction date |
| name | string | No | Payer/counterparty |
| details | string | Yes | Description |
| doc_ref | string | No | Document reference |
| chq_no | string | No | Cheque/CHQ number |
| accode | integer | No | Account code |
| amt_received | decimal(18,2) | Yes | Amount (GHS) |

### 5.2 Cash Book — Payments

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| s_no | integer | No | Serial number |
| date | date | Yes | Transaction date |
| name | string | No | Payee/counterparty |
| details | string | Yes | Description |
| doc_ref | string | No | Document reference |
| chq_no | string | No | Cheque number |
| accode | integer | No | Account code |
| amt_paid | decimal(18,2) | Yes | Amount (GHS) |

### 5.3 Bank Statement — Credits

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| transaction_date | date | Yes | Bank transaction date |
| description | string | Yes | Bank description (full text) |
| credit | decimal(18,2) | Yes | Amount (GHS) |

### 5.4 Bank Statement — Debits

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| transaction_date | date | Yes | Bank transaction date |
| description | string | Yes | Bank description (full text) |
| debit | decimal(18,2) | Yes | Amount (GHS) |

---

## 6. Matching Engine — Specification

### 6.1 Matching Rules (Priority Order)

1. **Exact match:** Same amount, same date, same reference (CHQ#, RRN, etc.)
2. **Amount + date window:** ±0.01 GHS, ±3 days
3. **Amount + description similarity:** Fuzzy text match (e.g. Levenshtein)
4. **Reference extraction:** Parse CHQ#, RRN, reference from description; match to cash book
5. **Bank rules:** User-defined rules (e.g. "If description contains X → match to account Y")

### 6.2 Match Types

| Type | Description | Example |
|------|-------------|---------|
| **1-to-1** | One cash book ↔ one bank | Single cheque |
| **1-to-many** | One cash book ↔ multiple bank | Batch deposit |
| **Many-to-1** | Multiple cash book ↔ one bank | Consolidated payment |
| **Many-to-many** | Multiple ↔ multiple | Complex scenario |

### 6.3 Tolerance & Parameters

| Parameter | Value | Configurable |
|-----------|-------|--------------|
| Amount tolerance | ±0.01 GHS | Yes |
| Date window | ±3 days | Yes |
| Description similarity threshold | 0.7 (0–1) | Yes |
| Bulk match limit | 50 transactions | Yes (tier) |

### 6.4 Exception Handling

- **Unmatched cash book:** Flag with suggested action (e.g. "Add to bank — deposit in transit")
- **Unmatched bank:** Flag with suggested action (e.g. "Add to cash book — bank fee")
- **Low confidence match:** Require manual confirmation
- **Duplicate detection:** Same amount + date + description across multiple lines
- **Variance analysis:** Amount mismatch, date mismatch, description mismatch

---

## 7. Bank Rules Engine

### 7.1 Rule Structure

```json
{
  "id": "rule_001",
  "name": "Bank fees",
  "priority": 1,
  "conditions": [
    {"field": "description", "operator": "contains", "value": "BANK CHARGES"},
    {"field": "amount", "operator": "lte", "value": 100}
  ],
  "actions": {
    "match_to_account": "bank_charges",
    "auto_approve": false
  }
}
```

### 7.2 Condition Operators

`equals`, `contains`, `starts_with`, `regex`, `gt`, `gte`, `lt`, `lte`, `between`

### 7.3 Actions

`match_to_account`, `suggest_match`, `auto_approve`, `flag_for_review`

---

## 8. Report Sections (BRS)

1. **Header:** Company name, report title, bank account, date  
2. **Closing balance per bank statement**  
3. **Uncredited lodgments** (deposits in transit)  
4. **Unmatched receipts in cash book**  
5. **Unmatched credits in bank statement**  
6. **Unpresented cheques**  
7. **Unmatched payments in cash book**  
8. **Balance per cash book at end of period**  
9. **Adjusted bank balance**  
10. **Adjusted cash book balance**  
11. **Reconciled balance**  
12. **Sign-off (optional)**

---

## 9. UI/UX — Wireframe Summary

| Screen | Components |
|--------|------------|
| **Login** | Email/password, forgot password, optional OAuth |
| **Dashboard** | Projects used, transactions used, subscription, recent projects, [+ New Project] |
| **Project workflow** | 5 steps: Upload → Map → Recon → Review → Report |
| **Upload** | Dual drop zones (cash book, bank statement), supported formats, preview |
| **Mapping** | Column selector, AI suggestions, schema preview |
| **Reconciliation** | Side-by-side grids, match status (✓ ○ ✗), bulk select, filters |
| **Recommendations** | Action required, review, suggested journal entries |
| **Report** | Preview, branding options, [Download PDF] [Download Excel] |
| **Settings** | Profile, branding, team, billing, bank rules |
| **Firm dashboard** | Client list, projects per client, usage across clients |

---

## 10. Technical Architecture

### 10.1 Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Tailwind CSS, Zustand, TanStack Query |
| Backend | Node.js (Express) or Python (FastAPI) |
| Database | PostgreSQL |
| Cache | Redis |
| Queue | Bull (Redis-backed) |
| File storage | MinIO / S3-compatible |
| OCR | Tesseract (images) + optional Azure Document Intelligence (PDFs) |
| Auth | JWT + refresh tokens, optional OAuth |
| Payments | Paystack (GHS) |
| Hosting | VPS + Coolify + Docker |

### 10.2 Services

| Service | Purpose |
|---------|---------|
| **API** | REST API, auth, project CRUD |
| **Worker** | Document parsing, OCR, matching, report generation |
| **Frontend** | SPA |
| **PostgreSQL** | Primary data store |
| **Redis** | Sessions, cache, queue |
| **MinIO** | File storage (uploads, reports) |

### 10.3 Database Entities

- `users`, `organizations`, `subscriptions`, `usage_logs`
- `projects`, `documents`, `transactions` (cash_book_receipts, cash_book_payments, bank_credits, bank_debits)
- `matches`, `rules`, `reconciliations`, `audit_logs`
- `report_templates`, `branding_settings`

---

## 11. Security & Compliance

| Requirement | Implementation |
|-------------|----------------|
| **Data encryption** | TLS in transit, AES at rest |
| **Auth** | JWT, bcrypt passwords, MFA (future) |
| **Access control** | RBAC (admin, reviewer, preparer, viewer) |
| **Audit trail** | Immutable log of all actions |
| **Data retention** | Configurable per org (default 7 years) |
| **ICAG/IFRS** | BRS format compliant |
| **Ghana data** | Hosting in-region preferred |

---

## 12. Development Phases (Build Once)

### Phase 1 — Foundation (Weeks 1–4)

- [ ] Repo structure, Docker Compose, CI/CD
- [ ] Auth (register, login, JWT)
- [ ] User/org/subscription models
- [ ] Document upload (Excel, CSV)
- [ ] Column mapping UI
- [ ] Canonical schema validation

### Phase 2 — Core Engine (Weeks 5–8)

- [ ] Parsers (Excel, CSV, PDF, image OCR)
- [ ] Matching engine (1-to-1, fuzzy amount, date window)
- [ ] Side-by-side reconciliation view
- [ ] Suggested matches (amount + date)
- [ ] BRS report generation (PDF, Excel)
- [ ] Basic branding (logo, company name)

### Phase 3 — Advanced Matching (Weeks 9–12)

- [ ] 1-to-many, many-to-many matching
- [ ] Bank rules engine (priority, conditions, actions)
- [ ] Bulk match (50 transactions)
- [ ] Reference extraction (CHQ#, RRN)
- [ ] Exception flagging
- [ ] Reopen past periods + audit trail
- [ ] Discrepancy report, missing cheques report
- [ ] Roll-forward (unpresented cheques)

### Phase 4 — AI & Automation (Weeks 13–16)

- [ ] AI-suggested matches (field prediction)
- [ ] Learning from corrections (improve suggestions)
- [ ] Bank rules UI (create, edit, prioritize)
- [ ] Threshold-based approval
- [ ] Auto journal entry suggestions
- [ ] Ghana bank-specific parsers (Ecobank, GCB, Access, etc.)

### Phase 5 — SaaS & Polish (Weeks 17–20)

- [ ] Subscription tiers (Basic, Standard, Premium)
- [ ] Paystack integration (GHS)
- [ ] Usage tracking (projects, transactions)
- [ ] Usage limits enforcement
- [ ] Firm dashboard (multi-client)
- [ ] Full audit trail UI
- [ ] White-label branding (logo, colours, letterhead)
- [ ] Intro offer (50% off 2 months)

### Phase 6 — Launch (Weeks 21–22)

- [ ] End-to-end testing
- [ ] Performance tuning
- [ ] Documentation
- [ ] Coolify deployment
- [ ] Monitoring, alerts

---

## 13. Ghana-Specific Requirements

### 13.1 Banks to Support (Parsers)

Ecobank, GCB Bank, Access Bank, Zenith Bank, Stanbic, Standard Chartered, Consolidated Bank (CBG), ADB, Prudential Bank, OMNI Bank, FBNBank, GTBank, UBA

### 13.2 Transaction Types

- Funds transfer (inward/outward)
- Mobile transfer (GIPS, MoMo)
- Cheque clearing (inward/outward)
- Treasury bills (T-Bills)
- ACH payment
- Journal entry
- Staff salaries
- Bank charges, interest

### 13.3 Currency

GHS (GH₵), 2 decimal places, comma thousands separator, symbol before amount.

### 13.4 Standards

ICAG, IFRS, ISA terminology and report format.

---

## 14. Acceptance Criteria — Done When

- [ ] User can upload cash book + bank statement (Excel, CSV, PDF, image)
- [ ] System extracts transactions with >95% accuracy (structured docs)
- [ ] User can map columns to canonical schema (with AI suggestions)
- [ ] System suggests matches (amount + date + reference)
- [ ] User can match 1-to-1, 1-to-many, many-to-many
- [ ] Bank rules auto-match repetitive transactions
- [ ] User can bulk match 50 transactions
- [ ] Side-by-side view shows match status (matched, unmatched, flagged)
- [ ] User can reopen past periods (with audit trail)
- [ ] BRS report generated (PDF, Excel) with branding
- [ ] Discrepancy report, missing cheques report available
- [ ] Roll-forward carries unpresented cheques
- [ ] Subscription limits enforced (projects, transactions)
- [ ] Firm dashboard shows multi-client view
- [ ] Full audit trail for all actions
- [ ] Ghana banks (Ecobank, GCB, Access) parsed correctly
- [ ] Hosted on Coolify, accessible via HTTPS

---

## 15. Appendix

### A. Reference Documents

- `REFERENCE_GHANA_DATA_STRUCTURES.json` — Canonical schemas, sample data
- `PROJECT_PLANNING_UPDATE.md` — Earlier planning notes
- `BRRSAMPLE.xlsx`, `BRRsample2.xlsx` — Real Q-SOFT data

### B. Glossary

| Term | Definition |
|------|------------|
| **BRS** | Bank Reconciliation Statement |
| **Uncredited lodgments** | Deposits in cash book not yet on bank |
| **Unpresented cheque** | Cheque issued, not yet cleared by bank |
| **Roll-forward** | Carry outstanding items to next period |
| **GIPS** | Ghana Interbank Payment System (mobile) |

---

**Document Status:** FINAL — No return for improvement. All gaps closed. Advanced from day one.
