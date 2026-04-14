# BRS Platform Review – February 2026

**Scope:** Premium/Standard/Basic/Firm features, unification and flow, calculations, AI scraping.

---

## 1. Plan Tiers & Feature Gating

### Implemented
| Feature | PLANNING_DATA | Implementation |
|---------|---------------|----------------|
| **Projects limit** | Basic: 5, Standard: 20, Premium: 100, Firm: unlimited | ✅ `canCreateProject` in usage.ts, enforced on project create |
| **Transactions limit** | Basic: 500, Standard: 2000, Premium: 10000, Firm: unlimited | ✅ `canAddTransactions` in documents.ts map flow |
| **Billing / Paystack** | All paid plans | ✅ Subscription flow, intro offer (50% first payment for basic) |
| **Tier limits config** | TIER_LIMITS | ✅ `api/src/config/subscription.ts` |

### Gaps – Plan-Based Features (Status as of Feb 2026)

| Feature | PLANNING_DATA | Implementation |
|---------|---------------|----------------|
| **Bank rules** | Standard+ | ✅ API + UI gated |
| **Bulk match (50 tx)** | Standard+ | ✅ API + UI gated; 50-tx limit enforced |
| **AI suggestions** | Standard+ | ✅ Empty suggestions for Basic in reconcile GET |
| **Audit trail** | Standard+ | ✅ API + UI gated |
| **Discrepancy report** | Standard+ | ✅ API returns empty for Basic; UI shows upgrade message |
| **Missing cheques report** | Standard+ | ✅ API returns empty for Basic; UI shows upgrade message |
| **One-to-many / Many-to-many** | Premium+ | ✅ API + UI gated |
| **Roll forward** | Premium+ | ✅ API + UI gated |
| **Threshold approval** | Premium+ | ✅ Configurable approval threshold in Settings > Branding; reviewers blocked when discrepancy exceeds threshold |
| **Full branding (logo)** | Premium+ | ✅ API + UI gated |
| **Firm dashboard / multi-client** | Firm | ✅ Client filter on Projects gated; Clients page shows upgrade hint |
| **API access** | Firm only | ✅ API keys gated (Firm) |
| **User limit** | Basic: 1, Standard: 3, Premium: 5, Firm: unlimited | ✅ Add-member API + limit enforced; Settings > Members |

### Completed Actions
1. ✅ Plan checks: bank_rules, bulk_match, ai_suggestions, discrepancy_report, missing_cheques, one_to_many, many_to_many, roll_forward, api_access, full_branding.
2. ✅ API keys restricted to Firm plan.
3. ✅ User limit: add-member API in Settings; limit enforced on POST /settings/members.
4. ✅ Full branding (logo) gated to Premium+.

---

## 2. Feature Unification & Flow

### Flow: Document Upload → Map → Reconcile → Review → Report
| Step | Status | Notes |
|------|--------|-------|
| Upload | ✅ | Cash book + bank statement; Excel, CSV, PDF, PNG, JPG, TIFF |
| Map | ✅ | Column mapping, Ghana bank parsers, suggested mapping |
| Reconcile | ✅ | One-to-one, one-to-many, many-to-many, bulk match, bank rules |
| Review | ✅ | Submit for review, approve, reopen |
| Report | ✅ | BRS report, missing cheques, discrepancy, export PDF/Excel |

### UI Consistency
- Role-based visibility (admin, reviewer, preparer, viewer) is applied.
- Settings tabs: route-based (branding, billing, api-keys, bank-rules).
- Project detail: hash-based deep links (#upload, #map, #reconcile, #review, #report).
- Dark mode used across main pages.

### Minor Inconsistencies
- Dashboard and Projects link to `/settings/branding`, etc.; AppLayout Settings links to `/settings` (redirects to branding) – acceptable.
- “Resume” vs “View” for project list: correct by status.

---

## 3. Calculations

### Projects Count
- **Logic:** `incrementProjects` on project create.
- **Storage:** `UsageLog.projectsCount` per org, per period (YYYY-MM).
- **Limit check:** `canCreateProject` uses `projectsUsed >= projectsLimit` (or unlimited).
- **Status:** ✅ Correct.

### Transactions Count
- **Logic:** `incrementTransactions` in document map flow.
- **Storage:** `UsageLog.transactionsCount` per org, per period.
- **Limit check:** `canAddTransactions` before map; blocks if `transactionsUsed + count > transactionsLimit`.
- **Status:** ✅ Correct.

### BRS Report Calculations
- **Balance per bank statement:** ✅ From bank closing balance.
- **Uncredited lodgments / Unpresented cheques:** ✅ From matched/unmatched transactions.
- **Balance per cash book:** ✅ From cash book closing balance.
- **Adjusted / Reconciled balance:** ✅ Standard BRS logic.
- **Discrepancy report:** ✅ Amount bands (0–1, 1–100, 100–500, 500+), date bands.
- **Missing cheques:** ✅ Ageing buckets.

### Intro Offer
- **Eligibility:** Basic plan, first payment, no prior intro.
- **Discount:** 50% off first payment.
- **Status:** ✅ Implemented in subscription flow.

---

## 4. AI / OCR Scraping of Uploaded Content

### Implemented
| Format | Parser | Location | Status |
|--------|--------|----------|--------|
| Excel | xlsx | `parser.ts` | ✅ `parseExcel` |
| CSV | Custom parser | `parser.ts` | ✅ `parseCsv` |
| PDF | Tesseract.js (OCR) | `ocr.ts` | ✅ `parsePdf` (via pdf-to-img) |
| PNG, JPG, TIFF, BMP | Tesseract.js | `ocr.ts` | ✅ `parseImage` |

### Flow
1. `detectFileType` chooses excel | csv | pdf | image.
2. `documents.ts` uses `parseExcel`, `parseCsv`, `parsePdf`, or `parseImage` based on type.
3. OCR (Tesseract) used for PDF and images.
4. Output: `{ headers, rows }` passed into column mapping.

### Ghana Bank Parsers
- Ecobank, GCB, Access, Stanbic, Fidelity, UBA, Absa.
- `detectGhanaBankFormat`, `getSuggestedBankMapping`, `extractChqNoFromDescription`.
- Used in document preview for bank statements.

### Known Constraints
1. **PDF OCR:** Limited to `PDF_OCR_MAX_PAGES` (default 50) to control CPU/time.
2. **Table extraction:** `textToTable` splits on tabs or 2+ spaces; complex tables can misalign.
3. **Language:** Tesseract uses `eng`; Ghana-specific text may need tuning.
4. **Structured PDFs:** Native PDF text extraction is not used; all PDFs go through OCR.

### Suggested Improvements
1. Test PDF/image extraction on real Ghana bank statement samples.
2. Consider native PDF text extraction (e.g. pdf-parse) before falling back to OCR for text PDFs.
3. Add logging/telemetry for OCR errors and accuracy.

---

## 5. Summary

| Area | Status | Priority |
|------|--------|----------|
| Plan-based feature gating | ✅ Implemented | — |
| Usage (projects/transactions) | ✅ | — |
| Calculations (usage, report, intro) | ✅ | — |
| Document parsing (Excel, CSV, PDF, images) | ✅ | — |
| OCR (Tesseract) for PDF/images | ✅ | — |
| Ghana bank parsers | ✅ | — |
| Feature flow (Upload → Report) | ✅ | — |
| User limit per plan | ✅ Implemented (Settings > Members) | — |
| API keys plan restriction (Firm) | ✅ Implemented | — |
