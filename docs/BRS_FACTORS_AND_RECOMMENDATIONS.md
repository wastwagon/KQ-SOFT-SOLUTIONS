# BRS — Factors That Affect Reconciliation & Recommendations

**Purpose:** Outline factors that can impact the Bank Reconciliation Statement platform—accuracy, compliance, performance, and user experience—with actionable recommendations.

---

## 1. Reconciliation Accuracy

### 1.1 Matching Engine

| Factor | Current State | Impact | Recommendation |
|--------|---------------|--------|----------------|
| **Amount tolerance** | ±0.01 (hardcoded) | Works for 2-decimal currencies; may be too tight for rounding differences | Make configurable per project or org (e.g. ±0.01, ±0.10, ±1.00) |
| **Date window** | ±3 days (hardcoded) | Misses valid matches when bank posting lags; may over-suggest when many same-amount txns | Make configurable; consider ±7 days for month-end |
| **Description similarity** | First 20 chars overlap | Simple; may miss fuzzy matches (typos, abbreviations) | Consider Levenshtein or token-based similarity (as in MASTER_PLAN) |
| **Duplicate detection** | Not implemented | Same amount + date + description can appear multiple times; risk of wrong match | Add duplicate flag/warning when multiple candidates exist |
| **Cheque rule** | Requires chq/ref match when chqNo present | Reduces false positives; good | Keep; document for users |

### 1.2 Data Parsing

| Factor | Current State | Impact | Recommendation |
|--------|---------------|--------|----------------|
| **Date parsing** | `new Date(String(v))` | Locale-dependent; DD/MM vs MM/DD ambiguity | Add explicit format detection (DD/MM/YYYY vs MM/DD/YYYY) from user or sample |
| **Amount parsing** | Strips non-numeric; empty → 0 | Rows with amount 0 and no date/name/details can clutter | Consider skipping rows with all-empty fields |
| **Negative amounts** | Handled via `-` in parse | Credits/debits may use parentheses or different conventions | Document supported formats; add tests for common bank formats |

### 1.3 Currency & FX

| Factor | Current State | Impact | Recommendation |
|--------|---------------|--------|----------------|
| **Multi-currency** | GHS, USD, EUR at project level; display only | No FX conversion in matching; mixed-currency projects not supported | Document that each project uses one currency; future: multi-currency cash book |
| **FX rates** | ExchangeRate-API + manual fallback | API can fail; manual rates need admin setup | Consider caching longer; add attribution when conversion used |

---

## 2. Document & OCR

| Factor | Current State | Impact | Recommendation |
|--------|---------------|--------|----------------|
| **PDF OCR** | Tesseract; max 50 pages | Large PDFs truncated; no native text extraction | Use native PDF text extraction (e.g. pdf-parse) before OCR for text-heavy PDFs |
| **Table extraction** | Splits on tabs or 2+ spaces | Complex tables can misalign columns | Add validation: row count vs expected; warn if row lengths vary |
| **OCR language** | `eng` only | Ghana-specific text (e.g. bank names) may misread | Test with real Ghana bank statements; consider `eng+fra` if needed |
| **Supported banks** | Ecobank, GCB, Access, Stanbic, Fidelity, UBA, Absa | Other banks need manual mapping | Add more banks as user feedback; document manual mapping for unsupported banks |

---

## 3. Compliance & Audit

| Factor | Current State | Impact | Recommendation |
|--------|---------------|--------|----------------|
| **Audit trail** | Standard+; logs all critical actions | Good for compliance | Ensure audit log retention policy; consider export for external auditors |
| **Data retention** | Not configurable | PLANNING_DATA mentions 7 years; not implemented | Add configurable retention (e.g. per org; delete/archive after X years) |
| **ICAG/IFRS** | Mentioned in plan | Ghana accounting standards; no explicit compliance | Document alignment with Ghana BRS practices; add disclaimer if needed |
| **Immutability** | Audit log stored; no deletion | Good | Keep; ensure no audit log deletion by design |
| **Reconciliation sign-off** | Prepared by, Reviewed by, Approved by | Standard workflow | Consider adding approval workflow for threshold (already implemented) |

---

## 4. Security & Access Control

| Factor | Current State | Impact | Recommendation |
|--------|---------------|--------|----------------|
| **Roles** | admin, reviewer, preparer, viewer | Enforced in API; UI varies | Document role behaviour; ensure viewer cannot export sensitive data |
| **API keys** | Firm plan; rate limit from admin | Good | Add IP allowlist or scope restrictions if needed |
| **File upload** | Stored on disk; path in DB | Validate file types; limit size | Add virus scan for uploads; consider object storage (S3) for scale |
| **Session management** | JWT 7 days | Long-lived; no refresh | Consider shorter token + refresh; add "logout all devices" |
| **MFA** | Not implemented | PLANNING_DATA mentions "mfa_future" | Add for admin/reviewer roles when handling sensitive data |

---

## 5. Performance & Scalability

| Factor | Current State | Impact | Recommendation |
|--------|---------------|--------|----------------|
| **Reconcile GET** | Loads all transactions + matches | Large projects (1000+ txns) may slow | Add pagination or lazy-load for unmatched lists |
| **Suggestions** | O(n×m) in matching | Can be slow with many unmatched | Consider background job for suggestions; cache |
| **Report export** | Synchronous PDF/Excel | Large reports can timeout | Add async export for large projects; queue + download link |
| **OCR** | CPU-heavy; blocks request | PDF/image upload can be slow | Move OCR to background worker; notify when ready |
| **Database** | No indexes on common filters | Project list, audit by project may slow | Add indexes on `projectId`, `organizationId`, `createdAt` where needed |

---

## 6. User Experience & Workflow

| Factor | Current State | Impact | Recommendation |
|--------|---------------|--------|----------------|
| **Deep links** | Hash-based (#reconcile, #report) | Shareable links | Document; ensure hash persists on refresh |
| **Roll forward** | Only from Report "Create next period" | Cannot create from ProjectNew with roll forward | Add "Roll forward from" in ProjectNew dropdown (already in API) |
| **Client filter** | Projects list supports `?clientId=` | No clear "Filtering by client" chip | Add chip when filtering; clear button |
| **Reconcile UX** | Side-by-side; suggestions | Good | Consider "Accept all" for high-confidence suggestions (with caveat) |
| **Error messages** | Generic "Mapping failed", etc. | Hard to debug | Add more specific errors (e.g. "Column X missing for date") |

---

## 7. Operational & Reliability

| Factor | Current State | Impact | Recommendation |
|--------|---------------|--------|----------------|
| **Backup** | Not mentioned | Data loss risk | Implement DB backups (daily); test restore |
| **Monitoring** | No explicit APM | Failures may go unnoticed | Add health checks; log errors; alert on critical failures |
| **Email** | Resend for password reset | Depends on Resend; no fallback | Document; consider fallback for failed emails |
| **Paystack webhook** | Handles subscription events | Idempotency; retries | Ensure webhook is idempotent; log failures |
| **Docker** | docker-compose for dev | Migrations run on startup | Document production deployment; consider separate migration step |

---

## 8. Ghana-Specific

| Factor | Current State | Impact | Recommendation |
|--------|---------------|--------|----------------|
| **Terminology** | Uncredited lodgments, Unpresented cheques | Aligned with GHANA_BRS_LAYOUT | Keep; document for users |
| **Date format** | DD MMM YYYY display | Ghana standard | Consistent |
| **Currency** | GHS default; GH₵ symbol | Correct | Keep |
| **Bank formats** | 7 banks supported | Covers major banks | Add more as user feedback |

---

## 9. Priority Matrix

| Priority | Area | Recommendation |
|----------|------|-----------------|
| **High** | Accuracy | Duplicate detection warning |
| **High** | Compliance | Data retention policy |
| **High** | Security | File upload validation |
| **Medium** | Matching | Configurable tolerance/date window |
| **Medium** | OCR | Native PDF text before OCR |
| **Medium** | Performance | Pagination for large reconcile |
| **Low** | UX | Client filter chip |
| **Low** | Matching | Configurable description similarity |

---

## 10. Summary

The BRS platform is feature-complete for core flow (upload → map → reconcile → review → report). The main factors that can affect accuracy and reliability are:

1. **Matching:** Hardcoded tolerance/date window; no duplicate detection.
2. **OCR:** PDF truncation; no native text extraction.
3. **Compliance:** No configurable data retention.
4. **Performance:** Large projects may slow reconcile and export.
5. **Security:** File upload validation; MFA for sensitive roles.

Addressing these in priority order will improve robustness and compliance readiness.
