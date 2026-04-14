# BRS Implementation Audit — Duplication, Conflicts, and Potential Issues

**Date:** 2026-03-10  
**Scope:** Phases 1–7 implementation, matching, reconcile, report, upload, documents.

---

## Summary

| Category | Status | Notes |
|----------|--------|-------|
| Duplication | ✅ None found | No redundant logic; duplicate detection is intentional |
| Conflicts | ✅ Fixed | `amountTolerance` was hardcoded in reconcile bank rules & learned boost |
| Potential errors | ✅ Mitigated | Multer errors handled; mapping validated; parse errors have hints |
| Malfunctioning | ✅ None identified | Tests pass; builds succeed |

---

## 1. Duplication

### Duplicate detection (intentional)

- **Matching:** `suggestMatches` groups suggestions by `cashBookTx.id` and sets `duplicateWarning: true` when multiple bank transactions match the same cash book entry.
- **Frontend:** `ProjectReconcile` shows a "Verify" badge when `duplicateWarning` is set.
- **No code duplication:** Logic lives in `matching.ts`; UI consumes it.

### No redundant logic

- Platform defaults (`amountTolerance`, `dateWindowDays`) are read once and passed to `suggestMatches`.
- Upload validation (file type, size) is centralized in multer config and global error handler.

---

## 2. Conflicts (Fixed)

### ~~amountTolerance inconsistency~~ ✅ Fixed

**Issue:** `reconcile.ts` used hardcoded `0.01` in:

- `addRuleSuggestions` (bank rules amount match)
- `applyLearnedBoost` (learned pattern amount match)

**Impact:** Admin could set `amountTolerance` to e.g. 0.10, but bank rules and learned boost would still use 0.01.

**Fix:** Both now use `matchOptions.amountTolerance` (via `tol`).

---

## 3. Potential Errors

### Multer (upload)

- **File type:** `fileFilter` rejects disallowed extensions; error returned as 400.
- **File size:** `limits.fileSize` set; `LIMIT_FILE_SIZE` caught by global handler; returns 413 with clear message.
- **Location:** `api/src/index.ts` global error handler.

### Document mapping

- **Column index:** Validated before use; returns 400 if index ≥ `numCols`.
- **Date required:** Mapping rejected if date column not mapped.
- **Location:** `api/src/routes/documents.ts` map handler.

### Parse errors (preview)

- **Type-specific hints:** PDF/image parse failures include hints (e.g. "PDF may be scanned").
- **Location:** `api/src/routes/documents.ts` preview catch block.

### Report variance

- Report uses `0.01` for "negligible variance" display. This is **intentional** and separate from matching tolerance (which affects suggestions). Variance display is cosmetic.

---

## 4. Malfunctioning / Edge Cases

### Reconcile pagination

- **Truncation:** Per-category limit = `ceil(limit/4)`; `truncated` and `totalCount` returned.
- **Load more:** Frontend "Load more" sets `reconcileLimit` to 5000 and refetches.
- **Suggestions:** Only computed for truncated data; correct for visible rows.

### Duplicate warning

- **Logic:** Groups by `cashBookTx.id`; if `list.length > 1`, all get `duplicateWarning`.
- **Test:** `matching.test.ts` now includes tests for `duplicateWarning`.

### Null dates in matching

- `datesWithinWindow(null, null, n)` returns `true` (no false exclude).
- Documented in `FLOW_FORMULAS_TERMINOLOGY_REVIEW.md`.

---

## 5. Recommendations

1. **Run tests:** `cd api && npm test` — matching tests cover tolerance and duplicate warning.
2. **Manual checks:** Upload (type/size), reconcile (Load more, Verify badge), report export warning.
3. **Future:** Consider making report "negligible variance" threshold configurable if needed.

---

## 6. Files Touched in This Audit

| File | Change |
|------|--------|
| `api/src/routes/reconcile.ts` | Use `matchOptions.amountTolerance` in addRuleSuggestions and applyLearnedBoost |
| `api/src/services/matching.test.ts` | Add duplicateWarning tests |
| `docs/BRS_AUDIT_FINDINGS.md` | New audit document |
