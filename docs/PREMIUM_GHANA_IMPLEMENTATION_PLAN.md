# Premium Ghana-Acceptable Implementation Plan — Nothing Left Out

**Goal:** World-class, white-label, Ghana-acceptable layout and design across all dashboards and reports, competitive with global leading software.

**Scope:** Every screen, every export, every place branding or formatting appears. This document is the single checklist so nothing is missed.

---

## Part 1 — Complete inventory

### 1.1 Web app — all pages (38 TSX files)

| # | Route / Page | Purpose | Branding / design touchpoints |
|---|----------------|--------|-------------------------------|
| 1 | `/` | **Dashboard** (org home) | Title "Dashboard"; metric cards; "Recent Projects"; "Manage app & settings" card with links to Branding, Billing, Members, API keys, Bank rules, Audit. No org logo/name in layout. |
| 2 | `/projects` | **Projects list** | Title "Projects"; status filter chips; client filter chip; table/cards; "New Project" CTA. Firm dashboard stats grid. |
| 3 | `/projects/new` | **New project** | Form: name, client, reconciliation date, roll-forward, currency, copy settings from. |
| 4 | `/projects/:slug` | **Project detail** (Upload step) | Steps: Upload, Map, Reconcile, Review, Report. Upload: cash book + bank statement; account name/selector for multi-bank. |
| 5 | `/projects/:slug` (Map) | **ProjectMap** | Column mapping UI; Ghana bank auto-detect. |
| 6 | `/projects/:slug` (Reconcile) | **ProjectReconcile** | Receipts vs Credits / Payments vs Debits; suggestions; match tables; bank account selector. |
| 7 | `/projects/:slug` (Review) | **ProjectReview** | Summary totals; variance; Submit for review / Approve. |
| 8 | `/projects/:slug` (Report) | **ProjectReport** | Full BRS report (see 1.3). Export Excel/PDF, Print, bank account selector. |
| 9 | `/clients` | **Clients** | List clients; add client. |
| 10 | `/audit` | **Audit** | Audit log table; filters. |
| 11 | `/settings/branding` | **Settings — Branding** | Logo, primary colour, secondary colour, letterhead, report title, footer, approval threshold. |
| 12 | `/settings/billing` | **Settings — Billing** | Plan, usage, upgrade, Paystack. |
| 13 | `/settings/members` | **Settings — Members** | Members list; add; role per member. |
| 14 | `/settings/api-keys` | **Settings — API keys** | List, create, revoke. |
| 15 | `/settings/bank-rules` | **Settings — Bank rules** | Rules list; add/edit conditions. |
| 16 | `/login` | **Login** | "BRS" title, "Bank Reconciliation SaaS"; form. |
| 17 | `/register` | **Register** | Same style as Login. |
| 18 | `/forgot-password` | **Forgot password** | |
| 19 | `/reset-password` | **Reset password** | |
| 20 | `/platform-admin` | **Admin overview** | Platform admin dashboard. |
| 21 | `/platform-admin/organizations` | **Admin — Organizations** | Subscribers/orgs table. |
| 22 | `/platform-admin/organizations/:slug` | **Admin — Org detail** | Org info, projects, usage. |
| 23 | `/platform-admin/users` | **Admin — Users** | Users table. |
| 24 | `/platform-admin/users/:id` | **Admin — User detail** | User info, suspend. |
| 25 | `/platform-admin/plans` | **Admin — Plans** | Plans table. |
| 26 | `/platform-admin/payments` | **Admin — Payments** | Payments table. |
| 27 | `/platform-admin/revenue` | **Admin — Revenue** | Revenue view. |
| 28 | `/platform-admin/generation-settings` | **Admin — Generation settings** | Default branding / report defaults. |

### 1.2 Layouts and global UI

| Item | Where | Notes |
|------|--------|------|
| **AppLayout** | All org routes (/, /projects, …) | Sidebar: "BRS" text (no logo); nav (Dashboard, Projects, Clients, Audit, Settings); Platform Admin link; top bar: org name, user, role badge, theme toggle. **Primary colour** used for nav active state, buttons. **No org branding** (logo/name) in sidebar or header today. |
| **AdminLayout** | All /platform-admin routes | Sidebar: "Platform Admin"; nav (Overview, Organizations, Users, Plans, Payments, Revenue, Generation settings). Uses same primary palette. |
| **ThemeToggle** | AppLayout, AdminLayout, Login | Light/dark. |
| **Shared components** | Card, MetricCard, EmptyState, Skeleton, Button | Used on Dashboard, Projects, etc. Need to respect design tokens. |

### 1.3 Report (ProjectReport) — full section list

**Web report (`#brs-report`):**

1. **Header block** — Logo (if branding.logoUrl); org name (primary colour); letterhead; project name; report title + generated date + currency; Prepared/Reviewed/Approved.
2. **Quick links** (print hidden) — BRS Summary, Missing Cheques Report, Discrepancy Report, Supporting Documents.
3. **Summary cards** — Matched, Unmatched receipts, Unmatched credits, Unmatched payments (green/amber).
4. **Brought forward** — Unpresented cheques from previous period (if roll-forward).
5. **Missing Cheques Report** — Ageing bands (0–30, 31–60, 61–90, 90+); table with Date, Chq No, Name, Amount, Days Outstanding, Ageing Band.
6. **Discrepancy Report** — By amount/date band; table of matched pairs with variance.
7. **Matched transactions** — Table: Cash book date/description, Bank date/description, Amount.
8. **Exceptions (4 grids)** — Uncredited lodgments; Unmatched credits in bank; Unpresented cheques / Missing cheques; Unmatched debits in bank.
9. **Supporting documents** — Table: Filename, Type, Uploaded, Actions.
10. **Footer** — branding.footer text.

**No formal BRS statement block** (e.g. "Closing balance per bank statement" → "Add: Uncredited lodgments" → "Less: Unpresented cheques" → "Balance per cash book") — this is the main layout gap.

### 1.4 Exports (API)

| Export | File | What it contains | Branding used |
|--------|------|-------------------|---------------|
| **PDF** | `api/src/routes/report.ts` (format === 'pdf') | Org name (primary colour); letterhead; report title; project name; date + currency; Matched (list); Unmatched receipts (list); Unmatched payments (list); footer. **No** formal BRS layout; **no** tables with borders; **no** secondary colour; **no** bank/closing balance block. |
| **Excel** | Same file (format === 'excel') | Multiple sheets: header (org + report title); Matched; Unmatched Receipts/Credits; Missing Cheques / Payments; Missing Cheques Ageing; Discrepancies. **No** org logo in Excel; **no** secondary colour. |

### 1.5 Branding (data + usage)

**Stored in DB (Organization.branding JSON):**

- `logoUrl` — used: ProjectReport (web), PDF (not in Excel).
- `primaryColor` — used: ProjectReport web (org name), PDF (org name). **Not** used: AppLayout sidebar/header (hardcoded Tailwind primary).
- `secondaryColor` — stored in Settings, **not used** anywhere in report or app today.
- `letterheadAddress` — ProjectReport web, PDF.
- `reportTitle` — ProjectReport web, PDF, Excel header.
- `footer` — ProjectReport web, PDF.
- `approvalThresholdAmount` — used in approval logic; not a visual asset.

**Tailwind / CSS:** `tailwind.config.js` and `index.css` define a **fixed** primary palette (green). Org `primaryColor` does **not** override the app shell (sidebar, buttons) — only the report header and PDF org name.

### 1.6 Formatting (Ghana / locale)

| Item | Where defined | Where used | Gap |
|------|----------------|------------|-----|
| **Currency** | `web/src/lib/currency.ts`: GHS → GH₵, USD, EUR; `en-GB` number format | Report, Reconcile, Review, exports | Consistent. Optional: thousand separators in more places. |
| **Dates** | Inline `toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })` or `toLocaleString('en-GB')` in many pages | Dashboard, Projects, Audit, Report, Reconcile, Review, Settings, Admin pages | No single `formatDate()`; some pages use only `toLocaleDateString()` without locale. Standardise to one helper and DD/MM/YYYY where appropriate. |

### 1.7 Print

- `index.css`: `@media print` — hide everything except `#brs-report`. Report content is visible.
- No print-specific styles for margins, page breaks, or "Balance per cash book" prominence.

### 1.8 Email

- `api/src/services/email.ts`: Password reset email. Uses `APP_NAME` (env). **No** org branding in emails (no logo, no primary colour). Optional: white-label from org for "sent by [Org Name]".

### 1.9 Platform admin — generation settings

- **AdminGenerationSettings** — Default branding / report defaults for new orgs. Affects downstream when new orgs are created; not the live report layout.

---

## Part 2 — Ghana-acceptable BRS layout (reference)

Standard statement flow (as per Q-SOFT SOLUTIONS example and local practice):

1. **Company name** (and optional logo).
2. **Title:** "BANK RECONCILIATION STATEMENT AS AT [DD-MMM-YYYY]".
3. **Bank:** e.g. "ECOBANK TESANO ACCOUNT NO: XXXXXXXXX".
4. **Currency:** e.g. "GHC" or "GHS".
5. **Closing balance per bank statement:** single prominent amount.
6. **Add: Uncredited lodgments** — table (Date, Name/Details, Amt Received) + **total**.
7. **Less: Unpresented cheques** — table (Date, Name/Details, Chq No, Amt Paid) + **total**.
8. **Balance per cash book at end of period:** single prominent amount (= bank closing + lodgments − cheques).
9. Sign-off (Prepared by, Reviewed by, Approved by) and optional narrative/comments.
10. Footer.

Terminology to use consistently: **Uncredited lodgments**, **Unpresented cheques**, **Balance per cash book**, **As at [date]**.

---

## Part 3 — Design system (tokens)

Current:

- **Tailwind:** `primary` 50–900 (green). No CSS variables for primary in app shell from org branding.
- **index.css:** `@theme` with `--color-primary-*`, `--color-surface`, `--color-border`, `--radius-*`, `--shadow-card*`. Not consistently used everywhere; many components use Tailwind classes directly.

Required:

- **Primary** — From org branding when available; fallback to default green. Apply to: sidebar active, primary buttons, report org name, PDF org name, key totals.
- **Secondary** — From org branding. Use for: secondary buttons, highlights, accents in report (e.g. section headers or totals).
- **Neutrals** — Surface, border, text (incl. dark mode). Standardise card background, table header, table border.
- **Typography** — Font family (headings vs body); sizes (report title > section > table header > body). Optional: load a premium font (e.g. Inter or similar).
- **Spacing** — Consistent padding for cards, tables, sections (e.g. p-4, p-6).
- **Radius & shadow** — Use `--radius-*`, `--shadow-card*` for all cards and report blocks.

---

## Part 4 — Implementation checklist (nothing left out)

### Phase A — Design system and tokens

- [x] **A1** Define design tokens: primary (from org + fallback), secondary, success/warning/error, surface, border, text. Document in `docs/DESIGN_TOKENS.md`.
- [ ] **A2** Add CSS variables (or Tailwind theme) so primary/secondary can be injected from org branding where needed (e.g. report, PDF). Decide scope: report-only vs full app shell.
- [ ] **A3** Use tokens in: `index.css`, `tailwind.config.js`, and shared components (Card, MetricCard, Button).
- [x] **A4** Typography: choose and apply font stack; define heading/body sizes for app and report.
- [x] **A5** Standardise `formatDate(date, options?)` and `formatAmount(amount, currency)` in one place (e.g. `web/src/lib/format.ts`); use everywhere (all 28 pages + exports). Ghana default: DD/MM/YYYY, en-GB numbers.

### Phase B — White-label and report layout (BRS)

- [x] **B1** **Report — formal BRS block (web):** Add the statement block to ProjectReport (above or beside summary cards): Bank closing balance → Uncredited lodgments (table + total) → Unpresented cheques (table + total) → Balance per cash book. Use project reconciliation date and bank account label. Terminology: per Part 2.
- [x] **B2** **Report — terminology:** Use "Uncredited lodgments", "Unpresented cheques", "Balance per cash book", "As at [date]" everywhere in report (web + PDF + Excel).
- [x] **B3** **Report — bank/period:** Prominent "BANK RECONCILIATION STATEMENT AS AT [date]" and "Bank / Account" (from project or bank account name).
- [x] **B4** **Report — colours:** Apply primary to org name and key totals; secondary to section headers or accents. Use muted background for tables.
- [x] **B5** **PDF export:** Restructure to same BRS layout (statement block + tables with borders/headers). Use primary/secondary; proper tables (not just text lines). Include footer.
- [x] **B6** **Excel export:** Same section order and terminology; header row with org name + report title; optional footer line. Format numbers/dates consistently.
- [x] **B7** **Print CSS:** Margins, page break after report if needed; ensure statement block and totals are prominent when printing.

### Phase C — Dashboards and app shell

- [x] **C1** **AppLayout:** Optionally show org logo and org name in sidebar/header (from branding). If not multi-tenant logo in nav, at least ensure "BRS" or product name is consistent; primary colour for active state from design tokens.
- [x] **C2** **Dashboard:** Apply design tokens to metric cards, "Manage app & settings" cards, Recent Projects list. Consistent spacing and shadows.
- [x] **C3** **Projects list:** Same tokens; status chips and client filter chip; table/card style consistent with Dashboard.
- [x] **C4** **ProjectNew:** Form layout and buttons from design system.
- [x] **C5** **ProjectDetail (Upload, Map, Reconcile, Review):** Buttons, tabs, tables use tokens. Reconcile/Review: formatAmount/formatDate from central helper.
- [x] **C6** **Clients, Audit, Settings (all tabs):** Cards, tables, inputs from design system; dates/amounts formatted.
- [x] **C7** **Login, Register, Forgot, Reset:** Same token-based styling; optional logo from platform or org.
- [x] **C8** **Platform Admin (all 8 pages):** Apply same tokens for consistency; dates/amounts formatted.

### Phase D — Report polish (interpretations, comments)

- [x] **D1** **Narrative block:** Optional "Executive summary" or "This reconciliation shows…" (e.g. 2–3 lines) on report (web + PDF). Data-driven (e.g. "X matched, Y unpresented cheques totalling GH₵ Z").
- [x] **D2** **Comments:** Optional preparer/reviewer notes (DB field + UI in Report or Review step) displayed on report and PDF.
- [x] **D3** **Supporting documents section:** Already present; ensure styling matches (table with token borders/header).

### Phase E — Cross-cutting and quality

- [x] **E1** **Secondary colour:** Actually use `secondaryColor` from branding in report (and optionally in app) — e.g. section headers, secondary buttons.
- [x] **E2** **Loading and empty states:** Skeleton and EmptyState components use tokens; consistent across all list/dashboard pages.
- [x] **E3** **Accessibility:** Contrast (WCAG); focus states for buttons/links; aria-labels where needed.
- [x] **E4** **Email:** Optional white-label: "Sent by [Org Name]" or logo in password-reset email (if Resend supports).
- [x] **E5** **Admin — Generation settings:** Default report title, default primary/secondary for new orgs; document that these feed into new org branding.
- [x] **E6** **Mobile:** Sidebar already responsive; ensure report and tables scroll/read well on small screens; print still works.

### Phase F — Documentation and handover

- [x] **F1** Document design tokens and where they are used (`DESIGN_TOKENS.md`).
- [x] **F2** Document Ghana BRS layout and terminology (`GHANA_BRS_LAYOUT.md`).
- [x] **F3** Update STATUS.md / README with "Premium report & dashboard" and reference this plan.

---

## Part 5 — File-level checklist (where to change what)

| Area | Files to touch |
|------|-----------------|
| Design tokens | `web/src/index.css`, `web/tailwind.config.js`, new `web/src/lib/theme.ts` or similar if injecting org colours |
| Format helpers | New `web/src/lib/format.ts`; then all pages using dates/amounts |
| Report (web) | `web/src/pages/ProjectReport.tsx` — add BRS block; apply primary/secondary; terminology |
| PDF | `api/src/routes/report.ts` — PDF section: layout, tables, primary/secondary, terminology |
| Excel | `api/src/routes/report.ts` — Excel section: header/footer, terminology, sheet order |
| Print | `web/src/index.css` — print margins; optional `web/src/pages/ProjectReport.tsx` print class |
| AppLayout | `web/src/components/AppLayout.tsx` — optional logo/org name; tokens |
| Dashboard | `web/src/pages/Dashboard.tsx` |
| Projects | `web/src/pages/Projects.tsx` |
| ProjectNew | `web/src/pages/ProjectNew.tsx` |
| ProjectDetail | `web/src/pages/ProjectDetail.tsx` |
| ProjectMap | `web/src/pages/ProjectMap.tsx` |
| ProjectReconcile | `web/src/pages/ProjectReconcile.tsx` |
| ProjectReview | `web/src/pages/ProjectReview.tsx` |
| Clients | `web/src/pages/Clients.tsx` |
| Audit | `web/src/pages/Audit.tsx` |
| Settings | `web/src/pages/Settings.tsx` (all tabs) |
| Login / Register / Forgot / Reset | `web/src/pages/Login.tsx`, etc. |
| Admin layout | `web/src/components/AdminLayout.tsx` |
| Admin pages | `web/src/pages/admin/*.tsx` (Overview, Organizations, OrgDetail, Users, UserDetail, Plans, Payments, Revenue, GenerationSettings) |
| Shared UI | `web/src/components/ui/Card.tsx`, `MetricCard.tsx`, `Button.tsx`, `EmptyState.tsx`, `Skeleton.tsx` |
| Branding API | `api/src/routes/settings.ts` — already has secondaryColor; ensure it’s returned and used |
| Email | `api/src/services/email.ts` — optional org branding in body |

---

## Part 6 — Order of implementation (recommended)

1. **A1–A5** — Design system and format helpers (foundation).
2. **B1–B4** — Report web: BRS block, terminology, bank/period, colours.
3. **B5–B7** — PDF and Excel to same standard; print CSS.
4. **C1–C8** — Dashboards and all app pages with tokens and formatting.
5. **D1–D3** — Narrative and comments.
6. **E1–E6** — Secondary colour, a11y, email, admin, mobile.
7. **F1–F3** — Docs.

This plan is the single source of truth so that **nothing is left out** when implementing premium, Ghana-acceptable, white-label layout across the product.
