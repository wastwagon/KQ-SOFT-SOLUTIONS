# Navigation & UI chrome — handoff

Summary for design/QA after the platform admin + workspace navigation pass (ListToolbar, ActionMenu, hubs, reconcile Phase 5 prototype).

## What shipped

| Area | Routes / entry | Notes |
|------|----------------|--------|
| **UI rules** | `docs/UI_CHROME_GUIDE.md` | When to use Button, Tabs, Badge, ActionMenu, ListToolbar |
| **Workspace tools** | `/tools`, sidebar **Tools**, mobile **More → Tools** | Single hub; deep links unchanged |
| **Platform ops** | `/platform-admin/ops` | Overview + jump links to metrics, retention, etc. |
| **Platform tools** | `/platform-admin/tools` | Admin cleaners; sidebar one **Tools** link |
| **Admin lists** | Orgs, users, payments, leads, retention, ops metrics | `ListToolbar` + soft badges in tables |
| **Reconcile** | Sticky bar **Preparer check** + Match by counting | Mobile list/export/bulk; Confirm match offset — product gate below |

Build: `cd web && npm run build` (verified).

Deploy: API + web per `docs/DEPLOY_COOLIFY.md`; run `cd api && npx prisma migrate deploy` if migrations are pending.

## Scorecard

Canvas **navigation-pills-premium-scorecard**: **11 Strong · 0 Partial · 0 Missing** (engineering complete).

Broader 2026 polish backlog: **`docs/PLATFORM_UI_POLISH_PHASES.md`** (Canvas **platform-ui-ux-2026-gaps**).

**Product gate (unchanged):** run **Preparer check** on a real project before hiding count-match badges or primary reconcile CTAs.

**Closed**

- **Landing marketing pills** — boundary in `Landing.tsx` + `UI_CHROME_GUIDE.md`.

## Required before UI collapse (not before deploy)

Run **Preparer check** from the reconcile **sticky bar** (covers suggested matches + count-match) on phone and desktop. **Record pass** per project in this browser. Do not collapse badges or primary CTAs until pass (or fix **Record fail** notes first).

## Quick QA smoke (15 min)

1. **Workspace** — Projects status **Tabs**; Clients/Projects search via toolbar; **More** tab opens modal (Reports, Tools, Help, Platform admin if applicable).
2. **Platform admin** — **Ops hub** and **Tools hub** from sidebar; org/user detail: subtitle badges + primary CTA + **Actions** menu.
3. **Reconcile** — Narrow viewport: **Choose count-match list** modal; **Export** overflow; suggested matches **More bulk** below `md`; **Confirm match** bar clears bottom tabs (see `workspaceMobileLayout.ts`); sticky toolbar readable.
4. **Keyboard** — Tabs arrow keys; ActionMenu / AccountMenu Escape + arrows; ListToolbar filter drawer on small screens.

## Optional polish (not blocking deploy)

- Default `Badge` without `shape="soft"` in a few non-table spots (e.g. Settings current plan, ProjectStatusPill) — intentional emphasis where noted in `UI_CHROME_GUIDE.md`.
