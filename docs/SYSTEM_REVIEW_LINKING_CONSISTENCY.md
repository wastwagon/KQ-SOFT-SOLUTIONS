# System Review: Linking, Connectivity, Consistency & BRS Best Practice

**Purpose:** Review the entire BRS application for linking, communication, grouping, consistency, and alignment with bank reconciliation / cash book / report best practice. Identifies gaps and improvements.

---

## 1. Data model — linking & grouping

### 1.1 Entity relationships (current)

| From | To | Link | Notes |
|------|-----|------|--------|
| **Organization** | User (members) | OrganizationMember | Many-to-many; role per org. |
| **Organization** | Client, Project, Plan (slug), BankRule, AuditLog, ApiKey, Payment, UsageLog | FKs | Consistent org scoping. |
| **Project** | Client | clientId (optional) | Correct: project can have one client. |
| **Project** | Project (roll-forward) | rollForwardFromProjectId | Correct: one previous project for brought-forward unpresented cheques. |
| **Project** | Document, Match, BankAccount, BrsAttachment | FKs | All project-scoped. |
| **Document** | BankAccount | bankAccountId (optional) | Only for bank_credits / bank_debits. Correct. |
| **Document** | Transaction | documentId | One document → many transactions. |
| **Match** | MatchItem | matchId | One match → many items (cash_book + bank sides). |
| **MatchItem** | Transaction | transactionId | Links match to specific transactions. |
| **Transaction** | MatchItem | (reverse) | Enables “which matches use this tx?”. |

**Strengths:** Clear hierarchy (Org → Project → Document → Transaction). Matches correctly link cash book and bank transactions. Roll-forward and multi-bank are modelled.

**Gaps / improvements:**

1. **AuditLog** has no FK to Project in schema (projectId is stored but not a formal relation). Consider adding `project Project?` relation for referential clarity and joins.
2. **Document type consistency:** Exactly four types used: `cash_book_receipts`, `cash_book_payments`, `bank_credits`, `bank_debits`. No enum in schema — consider a Prisma enum or DB check constraint to prevent typos.
3. **BrsAttachment vs Document:** Attachments are “supporting” (PDFs, scans); Documents are “source data” (cash book / bank statement). The split is correct; ensure UI and docs clearly distinguish “Upload cash book / bank statement” (Document) vs “Attach supporting document” (BrsAttachment).

---

## 2. API — connectivity & consistency

### 2.1 Route summary

| Area | Base path | Frontend usage | Notes |
|------|-----------|----------------|--------|
| Auth | `/api/v1/auth` | Login, register, me, forgot, reset | Consistent. |
| Projects | `/api/v1/projects` | list, get(slug), create, update, delete, submit, approve, reopen, undo, report-comments | Slug/id resolved via `resolveProjectId`. |
| Upload | `/api/v1/upload` | cash-book, bank-statement, attachments, branding-logo | All require projectId (or none for logo). |
| Documents | `/api/v1/documents` | preview, map, transactions | Document id (not slug). |
| Reconcile | `/api/v1/reconcile` | get, match, match/multi, match/bulk, delete match | projectId (slug/id) + optional bankAccountId. |
| Report | `/api/v1/report` | get, export | projectId + optional bankAccountId. |
| Bank accounts | `/api/v1/bank-accounts` | project/:projectId list, create | Correct. |
| Attachments | `/api/v1/attachments` | list?projectId=, :id/download, delete | List requires projectId (query). |
| Settings, subscription, audit, clients, api-keys, bank-rules | As per plan | Used from web | Consistent. |
| Admin | `/api/v1/admin` | overview, organizations, users, plans, payments, revenue, generation-settings | Org resolved by slug or id. |

**Strengths:** All major flows have a corresponding API. Project and org resolution accept slug or id consistently. Reconcile and report share the same document-type and bank-account filtering.

**Gaps / improvements:**

1. **Attachments list:** Frontend calls `attachments.list(projectId)` which sends `projectId` as query. API uses `resolveProjectId(req.query.projectId, orgId)` — so slug is supported. Consistent.
2. **Report GET sets status = 'completed':** On every report view, the project status is updated to `completed`. This is a design choice: “viewing the report marks the project complete.” Alternative: set `completed` only when the project is approved (or never auto-set). Document this behaviour in user docs; if you prefer “completed only after approval,” move the update to the approve flow and remove it from report GET.
3. **Export audit:** Both PDF and Excel export log `report_exported` with details `{ format }`. Consistent.

---

## 3. Frontend — linking & communication

### 3.1 Navigation and project identity

- **Projects list** → links to `/projects/:slug`. **ProjectDetail** loads project by `slug` (from URL); passes `slug` to ProjectMap, ProjectReconcile, ProjectReview, ProjectReport as `projectId`. API accepts slug everywhere via `resolveProjectId`. **Consistent.**
- **Step flow:** Upload → Map → Reconcile → Review → Report. Hash sync (`#upload`, `#map`, etc.) and step state stay in sync. **Good.**

### 3.2 Data flow and invalidation

- After upload (cash book or bank statement): `queryClient.invalidateQueries({ queryKey: ['project', slug] })` (and bank accounts for bank upload). Reconcile and report both depend on project (and optionally bankAccountId). **Correct.**
- After match create/delete: reconcile invalidates `['reconcile', projectId]`; report data is refetched when user opens Report (queryKey `['report', projectId, bankAccountId]`). **Consistent.**
- **ProjectReport** uses `projectId` (actually slug) for report.get, attachments.list, export, reopen, undo, submit, approve, updateReportComments. **All aligned.**

### 3.3 Gaps / improvements

1. **Project.id vs slug:** Some invalidation uses `queryKey: ['project', projectId]` where projectId is the slug. That’s correct because the query is keyed by slug. No change needed; just keep using slug in query keys where the API is called with slug.
2. **Bank account context:** When user selects a bank account on Report or Reconcile, the same `bankAccountId` is passed to API. No persistence of “last selected” bank account — acceptable; consider optional localStorage for UX.

---

## 4. Bank reconciliation structure & terminology

### 4.1 Cash book vs bank (alignment with practice)

| Concept | Model / UI | Standard BRS | Aligned? |
|--------|------------|--------------|----------|
| Cash book receipts | Document type `cash_book_receipts` | Receipts (money in) | Yes |
| Cash book payments | Document type `cash_book_payments` | Payments (money out, e.g. cheques) | Yes |
| Bank credits | Document type `bank_credits` | Lodgments / credits to account | Yes |
| Bank debits | Document type `bank_debits` | Withdrawals / debits from account | Yes |
| Matching | Receipts ↔ Credits; Payments ↔ Debits | Same | Yes |
| Uncredited lodgments | Receipts not yet matched to bank credits | Standard term | Yes (report uses this) |
| Unpresented cheques | Payments not yet matched to bank debits | Standard term | Yes (report uses this) |

**Conclusion:** Document types and report terminology align with standard BRS and Ghana practice (see `docs/GHANA_BRS_LAYOUT.md`).

### 4.2 Report structure (BRS layout)

- Order: Header (org, title, date, bank account, currency) → BRS statement block (closing balance per bank, add uncredited lodgments, less unpresented cheques, balance per cash book) → Summary cards → Brought forward (if roll-forward) → Missing cheques / ageing → Discrepancies → Matched → Exceptions (4 grids) → Supporting documents → Footer.  
- **Aligned with best practice** and with `docs/GHANA_BRS_LAYOUT.md`.

### 4.3 Roll-forward

- **Linking:** Project has `rollForwardFromProjectId` → previous project. Brought-forward items are computed from the previous project’s unmatched payments (cash book). **Correct.**
- Report and export both include brought-forward unpresented cheques in the “Less: Unpresented cheques” total. **Consistent.**

---

## 5. Consistency — formatting, permissions, audit

### 5.1 Formatting

- **Dates:** `formatDate()` / `formatDateBRSTitle()` from `web/src/lib/format.ts`; used on Report, Reconcile, Review, Dashboard, Projects, Audit, Admin. **Consistent.**
- **Amounts:** `formatAmount(amount, currency)` (GHS default, GH₵ symbol). Used in report, reconcile, review, exports. **Consistent.**
- **Currency:** Project has `currency`; report and exports use it. **Consistent.**

### 5.2 Permissions

- **Roles:** admin, reviewer, preparer, viewer. Permissions (e.g. `canExportReport`, `canReconcile`, `canEditProject`) applied in API and optionally in UI. **Consistent.**
- **Audit:** All critical actions (document upload/map, match create/delete/bulk, report generate/export, project submit/approve/reopen, attachment upload/delete, reconciliation undone) call `logAudit` with organizationId, projectId where applicable, and action. **Consistent.**  
- **Fix applied:** Missing audit action labels (`project_submitted`, `project_approved`, `attachment_uploaded`, `attachment_deleted`, `reconciliation_undone`) added in `api/src/routes/audit.ts` so the audit UI shows friendly labels.

### 5.3 Naming and grouping in UI

- **“Cash book”** used for receipts and payments upload and in reconcile (receipts vs credits, payments vs debits). **Consistent.**
- **“Bank statement”** used for credits/debits upload; “Bank account” for multi-bank. **Consistent.**
- **Report:** “Uncredited lodgments,” “Unpresented cheques,” “Balance per cash book” used in web, PDF, and Excel. **Consistent** with `docs/GHANA_BRS_LAYOUT.md`.

---

## 6. Gaps and improvement checklist

### 6.1 Fixed in this review

- [x] **Audit action labels** — Added missing labels for project_submitted, project_approved, attachment_uploaded, attachment_deleted, reconciliation_undone in `api/src/routes/audit.ts`.

### 6.2 Recommended (non-blocking)

| # | Area | Recommendation |
|---|------|----------------|
| 1 | **Document type** | Add a Prisma enum or DB check for document type (cash_book_receipts, cash_book_payments, bank_credits, bank_debits) to avoid typos. |
| 2 | **Report status** | Document that “View report” sets project status to `completed`, or change so that `completed` is set only on “Approve” (and remove from report GET). |
| 3 | **AuditLog relation** | Add optional `projectId` relation on AuditLog to Project for clearer schema and joins. |
| 4 | **Help / tooltips** | Add short in-app hints for “Cash book receipts vs Bank credits” and “Uncredited lodgments vs Unpresented cheques” (e.g. on first Reconcile or Report view). |
| 5 | **Bank account in report title** | When a single bank account is selected, ensure the BRS title or header clearly shows the bank account name (already present; keep consistent in PDF/Excel). |
| 6 | **Attachments vs Documents** | In Settings or Help, one-line note: “Source data: Cash book & bank statement uploads. Supporting documents: Attachments (e.g. approval scans).” |

### 6.3 Optional enhancements

- **Reconcile ↔ Report link:** From Reconcile, a prominent “View report” button (already exists via step navigation). No change needed.
- **Project list ↔ Client:** Filter by client and show client name; both present. **Done.**
- **Multi-bank:** Report and Reconcile filter by bank account; upload associates statements with accounts. **Done.**

---

## 7. Thorough review — linking & correspondence (latest)

### 7.1 Project identity (slug vs id)

| Location | Uses | Corresponds to API |
|----------|------|--------------------|
| **App.tsx** | Route `projects/:slug` | ProjectDetail receives `slug` from URL. |
| **ProjectDetail** | `slug` from `useParams`; passes `slug` as `projectId` to Map, Reconcile, Review, Report | All API calls use slug; `resolveProjectId(slug, orgId)` resolves to internal id. |
| **ProjectMap** | `projectId` (slug); queryKey `['project', id]` where id = projectId | projects.get(slug), documents.preview(map) use same slug. |
| **ProjectReconcile** | `projectId` (slug); queryKey `['reconcile', projectId, bankAccountId]` | reconcile.get(projectId, { bankAccountId }). |
| **ProjectReview** | `projectId` (slug) | reconcile.get(projectId). |
| **ProjectReport** | `projectId` (slug); report.get, export, reopen, undo, submit, approve, updateReportComments, roll-forward | All use slug; roll-forward create sends `rollForwardFromProjectId: projectId` (slug), API resolves via `resolveProjectId`. |

**Conclusion:** Frontend consistently uses slug as project identifier; API resolves slug to internal id in one place. **Correct.**

### 7.2 Reconcile ↔ Report data correspondence

| Data | Reconcile API | Report API | Match |
|------|---------------|------------|--------|
| Receipts | `receipts.transactions` (cash_book_receipts doc) | Same doc type; report uses for BRS totals | Yes |
| Payments | `payments.transactions` (cash_book_payments doc) | Same; unpresented = unmatched payments | Yes |
| Credits / Debits | `credits` / `debits` filtered by bankAccountId | Same filter; same document types | Yes |
| Matched IDs | `matchedCashBookIds`, `matchedBankIds`, `matches` (matchId, cbTx, bankTx) | Report builds matchedPairs, unmatched* from same match items | Yes |
| Brought forward | N/A (reconcile is current period) | `broughtForwardItems` from rollForwardFrom project’s unmatched payments | Yes |

**Conclusion:** Reconcile and report use the same document types and match model; report adds roll-forward and summary/export. **Consistent.**

### 7.3 Report section anchors (Five reports)

| Nav link | Target id | Fixed |
|----------|-----------|--------|
| #brs-statement | id="brs-statement" | Already unique. |
| #brs-summary | id="brs-summary" | Already unique. |
| #missing-cheques-report | id="missing-cheques-report" | **Fixed:** Single wrapper div with id; content conditional inside (no duplicate ids). |
| #discrepancy-report | id="discrepancy-report" | **Fixed:** Single wrapper div with id; when feature on but no data, section still exists with “No variances” message (anchor always valid). |
| #supporting-documents | id="supporting-documents" | Already unique. |

**Conclusion:** All five report sections now have exactly one element with the corresponding id; quick links and deep links work. **Fixed in ProjectReport.tsx.**

### 7.4 Roll-forward flow

| Step | Frontend | API | Correspondence |
|------|----------|-----|-----------------|
| Create next period | `projects.create({ name: '… (next period)', rollForwardFromProjectId: projectId })` with projectId = current slug | POST /projects; `resolveProjectId(body.rollForwardFromProjectId)` → prev project id; new project created with `rollForwardFromProjectId: rollForwardId` | Correct. |
| Navigate | `onRollForward?.(newProject.slug ?? newProject.id)` → `navigate(\`/projects/${newProjectId}\`)` | POST returns full project (includes `slug`) | Correct; URL uses slug. |
| Brought forward | Report GET loads project with rollForwardFrom; fetches prev project’s unmatched payments | Same project.rollForwardFromProjectId used to load previous project and build broughtForwardItems | Correct. |

**Conclusion:** Roll-forward create, navigate, and report brought-forward items are correctly linked. **Correct.**

### 7.5 Match / unmatch and query invalidation

| Action | Mutation | Invalidations | Result |
|--------|----------|---------------|--------|
| Create match (single/bulk/multi) | reconcile.createMatch / createMatchBulk / createMatchMulti | `['reconcile', projectId]`, `['project', projectId]`, `['projects']` | Reconcile and project data refetched; report refetched when user opens Report (same queryKey). |
| Delete match | reconcile.deleteMatch | Same | Same. |
| Submit / Approve / Reopen / Undo | projects.submit / approve / reopen / undoReconciliation | report, project, projects | Report and list stay in sync. |

**Conclusion:** All mutations that affect reconcile or report invalidate the right query keys. **Correct.**

---

## 8. Summary

- **Linking:** Data model and API correctly link Organisation → Project → Document → Transaction and Match → MatchItem → Transaction. Roll-forward and multi-bank are properly connected.
- **Communication:** API routes match frontend usage; project and org resolution by slug or id is consistent; query invalidation keeps report and reconcile in sync.
- **Grouping:** Cash book (receipts + payments) vs bank (credits + debits) is clear in schema and UI; report sections are grouped in a standard BRS order.
- **Consistency:** Terminology (uncredited lodgments, unpresented cheques, balance per cash book), formatting (dates, amounts, currency), permissions, and audit coverage are consistent. Audit action labels were completed.
- **Best practice:** Structure and terminology align with standard bank reconciliation and with Ghana BRS layout as documented in `docs/GHANA_BRS_LAYOUT.md`. Remaining items are small documentation or schema improvements and optional UX tweaks.
- **Thorough review (latest):** Project slug/id usage is consistent; reconcile and report data correspond; report section IDs are unique and anchor links valid; roll-forward and match invalidation are correctly linked. Fixes applied: single wrapper divs for `#missing-cheques-report` and `#discrepancy-report` so each section has exactly one id.
