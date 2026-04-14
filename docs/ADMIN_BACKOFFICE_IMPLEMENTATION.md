# Admin Backoffice — Phased Implementation Plan

Full admin controls: user management, subscription tier management, revenue analytics.

**Status: Implemented** (Phases 1–6)

---

## Phase 1 — Platform Admin Auth + Foundation

**Scope:** Superadmin concept, protected admin routes, admin layout.

- Add `isPlatformAdmin` boolean to User model (or env-based superadmin emails).
- Auth middleware: add `requirePlatformAdmin` for admin routes.
- API routes: `/api/v1/admin/*` prefix, all require platform admin.
- Web: admin layout, sidebar (Users, Orgs, Plans, Revenue), route `/admin/*`.
- Seed or env: `PLATFORM_ADMIN_EMAILS=admin@qsoft.com` for superadmin.

**Outcome:** Platform admin can access `/admin` area; non-admin users get 403.

---

## Phase 2 — Plan Management (Tier Management)

**Scope:** Plans in DB, CRUD API, admin UI.

- Add `Plan` model: id, name, slug, projectsPerMonth, transactionsPerMonth, monthlyGhs, yearlyGhs, active, createdAt, updatedAt.
- Migration: create plans table; seed basic, standard, premium, firm from current config.
- Update Organization: foreign key `planId` or keep `plan` string and resolve from Plan table.
- API: `GET/POST /admin/plans`, `GET/PUT/DELETE /admin/plans/:id`.
- Update `subscription.ts` and `usage.ts` to read limits/prices from Plan table.
- Admin UI: Plans list, create/edit plan form.

**Outcome:** Admin can create and edit subscription tiers; app uses DB plans.

---

## Phase 3 — User Management

**Scope:** List, view, edit, suspend users; view org memberships.

- API: `GET /admin/users` (paginated, search), `GET /admin/users/:id`, `PATCH /admin/users/:id` (name, suspended).
- Add `suspendedAt` to User (optional) for soft-disable.
- Admin UI: Users list (table, search, pagination), user detail (memberships, last activity).

**Outcome:** Admin can view and manage users; suspend if needed.

---

## Phase 4 — Org Management

**Scope:** List orgs, view org, override plan, view members and usage.

- API: `GET /admin/organizations` (paginated), `GET /admin/organizations/:id`, `PATCH /admin/organizations/:id` (plan override).
- Admin UI: Orgs list (plan, usage, member count), org detail (members, usage, projects count), plan override.

**Outcome:** Admin can view orgs and override plan without Paystack.

---

## Phase 5 — Payment & Revenue Storage

**Scope:** Persist Paystack payments; revenue data.

- Add `Payment` model: id, organizationId, amount, currency, plan, period, reference, status, paystackData (json), createdAt.
- Update Paystack webhook: on charge.success, insert Payment and update org plan.
- API: `GET /admin/payments` (list, paginated, filter by org).
- Admin UI: **Payments** page at `/platform-admin/payments` (paginated table, org filter).

**Outcome:** Every payment is stored; admin can view payments list and revenue analytics.

---

## Phase 6 — Revenue Analytics Dashboard

**Scope:** MRR, revenue by plan, churn, revenue dashboard.

- API: `GET /admin/analytics/revenue` (MRR, ARR, by plan, by period).
- Compute: MRR from active paid orgs × plan price; churn from downgrades/cancels.
- Admin UI: Revenue dashboard (cards, charts, table of revenue by plan/period).

**Outcome:** Admin sees revenue metrics and trends.

---

## Order

1. Phase 1 → 2 → 3 → 4 → 5 → 6.
2. Each phase is self-contained; can pause after any phase.
3. Phase 2 depends on Phase 1 (admin routes). Phase 5 depends on Phase 4 (org context). Phase 6 depends on Phase 5 (Payment data).
