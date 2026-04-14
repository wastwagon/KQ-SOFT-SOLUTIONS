# BRS — Implementation Phases (Safe, Incremental)

**Purpose:** Implement recommendations from BRS_FACTORS_AND_RECOMMENDATIONS.md in safe, low-risk phases.

---

## Phase 1 — File Upload Validation + Client Filter Chip (Low Risk)

| Item | Description | Files |
|------|-------------|-------|
| File type validation | Reject non-Excel/CSV/PDF/image uploads | `api/src/routes/upload.ts`, `api/src/routes/documents.ts` |
| File size limit | Max 10MB per file (configurable) | `api/src/routes/upload.ts` |
| Client filter chip | Show "Filtering by: Client Name" with clear button when `?clientId=` | `web/src/pages/Projects.tsx` |

---

## Phase 2 — Configurable Matching + Duplicate Detection (Medium Risk)

| Item | Description | Files |
|------|-------------|-------|
| Amount tolerance | Platform or org setting: ±0.01, ±0.10, ±1.00 | `api/src/services/matching.ts`, `api/src/lib/platformDefaults.ts`, admin settings |
| Date window | Platform or org setting: ±3, ±7 days | Same |
| Duplicate warning | Flag when multiple bank txns match same cash book (amount+date) | `api/src/services/matching.ts`, reconcile API response |

---

## Phase 3 — Data Parsing Improvements (Low Risk)

| Item | Description | Files |
|------|-------------|-------|
| Skip empty rows | Omit rows with amount 0 and no date/name/details | `api/src/routes/documents.ts` (map flow) |
| Better date parsing | Support DD/MM/YYYY explicitly | `api/src/services/ocr.ts`, parser |
| Specific error messages | "Column X missing for date" etc. | `api/src/routes/documents.ts` |

---

## Phase 4 — Data Retention + Audit Export (Medium Risk)

| Item | Description | Files |
|------|-------------|-------|
| Audit export | GET /audit/export?format=csv for external auditors | `api/src/routes/audit.ts` |
| Data retention config | Platform setting: retention years (default 7) | Admin settings, doc only for now |

---

## Phase 5 — Reconcile Pagination + Export UX (Medium Risk) ✅

| Item | Description | Files |
|------|-------------|-------|
| Reconcile pagination | Limit 1500 default; truncate per category; "Load more" | `api/src/routes/reconcile.ts`, `web/src/pages/ProjectReconcile.tsx` |
| Large report warning | Confirm before export when >200 transactions | `api/src/routes/report.ts`, `web/src/pages/ProjectReport.tsx` |

---

## Phase 6 — Native PDF Text Extraction (Medium Risk) ✅

| Item | Description | Files |
|------|-------------|-------|
| pdf-parse before OCR | Already implemented; added pdfTotalPages to native result | `api/src/services/ocr.ts` |

---

## Phase 7 — Security & Error Messages (Low Risk) ✅

| Item | Description | Files |
|------|-------------|-------|
| Specific mapping errors | Date column required; column index out of range | `api/src/routes/documents.ts` |
| Parse error hints | PDF/image-specific hints when parse fails | `api/src/routes/documents.ts` |

---

## Implementation Order

| Phase | Risk | Est. effort |
|-------|------|-------------|
| 1 | Low | 1–2 hrs |
| 2 | Medium | 2–3 hrs |
| 3 | Low | 1–2 hrs |
| 4 | Medium | 1–2 hrs |
| 5 | Medium | 2–3 hrs |
| 6 | Medium | 1–2 hrs |
| 7 | Low | 1 hr |
