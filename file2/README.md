# file2 — Lordship Ecobank (organised for period rollover)

**Client:** Lordship Insurance · **Bank:** Ecobank Tesano

## Folder layout (best practice)

| Folder | Contents | Role |
|--------|----------|------|
| `prior-year-2025/` | Final BRS as at **31 Dec 2025** (901 & 902) | Prior-period answer keys only — **do not upload** into Q1 projects |
| `q1-2026-answer-keys/` | Updated BRS as at **31 Mar 2026** | Current-period answer keys — **do not upload** |
| `q1-2026-sources/` | Sparse cash books + bank PDFs | Reference only — prefer `accountno552records/` / `accountno095details/` for live uploads |

## Rollover (product)

1. Finish Q1 project (match + report with **Workbook netting** on for 9033).
2. Mark Q1 **completed**.
3. **Create next period (roll forward)** — Q2 inherits unpresented cheques / open items from Q1.

```bash
# 9033 Q1 → Q2
GHANA_BRS_WORKBOOK_NETTING=1 API_URL=http://localhost:9101 BRS_TEST_EMAIL=firm@test.com \
  node scripts/run-accountno552-rollforward-test.mjs

# Live Q1 packs (source of truth for uploads)
API_URL=http://localhost:9101 BRS_TEST_EMAIL=firm@test.com node scripts/run-accountno552-test.mjs
API_URL=http://localhost:9101 BRS_TEST_EMAIL=firm@test.com node scripts/run-accountno095-test.mjs
```

## Manual targets (√ face BRS)

See `LORDSHIP_MANUAL_MARKS_REVIEW.md` for √ / ** / ?? explanation.

**9033:** bank 18,643.29 · cash 378,557.29 · unpresented **10,660.97** (workbook netting ON)  
**9035:** bank 4,899.28 · cash -63,299.04 · unpresented **2,623.18**

`??` working unpresented (9033 **17,825.86**) is not the face line unless companion `??` bank-only debits are used.

```bash
# Recreate both Q1 projects on firm (√ path, clean slate)
API_URL=http://localhost:9101 BRS_TEST_EMAIL=firm@test.com \
  node scripts/bootstrap-lordship-q1-firm.mjs
```
