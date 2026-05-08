# Uniformity & Consistency Implementation

**Date:** 2026-03-10  
**Source:** `docs/PROJECT_REVIEW_UNIFORMITY_CONSISTENCY.md`

---

## Phases Completed

### Phase 1 — Uncredited lodgments (plural)

| File | Change |
|------|--------|
| `MASTER_PLAN_BANK_RECONCILIATION_SAAS.md` | "Uncredited lodgment" → "Uncredited lodgments" |
| `PROJECT_PLANNING_UPDATE.md` | "Uncredited lodgment" → "Uncredited lodgments" |

---

### Phase 2 — Missing Cheques casing

| File | Change |
|------|--------|
| `web/src/pages/ProjectReport.tsx` | "Missing cheques" → "Missing Cheques" in heading (Unpresented cheques / Missing Cheques) |

**Rule:** "Missing Cheques" for headings/titles; "missing cheques" for body text.

---

### Phase 3 — API deprecation

| File | Change |
|------|--------|
| `api/src/routes/reconcile.ts` | Added `@deprecated` JSDoc to `matchedReceiptIds` and `matchedCreditIds` |

**Note:** Fields retained for backward compatibility. Frontend uses `matchedCashBookIds || matchedReceiptIds` and `matchedBankIds || matchedCreditIds`. Canonical fields are `matchedCashBookIds` and `matchedBankIds`.

---

### Phase 4 — Brand name standardisation

Standardised on **KQ SOFT SOLUTIONS** (full legal name) and **KQ SOFT SOLUTIONS** (short form where appropriate). (2026-04: rebrand from “Q-SOFT”.)

| File | Change |
|------|--------|
| `web/index.html` | Page title: **KQ SOFT SOLUTIONS** |
| `web/src/pages/Settings.tsx` | Placeholder: **KQ SOFT SOLUTIONS** |
| `web/src/pages/Register.tsx` | Placeholder: **KQ SOFT SOLUTIONS** |
| `web/src/pages/ProjectReport.tsx` | Fallback org name: **KQ SOFT SOLUTIONS** |
| `docs/EFFICIENCY_SYSTEM_PHASES.md` / `docs/PREMIUM_GHANA_IMPLEMENTATION_PLAN.md` / planning docs | Aligned to **KQ-SOFT** |

---

## Unchanged (already correct)

- `README.md` — **KQ SOFT SOLUTIONS**; live: https://kqsoftwaresolutions.com/
- `api/prisma/schema.prisma` — KQ-SOFT comment header
- `PLANNING_DATA.json`, `REFERENCE_GHANA_DATA_STRUCTURES.json` — **KQ SOFT SOLUTIONS** / KQ-SOFT

---

## Workspace folder (not modified)

- "KQ SOFT  SOLUTIONS" (double space) — folder rename requires user action outside the repo.
