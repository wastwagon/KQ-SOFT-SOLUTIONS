# Implementation Phases: Linking & Consistency Improvements

Implementation of recommendations from `SYSTEM_REVIEW_LINKING_CONSISTENCY.md`, in phases.

---

## Phase 1 — Schema: Document type enum + AuditLog → Project relation

**Goals:**
- Add Prisma enum `DocumentType` for document type (cash_book_receipts, cash_book_payments, bank_credits, bank_debits) to prevent typos and improve type safety.
- Add optional `project` relation on `AuditLog` to `Project` for clearer schema and joins.

**Deliverables:**
- [x] `DocumentType` enum in schema; `Document.type` uses it.
- [x] Migration for new enum and column type change.
- [x] `AuditLog.project` relation; `Project.auditLogs` back-relation.
- [x] API code updated to use enum where needed (TypeScript types).

---

## Phase 2 — Report status: completed only on Approve

**Goals:**
- Set project status to `completed` only when a reviewer approves the project (not when the report is viewed).
- Document the workflow in code and in user-facing docs.

**Deliverables:**
- [x] Remove `status: 'completed'` update from report GET.
- [x] In approve handler, set `status: 'completed'` (final state after approval).
- [x] Update reopen/undo logic if needed (keep allowing reopen from `completed`).
- [x] Brief comment or doc note on status flow: draft → … → submitted_for_review → approved (sets completed).

---

## Phase 3 — Help / tooltips (Reconcile & Report)

**Goals:**
- Add short in-app hints explaining:
  - Cash book receipts vs bank credits (and payments vs debits).
  - Uncredited lodgments vs unpresented cheques.

**Deliverables:**
- [x] Reconcile page: collapsible or inline help section / tooltip.
- [x] Report page: same or link to same copy (e.g. near BRS statement or Summary).

---

## Phase 4 — Attachments vs Documents (Help note)

**Goals:**
- Clarify in UI: “Source data” = cash book & bank statement uploads; “Supporting documents” = Attachments (e.g. approval scans).

**Deliverables:**
- [x] One-line note in Settings (Help or Data sources) or on Project Report/Upload section.
- [x] Optional: small “What’s the difference?” expandable on Upload or Report.

---

## Phase 5 — Bank account in report title

**Goals:**
- Ensure BRS title/header clearly shows the selected bank account name in web, PDF, and Excel.
- Document behaviour.

**Deliverables:**
- [x] Verify web report header shows selected bank account.
- [x] Verify PDF and Excel export include bank account in title/header.
- [x] Add note in `GHANA_BRS_LAYOUT.md` or implementation doc.

---

## Status summary

| Phase | Description                    | Status   |
|-------|--------------------------------|----------|
| 1     | Document enum + AuditLog relation | Done     |
| 2     | Report status (completed on approve) | Done     |
| 3     | Help / tooltips                | Done     |
| 4     | Attachments vs Documents note  | Done     |
| 5     | Bank account in report title   | Done     |
