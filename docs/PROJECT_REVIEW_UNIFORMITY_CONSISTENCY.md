# Project Review — Uniformity, Consistency & Accounting Terminology

**Date:** 2026-03-10  
**Scope:** Entire BRS project (api, web, docs, config)

---

## Executive Summary

The project is generally consistent in naming, structure, and accounting terminology. Main issues:

1. **Brand name**: (historical) "KQ SOFT" vs "Q-SOFT" — now **KQ-SOFT** / **KQ-SOFT SOLUTIONS LIMITED**
2. **API response fields**: Redundant/legacy fields (`matchedCreditIds`, `matchedReceiptIds`)
3. **Uncredited lodgment(s)**: Singular vs plural in planning docs
4. **Missing Cheques**: Casing in headings vs body text

---

## 1. Uniformity — Naming & Structure

### File structure ✓
- API: `routes/`, `services/`, `lib/` — consistent
- Web: `pages/`, `components/`, `lib/` — consistent

### Document types ✓
- `cash_book_receipts`, `cash_book_payments`, `bank_credits`, `bank_debits` — consistent (Prisma enum)

### API routes ✓
- kebab-case: `/upload/cash-book/`, `/upload/bank-statement/`, `/upload/branding-logo`

### DB naming ✓
- snake_case in DB (`chq_no`, `row_index`), camelCase in Prisma

---

## 2. Consistency — Spelling & Terminology

### 2.1 Brand name inconsistency

| Location | Value (current) |
|----------|--------|
| `index.html` | "KQ-SOFT SOLUTIONS" |
| `Settings.tsx`, `Register.tsx` | "KQ-SOFT SOLUTIONS LIMITED" (placeholders) |
| `ProjectReport.tsx` | "KQ-SOFT SOLUTIONS LIMITED" (fallback) |
| `schema.prisma`, `README.md` | "KQ-SOFT SOLUTIONS LIMITED" |
| Workspace folder | "KQ SOFT  SOLUTIONS" (double space) — rename is optional |

**Recommendation:** Standardise on one brand: **KQ-SOFT SOLUTIONS LIMITED** / **KQ-SOFT**. ✅ Implemented.

### 2.2 UK vs US spelling ✓
- **organisation** (UK) — used in UI; appropriate for Ghana
- **finalise** (UK) — used in Reconcile UI
- **organisation** in code identifiers — US spelling for variable names is fine

### 2.3 Uncredited lodgment(s)

| Location | Form |
|----------|------|
| Report, PDF, Excel, BrsHelp, GHANA_BRS_LAYOUT | **Uncredited lodgments** (plural) ✓ |
| `MASTER_PLAN_BANK_RECONCILIATION_SAAS.md` | **Uncredited lodgment** (singular) |
| `PROJECT_PLANNING_UPDATE.md` | **Uncredited lodgment** (singular) |

**Recommendation:** Use "Uncredited lodgments" (plural) everywhere.

### 2.4 Missing Cheques casing

| Context | Recommended |
|---------|-------------|
| Headings, titles | "Missing Cheques" |
| Body text | "missing cheques" |

---

## 3. Accounting Grammar & Terminology

### 3.1 Cash book ✓
- **Cash book** (two words) — correct; used consistently in UI and docs
- **cash-book** (hyphenated) — only in API paths

### 3.2 Debit / Credit ✓
- Bank credits = lodgments
- Bank debits = withdrawals
- Receipts ↔ Credits, Payments ↔ Debits — consistent

### 3.3 Reconcile vs Reconciliation ✓
- Reconcile (verb) — steps, buttons, routes
- Reconciliation — "Bank reconciliation", "reconciliation date"
- reconciling — project status

### 3.4 BRS terms ✓
- Uncredited lodgments — receipts not yet credited by bank
- Unpresented cheques — cheques issued but not yet presented
- Balance per cash book — consistent

### 3.5 Cheque vs Check ✓
- **Cheque** used throughout (Ghana/UK) — correct

---

## 4. API Response Fields

### Reconcile API redundancy

```typescript
matchedReceiptIds: Array.from(matchedCbIds),   // Legacy — same as matchedCashBookIds
matchedCreditIds: Array.from(matchedBankIds),  // Misleading — includes credits AND debits
matchedCashBookIds: Array.from(matchedCbIds),
matchedBankIds: Array.from(matchedBankIds),
```

- `matchedCreditIds` is misleading (contains all matched bank txns).
- `matchedReceiptIds` is legacy; frontend falls back to `matchedCashBookIds || matchedReceiptIds`.

**Recommendation:** Prefer `matchedCashBookIds` and `matchedBankIds`; deprecate `matchedReceiptIds` and `matchedCreditIds`.

### Document ID naming ✓
- `receipts`: `documentId` (singular)
- `credits`, `payments`, `debits`: `documentIds` (plural) — correct (multiple docs possible)

---

## 5. UI Label Consistency ✓

### Step labels
Upload → Map → Reconcile → Review → Report — consistent

### Button labels
- "Submit for review", "Approve", "← Back to Review"
- "Proceed to Reconcile →", "Proceed to Review →" — consistent

### Status labels
draft → Mapping, reconciling → Reconciling, submitted_for_review → Submitted, approved → Approved, completed → Completed — consistent

---

## 6. Summary of Recommendations

| Priority | Issue | Fix |
|----------|-------|-----|
| High | Brand name | Standardise on one brand: **KQ-SOFT SOLUTIONS LIMITED** / **KQ-SOFT** |
| Medium | API response | Deprecate `matchedReceiptIds` and `matchedCreditIds`; document `matchedCashBookIds` and `matchedBankIds` as canonical |
| Medium | Uncredited lodgment(s) | Use "Uncredited lodgments" (plural) in planning docs |
| Low | Missing Cheques casing | "Missing Cheques" for headings, "missing cheques" for body |
| Low | organisation | Keep UK spelling in UI; keep `organization` in code |

---

## 7. Files Reviewed

| Area | Files |
|------|-------|
| API | reconcile.ts, report.ts, upload.ts, audit.ts, matching.ts |
| Web | ProjectDetail, ProjectReconcile, ProjectReport, ProjectReview, ProjectMap, Settings, BrsHelp, api.ts |
| Schema | prisma/schema.prisma |
| Docs | FLOW_FORMULAS_TERMINOLOGY_REVIEW, GHANA_BRS_LAYOUT, SYSTEM_REVIEW_LINKING_CONSISTENCY, EFFICIENCY_SYSTEM_PHASES, BRS_AUDIT_FINDINGS, MASTER_PLAN, PROJECT_PLANNING_UPDATE |
| Config | index.html, docker-compose.yml, README.md |
