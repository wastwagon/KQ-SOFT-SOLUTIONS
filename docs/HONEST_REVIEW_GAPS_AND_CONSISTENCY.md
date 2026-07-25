# BRS — Honest Review: Gaps, Linking, and Consistency

**Purpose:** Compare database, backend, frontend, and plan to identify what’s missing, inconsistent, or incomplete.

---

**Feb 2026:** Many items below are now implemented. See STATUS.md, BRS_REVIEW_2026.md, and DB_BACKEND_DASHBOARD_COMPARISON.md for current state. Roles enforced; ProjectNew has reconciliationDate and rollForwardFromProjectId; many-to-many in UI; deep links; Admin backoffice complete.

---

## 1. Database vs frontend (in DB, not in UI)

| Entity / Field | In DB | In API | In frontend | Gap |
|----------------|-------|--------|-------------|-----|
| **OrganizationMember.role** | `admin \| reviewer \| preparer \| viewer` | Auth returns `role` | Only **admin** used (`isAdmin()`) | **Reviewer, preparer, viewer** are never shown or enforced. Role-based UI (e.g. “preparer can’t delete”) is not implemented. |
| **Project.reconciliationDate** | ✅ | ✅ (create + report) | ✅ ProjectNew form | No gap. |
| **Project.rollForwardFromProjectId** | ✅ | ✅ (create) | ❌ Not in ProjectNew | User cannot choose “roll forward from” when creating from scratch. Roll forward only exists from **ProjectReport** (“Create next period”). |
| **UsageLog** | ✅ | ✅ (subscription/usage) | ✅ (Dashboard metrics) | No gap. |
| **PasswordResetToken** | ✅ | ✅ (forgot/reset) | ✅ (ForgotPassword, ResetPassword) | No gap. |
| **Match.type** | `one_to_one \| one_to_many \| many_to_one \| many_to_many` | ✅ Set in reconcile routes | ✅ UI supports all (including many-to-many for Premium+) | No gap. |

**Summary:**  
- **Missing in UI:** reconciliation date and “roll forward from” in **New Project**; **reviewer/preparer/viewer** roles; **many-to-many** matching in Reconcile.  
- **Recommendation:** Add optional reconciliation date (and optionally “roll forward from”) to ProjectNew; document or implement role behaviour; add or explicitly defer many-to-many in UI.

---

## 2. Frontend vs backend (in UI/API client, not in backend or DB)

| Feature / Call | Frontend | Backend / DB | Gap |
|----------------|----------|--------------|-----|
| **Projects list by client** | `projects.list({ clientId })` | ✅ GET `/projects?clientId=` | None. |
| **Reconcile multi-match** | `reconcile.createMatchMulti` | ✅ POST `/reconcile/:id/match/multi` | None. |
| **Report export PDF/Excel** | `report.exportPdf` / `exportExcel` | ✅ GET `/report/:id/export?format=` | None. |
| **Settings branding** | `settings.getBranding` / `updateBranding` | ✅ | None. |
| **Bank rules** | Full CRUD in Settings | ✅ `/api/v1/bank-rules` | ✅ API root lists `bankRules`. No gap. |

**Summary:**  
- No “frontend-only” features that have no backend.  
- **Fix:** Add `bank-rules: '/api/v1/bank-rules'` to the API root `endpoints` in `api/src/index.ts`.

---

## 3. Pages and routing

| Route | Page | Used in nav / links | Notes |
|-------|------|---------------------|--------|
| `/` | Dashboard | ✅ Sidebar | OK. |
| `/login` | Login | ✅ Public, link from Register/Forgot/Reset | OK. |
| `/register` | Register | ✅ Public, link from Login | OK. |
| `/forgot-password` | ForgotPassword | ✅ Link from Login | OK. |
| `/reset-password` | ResetPassword | ✅ Link in email (APP_URL) | OK. |
| `/projects` | Projects | ✅ Sidebar | OK. |
| `/projects/new` | ProjectNew | ✅ Dashboard “+ New Project”, Projects “+ New Project” | OK. |
| `/projects/:id` | ProjectDetail | ✅ Projects table, Dashboard recent | OK. |
| `/audit` | Audit | ✅ Sidebar, Dashboard “Manage” (admin) | OK. |
| `/clients` | Clients | ✅ Sidebar | OK. |
| `/settings` | Settings | ✅ Sidebar, Dashboard “Manage” (admin) | OK. |

**Child views (no own route):**  
- ProjectMap, ProjectReconcile, ProjectReview, ProjectReport are **steps inside** `ProjectDetail` (tab/step state). No separate routes.  
- **Deep linking:** You cannot open “Reconcile” or “Report” for a project via URL; you open `/projects/:id` and then switch step. Consider `projects/:id/reconcile` or hash `#reconcile` if you want shareable links.

**Summary:**  
- All main pages are reachable and linked.  
- **Gap:** No deep links to project steps (Map / Reconcile / Review / Report).

---

## 4. Linking and navigation

| From | To | How | Missing? |
|------|----|-----|----------|
| Dashboard | Projects, Project new, Project detail | Links | No. |
| Dashboard (admin) | Settings (#branding, #billing, #bank-rules), Audit | Links | No. |
| Projects | Project detail, Project new, Clients (via client name) | Links, `?clientId=` | No. |
| Clients | Projects filtered by client | `Link to=/projects?clientId=` | No. |
| ProjectDetail | Map, Reconcile, Review, Report | Step buttons | No. |
| ProjectReport | New project (roll forward) | Mutation then `navigate(projects/:id)` | No. |
| Settings | — | Tabs #branding, #billing, #members, #api-keys, #bank-rules | No. |
| Audit | — | Filter by project | No. |

**Consistency:**  
- Sidebar is the single source of main nav; Dashboard “Manage” duplicates Settings/Audit for admins. Acceptable.  
- **Gap:** Clients list links to “X project(s)” with `?clientId=` but Projects page doesn’t show a clear “Filtering by Client: X” when coming from that link (it does set `clientFilter` via `useSearchParams`). Minor UX: could show a chip “Client: X” with clear.

---

## 5. Feature completeness

### 5.1 Auth

- Register, Login, Forgot password, Reset password: **implemented** end-to-end (DB, API, UI).  
- Role: **admin, reviewer, preparer, viewer** enforced in API and UI; Settings > Members shows role and allows admins to change member roles.

### 5.2 Projects and clients

- CRUD projects (create, read, update, delete, reopen): **complete**.  
- List by client: **complete**.  
- Create body supports `reconciliationDate` and `rollForwardFromProjectId` in API; **New Project form includes all** (optional date, optional roll forward dropdown).

### 5.3 Documents and mapping

- Upload cash book (receipts/payments) and bank (credits/debits): **complete**.  
- Document preview and column mapping: **complete**.  
- Mapping applied → transactions created, status → mapping: **complete**.

### 5.4 Reconciliation and matching

- Get reconcile state (unmatched + matches): **complete**.  
- 1-to-1 match: **complete**.  
- 1-to-many and many-to-1 (multi-match): **complete** (API + UI).  
- Bulk match: API exists; UI uses it where applicable.  
- Delete match: **complete**.  
- **many_to_many**: ✅ supported in API and UI (Premium+; multi-select cash book + bank).  
- AI/suggestions and bank rules: **implemented** (suggestions, confidence, rules).

### 5.5 Review and report

- Review step (summary, links to Reconcile/Report): **complete**.  
- Report data and export (PDF/Excel): **complete**.  
- Roll forward (create next period from Report): **complete**.

### 5.6 Subscription and billing

- Usage (projects/transactions, limits): **complete**.  
- Plans and Paystack init: **complete**.  
- Intro offer (50% first 2 months): **complete**.  
- Admin plan override: ✅ AdminOrgDetail allows plan override; AdminPlans full CRUD; AdminPayments lists all payments.

### 5.7 Audit and settings

- Audit list (filter by project, pagination in UI): **complete**.  
- Settings: Branding, Billing, Bank rules: **complete**.  
- Admin user management: ✅ AdminUsers list, AdminUserDetail (view, edit, suspend).

**Summary:**  
- Core flow (upload → map → reconcile → review → report) is **complete**.  
- Plan gating, threshold approval, members with role update, admin backoffice (users, orgs, plans, payments, revenue) — all implemented.

---

## 6. Unification and consistency

### 6.1 Naming

- **API:** `reconcile`, `documents`, `report`, `bank-rules`, `subscription`, `audit`, `settings` — consistent.  
- **Frontend api.ts:** Same names; `bankRules` (camelCase) for client.  
- **DB:** `Project.status` = draft | mapping | reconciling | completed; **UI** uses same labels.  
- **Document types:** cash_book_receipts, cash_book_payments, bank_credits, bank_debits — same in API and UI.

### 6.2 Design and UI

- **Layout:** Single AppLayout (sidebar + top bar) for all app routes; auth pages are full-width. **Consistent.**  
- **Components:** MetricCard, Card, Button, EmptyState, Skeleton, ThemeToggle — used across Dashboard, Projects, Clients, Audit, Settings. **Consistent.**  
- **Dark mode:** Applied across auth, dashboard, projects, clients, audit, settings, project detail (including Map); Reconcile/Review/Report partly inherit. **Mostly consistent.**  
- **Theme:** Light/dark/system, persisted; system preference listener. **Consistent.**

### 6.3 Errors and loading

- **Loading:** Skeleton or “Loading…” on list/detail pages. **Consistent.**  
- **Errors:** Mutation errors shown inline; API errors as `err.message`. **Consistent.**  
- **Empty states:** EmptyState component with icon, title, description, CTA where appropriate. **Consistent.**

### 6.4 API contract

- **Auth:** Token in header; 401 on invalid/expired.  
- **Errors:** `{ error: string }` in JSON.  
- **List responses:** Often `array` or `{ logs }` (audit); projects/clients return arrays. Minor inconsistency (audit returns `{ logs }`, others return top-level array). Acceptable.

**Summary:**  
- Naming, layout, and component usage are **unified**.  
- Small inconsistency: **API root** omits `bank-rules` in the listed endpoints.

---

## 7. Plan vs reality (enhancement plan)

| Plan item | Status |
|-----------|--------|
| Phase A — Design tokens, sidebar + top bar, shared components, migrate pages | **Done.** |
| Phase B — User dashboard polish, empty states, loading skeletons | **Done.** |
| Phase C — Admin grouping in sidebar, Settings tabs, Audit table (sort, filter, pagination) | **Done.** |
| Phase D — Dark mode, focus/ARIA, auth consistency | **Done.** |
| Extensions — Forgot/Reset dark, theme System, more dark mode | **Done.** |
| “Admin user management” / “Subscription management (admin)” | **Held** as in plan. |

**Reality:**  
- The enhancement plan (Phases A–D + extensions) is **implemented**.  
- **Held** items (admin user management, subscription management) are **intentionally** not implemented and match the plan.

---

## 8. Recommended fixes and next steps (priority)

### High impact

1. **New Project form**  
   - Add optional **Reconciliation date** (date input).  
   - Optionally add **Roll forward from** (dropdown of completed projects) when creating a “next period” from the app (not only from Report).

2. **API root**  
   - Add `bank-rules: '/api/v1/bank-rules'` to `GET /api/v1` response in `api/src/index.ts`.

### Medium impact

3. **Roles**  
   - Either **use** reviewer/preparer/viewer (e.g. restrict delete/reopen to admin, or show “Viewer” in UI), or **document** that only admin is meaningful for now and keep schema for later.

4. **Deep links for project steps**  
   - Support e.g. `/projects/:id#reconcile` or `/projects/:id/report` and set step from hash/route so “Reconcile” and “Report” are shareable.

### Low impact / optional

5. **Many-to-many matching**  
   - Add UI for “multiple cash book ↔ multiple bank” in Reconcile, or document that it’s out of scope for v1.

6. **Projects filter UX**  
   - When `clientId` is in URL, show a clear “Filtering by: Client Name” chip with option to clear.

7. **Reconcile/Review/Report dark mode**  
   - Finish any remaining dark-mode classes inside ProjectReconcile, ProjectReview, ProjectReport for full parity.

---

## 9. Summary table

| Area | DB | API | Frontend | Linking | Consistency |
|------|----|-----|----------|---------|-------------|
| Auth + roles | ✅ | ✅ | ✅ | ✅ | Roles enforced |
| Projects | ✅ | ✅ | ✅ | ✅ | OK |
| Clients | ✅ | ✅ | ✅ | ✅ | OK |
| Documents + mapping | ✅ | ✅ | ✅ | ✅ | OK |
| Reconcile + matches | ✅ | ✅ | ✅ | ✅ | OK (incl. many_to_many) |
| Report + export | ✅ | ✅ | ✅ | ✅ | OK |
| Subscription + usage | ✅ | ✅ | ✅ | ✅ | OK |
| Audit | ✅ | ✅ | ✅ | ✅ | OK |
| Settings + bank rules + members | ✅ | ✅ | ✅ | ✅ | OK |
| Admin backoffice | — | ✅ | ✅ | ✅ | OK |

**Last updated:** February 2026.
