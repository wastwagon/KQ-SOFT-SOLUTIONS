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

Standardised on **Q-SOFT SOLUTIONS LIMITED** (full legal name) and **Q-SOFT SOLUTIONS** (short form where appropriate).

| File | Change |
|------|--------|
| `web/index.html` | "Q-SOFT" → "Q-SOFT SOLUTIONS" (page title) |
| `web/src/pages/Settings.tsx` | "Q-SOFT Solutions Ltd" → "Q-SOFT SOLUTIONS LIMITED" (placeholder) |
| `web/src/pages/Register.tsx` | "Q-SOFT Solutions Ltd" → "Q-SOFT SOLUTIONS LIMITED" (placeholder) |
| `web/src/pages/ProjectReport.tsx` | "Q-SOFT SOLUTIONS" → "Q-SOFT SOLUTIONS LIMITED" (fallback org name) |
| `docs/EFFICIENCY_SYSTEM_PHASES.md` | "KQ SOFT SOLUTIONS" → "Q-SOFT SOLUTIONS" |
| `docs/PREMIUM_GHANA_IMPLEMENTATION_PLAN.md` | "KQ SOFT" → "Q-SOFT SOLUTIONS" |
| `PROJECT_PLANNING_UPDATE.md` | "Q-SOFT Solutions Ltd" → "Q-SOFT SOLUTIONS LIMITED"; "Q-SOFT Solutions Jan 2025" → "Q-SOFT SOLUTIONS Jan 2025" |

---

## Unchanged (already correct)

- `docker-compose.yml` — "Q-SOFT SOLUTIONS LIMITED"
- `README.md` — "Q-SOFT SOLUTIONS LIMITED"
- `api/prisma/schema.prisma` — unchanged
- `PLANNING_DATA.json`, `REFERENCE_GHANA_DATA_STRUCTURES.json` — "Q-SOFT SOLUTIONS LIMITED"

---

## Workspace folder (not modified)

- "KQ SOFT  SOLUTIONS" (double space) — folder rename requires user action outside the repo.
