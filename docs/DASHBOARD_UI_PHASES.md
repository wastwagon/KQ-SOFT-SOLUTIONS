# Dashboard & UI push — safe phases

Incremental enhancements to make the dashboard and app feel more premium and SaaS-ready. Each phase is additive and safe to ship on its own.

---

## Phase 1 — Dashboard metrics & visual polish

**Goal:** Richer at-a-glance metrics and consistent token usage on the Dashboard.

**Scope:**
- Add metric cards: **In progress** (reconciliation not yet completed) and **Completed** (reconciled & approved).
- Ensure all Dashboard buttons and cards use design tokens (border-border, shadow-card, primary).
- Optional: capitalize Plan display (e.g. "Premium" not "premium").

**Risk:** Low. Additive UI only; no API or schema changes.

**Deliverables:**
- [x] Two new metric cards: "In progress" (count), "Completed" (count).
- [x] Dashboard "View all" / "New Project" buttons use border-border and primary consistently.
- [x] Plan value displayed with capital first letter.

---

## Phase 2 — Empty states & first-time hint

**Goal:** Clear guidance when there’s no data; optional welcome for new orgs.

**Scope:**
- Refine Dashboard empty state copy (e.g. "Create your first project to start reconciling").
- Optional: dismissible "Get started" tip when projects list is empty (stored in localStorage).

**Risk:** Low. Copy and optional local state only.

**Deliverables:**
- [x] Empty state copy updated.
- [x] Get started banner (dismissible, localStorage); only when no projects; scroll link to #recent-projects.

---

## Phase 3 — Recent activity for everyone

**Goal:** Show recent activity or recent projects summary even when audit trail isn’t available.

**Scope:**
- If user has audit_trail: keep "Recent activity" in Manage card.
- If not: show "Recent projects" summary (last 5 with status + date) in a small block on Dashboard for all users (not only in the Recent Projects card).

**Risk:** Low. Reuse existing projects query; no new API.

**Deliverables:**
- [x] Recent Projects card is the single "recent" surface for all users; no duplicate block (audit "Recent activity" stays in Manage card for admins).

---

## Phase 4 — Settings entry points & nav

**Goal:** All users can reach relevant settings; admin section is clear.

**Scope:**
- Non-admin users: ensure Branding, Billing, Members (and Audit if plan allows) are reachable from Dashboard or nav.
- Dashboard "Manage app & settings" visible only to admins is already correct; optionally add a single "Settings" card for non-admins that links to the main settings they can access.

**Risk:** Low. Link visibility and routing only.

**Deliverables:**
- [x] Non-admin dashboard: "Settings" card with Branding, Billing, Members (+ Bank rules / Audit when plan allows).
- [x] No change to Platform Admin; only app Dashboard.

---

## Phase 5 — Typography & spacing pass

**Goal:** Consistent heading hierarchy and spacing across Dashboard and main app pages.

**Scope:**
- Apply DESIGN_TOKENS typography (section heading text-base/text-lg font-medium; body text-sm).
- Consistent section gaps (mb-6, space-y-6) and card padding.

**Risk:** Low. CSS/tailwind only.

**Deliverables:**
- [x] Dashboard: h1 text-2xl; section/card titles text-base font-semibold (Card); body text-sm; consistent spacing via space-y-6.
- [ ] Optional: same pass on Projects, Settings landing.

---

## Status

| Phase | Description              | Status   |
|-------|--------------------------|----------|
| 1     | Metrics & polish         | Done     |
| 2     | Empty states & hint      | Done     |
| 3     | Recent activity for all | Done     |
| 4     | Settings entry (non-admin) | Done   |
| 5     | Typography & spacing    | Done     |

---

After each phase: run `npm run build` (web), test Dashboard and one flow (e.g. create project), then proceed.
