# BRS Gap Implementation Phases

**Purpose:** Implement all identified gaps in safe, sequenced phases with minimal risk and clear rollback points.

---

## Phase Overview

| Phase | Name | Risk | Schema | Est. Effort |
|-------|------|------|--------|-------------|
| 1 | Quick Wins & Consistency | Low | None | 1–2 days |
| 2 | Roles & Access Control | Low | None | 2–3 days |
| 3 | Many-to-Many Matching UI | Low | None | 1–2 days |
| 4 | Deep Links & UX Polish | Low | None | 0.5–1 day |
| 5 | BRS Sign-Off & Approval Workflow | Medium | Yes | 3–4 days |
| 6 | Dedicated Reports | Low | None | 2–3 days |
| 7 | Supporting Documents | Medium | Yes | 2–3 days |
| 8 | Undo Prior Reconciliation | Medium | Optional | 2 days |
| 9 | Multi-Currency | Medium | Yes | 3–4 days |
| 10 | Additional Ghana Banks | Low | None | 1–2 days |
| 11 | Multi-Bank / Multi-Account | High | Yes | 5–7 days |
| 12 | Public API | Medium | Yes (API keys) | 3–4 days |
| 13 | Bank Integration (Future) | High | Yes | TBD |

---

## Phase 1 — Quick Wins & Consistency ✅ COMPLETE

**Risk:** Low | **Schema:** None | **Depends on:** Nothing

**Status:** Implemented. ProjectNew already had reconciliation date & roll-forward; API root had bank-rules; Projects had filter chip. Dark mode parity added for Projects status badges; Clear filters now clears URL; ProjectDetail hash listener improved.

### Deliverables

1. **ProjectNew form**
   - Add optional **Reconciliation date** (date input)
   - Add optional **Roll forward from** (dropdown of completed projects)
   - Both fields already supported by API

2. **API root**
   - Add `bank-rules: '/api/v1/bank-rules'` to `GET /api/v1` `endpoints`

3. **Projects filter chip**
   - When `clientId` in URL, show "Filtering by: Client Name" chip with clear button

4. **Dark mode parity**
   - Ensure ProjectReconcile, ProjectReview, ProjectReport use dark-mode classes consistently

### Files to touch
- `web/src/pages/ProjectNew.tsx`
- `api/src/index.ts`
- `web/src/pages/Projects.tsx`
- `web/src/pages/ProjectReconcile.tsx`, `ProjectReview.tsx`, `ProjectReport.tsx`

### Rollback
- Revert form fields; API remains backward compatible
- No data migration

---

## Phase 2 — Roles & Access Control ✅ COMPLETE

**Risk:** Low | **Schema:** None | **Depends on:** Nothing

**Status:** Implemented. Auth middleware fetches role from membership; API enforces permissions on delete, reopen, create, edit, upload, map, reconcile, export, branding, bank rules; UI hides/disables controls based on role.

### Deliverables

1. **Role display**
   - Show member role (admin, reviewer, preparer, viewer) in Settings / Members or Clients
   - Allow admin to change member role (if member management exists)

2. **Role-based restrictions**
   - **Viewer:** Read-only (projects, report, audit); no create/edit/delete/match/export
   - **Preparer:** Can upload, map, reconcile, create matches; cannot delete project, reopen, change bank rules, manage billing
   - **Reviewer:** Preparer + can review, reopen, export; cannot manage org, members, billing
   - **Admin:** Full access

3. **UI enforcement**
   - Hide/disable buttons based on role
   - API enforcement: add role checks to routes (delete project, reopen, bank rules, settings)

### Files to touch
- `web/src/components/AppLayout.tsx` (sidebar visibility)
- `web/src/pages/Settings.tsx` (members, roles)
- `api/src/middleware/auth.ts` (expose role)
- `api/src/routes/projects.ts`, `report.ts`, `bank-rules.ts`, `settings.ts`
- New: `api/src/lib/permissions.ts` (canDelete, canReopen, canEditRules, etc.)

### Rollback
- Remove UI restrictions; API checks can remain (fail gracefully)

---

## Phase 3 — Many-to-Many Matching UI ✅ COMPLETE

**Risk:** Low | **Schema:** None | **Depends on:** Nothing

**Status:** Implemented. API multi endpoint now supports many_to_many; reconcile GET and report expand many_to_many into pairs; UI allows selecting multiple cash book + multiple bank transactions and matching them.

### Deliverables

1. **Reconcile UI**
   - Add "Link multiple cash book ↔ multiple bank" flow
   - Allow selecting multiple unmatched cash-book and multiple bank transactions
   - Call existing multi-match API or extend for `many_to_many`
   - Display grouped matches correctly in Review/Report

2. **API**
   - Ensure `POST /reconcile/:id/match/multi` or new endpoint supports `type: many_to_many` with multiple items per side

### Files to touch
- `web/src/pages/ProjectReconcile.tsx`
- `api/src/routes/reconcile.ts`
- `api/src/services/matching.ts` (if suggestion logic needed for many:many)

### Rollback
- Remove UI control; API can remain

---

## Phase 4 — Deep Links & UX Polish ✅ COMPLETE

**Risk:** Low | **Schema:** None | **Depends on:** Nothing

**Status:** Implemented. ProjectDetail already had #upload, #map, #reconcile, #review, #report; added hashchange listener for manual URL edits; Clear filters clears URL params.

### Deliverables

1. **Deep links**
   - Support `#upload`, `#map`, `#reconcile`, `#review`, `#report` in project URL
   - On load, read hash and set step; on step change, update hash (without full reload)
   - Ensure back/forward and direct links work

2. **Projects filter chip**
   - (If not in Phase 1) Show "Filtering by: Client X" chip with clear

### Files to touch
- `web/src/pages/ProjectDetail.tsx`
- `web/src/App.tsx` (if routing needed)

### Rollback
- Hash becomes optional; default step unchanged

---

## Phase 5 — BRS Sign-Off & Approval Workflow ✅ COMPLETE

**Risk:** Medium | **Schema:** Yes | **Depends on:** Phase 2 (roles)

**Status:** Implemented. Schema migration adds preparedBy/reviewedBy/approvedBy and dates. API: PATCH submit (draft/mapping/reconciling → submitted_for_review), PATCH approve (submitted_for_review → approved), reopen accepts all statuses. Project edit routes blocked when status is locked. Report returns sign-off data; ProjectReport shows Prepared/Reviewed/Approved block. ProjectReview has Submit and Approve buttons. Projects list: status filters and badges for Submitted and Approved.

### Schema changes

```prisma
model Project {
  // ... existing fields
  status String @default("draft")  // draft | mapping | reconciling | submitted_for_review | approved | completed
  preparedById   String?  @map("prepared_by_id")
  preparedAt     DateTime? @map("prepared_at")
  reviewedById   String?  @map("reviewed_by_id")
  reviewedAt     DateTime? @map("reviewed_at")
  approvedById   String?  @map("approved_by_id")
  approvedAt     DateTime? @map("approved_at")

  preparedBy User? @relation("PreparedBy", fields: [preparedById], references: [id])
  reviewedBy User? @relation("ReviewedBy", fields: [reviewedById], references: [id])
  approvedBy User? @relation("ApprovedBy", fields: [approvedById], references: [id])
}

model User {
  // ... add reverse relations for preparedBy, reviewedBy, approvedBy
}
```

### Deliverables

1. **Workflow states**
   - **draft / mapping / reconciling:** Normal editing
   - **submitted_for_review:** Preparer submits; no further edits until reopen
   - **approved:** Reviewer/Admin approves; BRS locked
   - **completed:** Legacy/alias for approved, or separate final state

2. **Actions**
   - "Submit for review" (preparer, reviewer) → sets preparedBy, preparedAt, status
   - "Approve" (reviewer, admin) → sets reviewedBy/approvedBy, dates
   - "Reopen" (reviewer, admin only) → back to reconciling; log audit

3. **Report**
   - Show "Prepared by", "Reviewed by", "Approved by" with names and dates on BRS report
   - Show status badge

4. **Restrictions**
   - Only reviewer/admin can reopen and approve
   - Reopen requires reason (optional but recommended); log in audit

### Files to touch
- `api/prisma/schema.prisma`
- `api/src/routes/projects.ts`, `report.ts`
- `web/src/pages/ProjectReport.tsx`, `ProjectDetail.tsx`, `ProjectReconcile.tsx`
- `api/src/services/audit.ts` (new actions: `project_submitted`, `project_approved`, `project_reopened`)

### Rollback
- Migration adds columns as nullable; old projects unaffected
- Can keep using `completed` as before and ignore new fields

---

## Phase 6 — Dedicated Reports ✅ COMPLETE

**Risk:** Low | **Schema:** None | **Depends on:** Nothing

**Status:** Implemented. Missing Cheques Report with ageing buckets (0–30, 31–60, 61–90, 90+ days) and summary; Reconciliation Discrepancy Report with variance bands (amount: 0–1, 1–100, 100–500, 500+; date: 0–7, 7–30, 30+ days). Quick links (BRS Summary, Missing Cheques, Discrepancy Report). Excel export includes "Missing Cheques Ageing" sheet and enhanced "Discrepancies" sheet with Amount/Date Band columns.

### Deliverables

1. **Missing Cheques Report**
   - Dedicated section/report: unpresented cheques with ageing (e.g. 0–30, 31–60, 61–90, 90+ days)
   - Exportable in Excel/PDF
   - Link from main BRS report

2. **Reconciliation Discrepancy Report**
   - Dedicated report: matched pairs with variance (amount/date)
   - Include ageing and summary by variance band
   - Exportable

3. **Reconciliation Status Report** (optional)
   - Overview: reconciled vs unreconciled by project/period
   - Filter by date range, client

### Files to touch
- `api/src/routes/report.ts` (new endpoints or report sections)
- `web/src/pages/ProjectReport.tsx` (tabs or links to sub-reports)
- Excel/PDF export logic for new reports

### Rollback
- Add as optional views; no breaking changes

---

## Phase 7 — Supporting Documents ✅ COMPLETE

**Risk:** Medium | **Schema:** Yes | **Depends on:** Nothing

**Status:** Implemented. BrsAttachment model added; migration 20250228180000_add_brs_attachments. API: POST /upload/attachments/:projectId, GET /attachments?projectId=, GET /attachments/:id/download, DELETE /attachments/:id. Supporting documents section in ProjectReport with upload (bank_statement | approval | other), list, download, delete (admin/reviewer). Audit: attachment_uploaded, attachment_deleted.

### Schema changes

```prisma
model BrsAttachment {
  id         String   @id @default(cuid())
  projectId  String   @map("project_id")
  type       String   // bank_statement | approval | other
  filename   String
  filepath   String
  mimeType   String?  @map("mime_type")
  uploadedBy String   @map("uploaded_by")
  createdAt  DateTime @default(now()) @map("created_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [uploadedBy], references: [id])

  @@index([projectId])
  @@map("brs_attachments")
}
```

### Deliverables

1. **Upload**
   - Allow attaching bank statement PDF, approval scan, etc. to a project
   - Store with type and uploader
   - Reuse upload middleware (multer)

2. **UI**
   - List attachments on Project Report / Review
   - Download, delete (admin/reviewer)
   - Optional: attach from Report step

3. **Report**
   - Optional "Supporting documents" section listing attached files

### Files to touch
- `api/prisma/schema.prisma`
- `api/src/routes/upload.ts` or new `attachments.ts`
- `web/src/pages/ProjectReport.tsx`, `ProjectDetail.tsx`

### Rollback
- Table nullable; feature can be disabled in UI

---

## Phase 8 — Undo Prior Reconciliation ✅ COMPLETE

**Risk:** Medium | **Schema:** Optional | **Depends on:** Phase 5 (approval)

**Status:** Implemented. PATCH /projects/:id/undo-reconciliation clears all matches, resets sign-off (preparedBy, reviewedBy, approvedBy), sets status to reconciling. Only reviewer/admin. Optional reason in audit (reconciliation_undone). UI: "Undo reconciliation" button with confirmation modal and optional reason field in ProjectReport.

### Deliverables

1. **Undo semantics**
   - "Undo last reconciliation" = clear matches for a given period/subset and reopen
   - OR: "Reopen" already does this; add explicit "Undo reconciliation" with confirmation

2. **Audit trail**
   - New action: `reconciliation_undone` with details (which matches, reason)
   - Store reason in audit details

3. **Restrictions**
   - Only reviewer/admin
   - Optional: require reason field

### Files to touch
- `api/src/routes/reconcile.ts` or `projects.ts`
- `api/src/services/audit.ts`
- `web/src/pages/ProjectReconcile.tsx`, `ProjectReport.tsx`

### Rollback
- Revert to "Reopen" only; audit remains

---

## Phase 9 — Multi-Currency ✅ COMPLETE

**Risk:** Medium | **Schema:** Yes | **Depends on:** Nothing

**Status:** Implemented. Project.currency (GHS | USD | EUR) with default GHS. Migration 20250228190000_add_project_currency. ProjectNew and ProjectDetail (edit) have currency dropdown. Report, Reconcile, Review use formatAmount(amount, currency) with symbols GH₵, $, €. API: report and reconcile return project.currency; PDF/Excel use project currency.

### Schema changes

```prisma
model Project {
  // ... existing
  currency String @default("GHS")  // GHS | USD | EUR
}

// Or at Organization level if all projects share currency
model Organization {
  // ... existing
  defaultCurrency String @default("GHS") @map("default_currency")
}
```

### Deliverables

1. **Project-level currency**
   - Add currency dropdown (GHS, USD, EUR) in ProjectNew and Project edit
   - Default GHS for backward compatibility

2. **Display**
   - Use currency symbol (GH₵, $, €) in reports, tables, exports
   - Format amounts per locale

3. **No FX conversion**
   - Phase 9 = display only; no automatic conversion
   - FX can be Phase 14+ if needed

### Files to touch
- `api/prisma/schema.prisma`
- `web/src/pages/ProjectNew.tsx`, `ProjectDetail.tsx`
- `web/src/pages/ProjectReport.tsx`, `ProjectReconcile.tsx`, etc.
- `api/src/routes/report.ts` (export currency)

### Rollback
- Default GHS; existing data unchanged
- Migration adds column with default

---

## Phase 10 — Additional Ghana Banks ✅ COMPLETE

**Risk:** Low | **Schema:** None | **Depends on:** Nothing

**Status:** Implemented. Added Stanbic Bank, Fidelity Bank, UBA, Absa parsers. Bank-specific content checked first (stanbic/standard bank, fidelity, uba/united bank, absa/barclays) before generic Ecobank. getSuggestedBankMapping works for all formats. docs/SUPPORTED_BANKS.md lists supported banks.

### Deliverables

1. **Parsers**
   - Add Stanbic Bank
   - Add Fidelity Bank
   - Add UBA, Absa, others as needed

2. **Auto-detect**
   - Extend `ghanaBankParsers.ts` with new header/description patterns
   - Add to `detectGhanaBankFormat` and `getSuggestedBankMapping`

3. **Documentation**
   - List supported banks in Settings or Help

### Files to touch
- `api/src/services/ghanaBankParsers.ts`
- `docs/SUPPORTED_BANKS.md` (optional)

### Rollback
- Remove parser; falls back to manual mapping

---

## Phase 11 — Multi-Bank / Multi-Account ✅ COMPLETE

**Risk:** High (full) | **Low** (simplified) | **Schema:** Yes | **Depends on:** Nothing

**Status:** Implemented full multi-bank in one project. BankAccount model; Document.bankAccountId; upload accepts accountId/accountName; reconcile and report filter by bankAccountId. Reconcile/Report show bank account selector when multiple accounts exist.

### Schema changes (implemented)

```prisma
model BankAccount {
  id         String   @id @default(cuid())
  projectId  String   @map("project_id")
  name       String   // e.g. "Ecobank Main", "GCB Operating"
  bankName   String?  @map("bank_name")
  accountNo  String?  @map("account_no")
  createdAt  DateTime @default(now()) @map("created_at")

  project   Project    @relation(...)
  documents Document[]

  @@map("bank_accounts")
}

model Document {
  // ... existing
  bankAccountId  String?  @map("bank_account_id")  // for bank_credits | bank_debits only
  bankAccount    BankAccount? @relation(...)
}
```

### Deliverables

1. **Model**
   - BankAccount model; multiple bank statement documents per project, each optionally linked to a BankAccount

2. **Upload**
   - Bank statement upload accepts optional `bankAccountId` or `accountName` (creates new account on-the-fly)

3. **Reconciliation**
   - Reconcile GET accepts `?bankAccountId=`; filters bank docs by account; returns bankAccounts list

4. **Report**
   - Report GET/export accept `?bankAccountId=`; per-account or combined BRS

5. **UI**
   - Upload: account selector + optional account name input
   - Reconcile / Report: bank account selector when multiple accounts exist

### Rollback
- bank_account_id nullable; existing projects unaffected

---

## Phase 12 — Public API ✅ COMPLETE

**Risk:** Medium | **Schema:** Yes | **Depends on:** Phase 2 (roles)

**Status:** Implemented. ApiKey model; migration 20250228200000_add_api_keys. API keys: create (returns key once), list, revoke. Auth: `Authorization: Bearer <key>` or `X-API-Key`; JWT vs API key auto-detected. Rate limit: 100 req/min per key. Settings → API keys tab for admin. Existing routes (projects, report, reconcile, clients, etc.) accept API keys.

### Schema changes

```prisma
model ApiKey {
  id             String   @id @default(cuid())
  organizationId String   @map("organization_id")
  name           String   // e.g. "Integration XYZ"
  keyHash        String   @map("key_hash")  // hash of API key, never store plaintext
  keyPrefix      String   @map("key_prefix")  // first 8 chars for identification
  lastUsedAt     DateTime? @map("last_used_at")
  expiresAt      DateTime? @map("expires_at")
  createdAt      DateTime @default(now()) @map("created_at")

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)

  @@index([organizationId])
  @@index([keyPrefix])
  @@map("api_keys")
}
```

### Deliverables

1. **API keys**
   - Admin creates API key (name, optional expiry)
   - Display key once; store only hash + prefix
   - Revoke, list keys

2. **Authentication**
   - `Authorization: Bearer <api_key>` or `X-API-Key: <key>`
   - Validate key, load org, apply rate limits

3. **Endpoints**
   - Read: projects, report, clients
   - Write: projects (create), upload (if needed)
   - Document in OpenAPI/Swagger

4. **Rate limiting**
   - Per key: e.g. 100 req/min
   - Return 429 when exceeded

### Files to touch
- `api/prisma/schema.prisma`
- New: `api/src/middleware/apiKey.ts`
- `api/src/routes/admin.ts` or `settings.ts` (key CRUD)
- API docs

### Rollback
- Disable API key auth; keep routes for internal use

---

## Phase 13 — Bank Integration (Future)

**Risk:** High | **Depends on:** External (banks, aggregators)

### Notes

- Ghana Open Banking / bank APIs are limited
- Options: aggregators (Plaid-style), manual OFX/CSV import improvements, direct bank partnerships
- Defer until Phases 1–10 are live and stable

---

## Implementation Order

1. **Phase 1** – Quick wins
2. **Phase 2** – Roles (enables Phase 5)
3. **Phase 3** – Many-to-many UI
4. **Phase 4** – Deep links
5. **Phase 5** – Sign-off & approval
6. **Phase 6** – Dedicated reports
7. **Phase 7** – Supporting documents
8. **Phase 8** – Undo reconciliation
9. **Phase 9** – Multi-currency
10. **Phase 10** – Additional Ghana banks
11. **Phase 12** – Public API (Phase 11 deferred or simplified)

---

## Success Criteria per Phase

- No regression in existing flows
- Migrations backward-compatible where possible
- Audit trail for all sensitive actions
- Feature flags for high-risk phases (11, 12) if desired
