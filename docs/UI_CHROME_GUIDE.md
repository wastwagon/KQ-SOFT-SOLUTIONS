# UI chrome — pills, buttons, tabs & menus

Short rules for KQ Soft workspace and platform admin. Handoff & QA: `docs/NAVIGATION_UI_HANDOFF.md`. Pricing-specific audit: `docs/PRICING_CMS_AUDIT.md`. Navigation scorecard: Cursor Canvas **navigation-pills-premium-scorecard** (see handoff).

## When to use what

| Intent | Component | Notes |
|--------|-----------|--------|
| **Commit an action** | `Button` primary / outline / ghost | Rectangular (`rounded-xl`). One primary per header or card footer. |
| **Navigate peer sections** | `Tabs` | Settings, reconcile modes. Do not bury Billing or Members in overflow only. |
| **Read-only status** | `Badge` | Default `shape="pill"` for emphasis; `shape="soft"` in dense tables. |
| **Secondary / destructive cluster** | `ActionMenu` | Suspend, export variants, row actions. Keep one visible primary CTA outside the menu. |
| **Account & global nav** | Sidebar + `AccountMenu` + ⌘K | Do not add top-level nav items when palette can cover it. |
| **Platform admin detail** | `PageHeader` subtitle | Plan/status badges under title; one primary CTA (`Enter workspace`, `Restore user`) + `ActionMenu` for suspend/destructive. |
| **List filters** | `ListToolbar` | Search always visible; extra filters in drawer below `md`. Hubs: `/platform-admin/ops`, `/tools`, `/platform-admin/tools`. |

## Do not

- Use `Badge` as a click target (use `Button` or `Pill`-style tabs).
- Put filters and three CTAs in `PageHeader.actions` without a filter row or drawer on mobile — use `ListToolbar` under the header.
- Use `rounded-full` pill rows for status filters — use `Tabs` (see Projects) or rectangular buttons.
- Copy landing-page `rounded-full` marketing ribbons into app chrome.
- Merge **Audit log**, **Billing**, **Plans**, or **Pricing layout** into a single drawer without a visible entry point.
- Collapse **Match by counting** summary badges or primary reconcile CTAs without preparer user testing.

## Reconcile — Match by counting (Phase 5)

- Keep **Only / Open / Cancel** summary badges visible at all breakpoints (`CountMatchPanel`).
- Below `lg`, list pickers move to **Choose count-match list** (modal); desktop keeps full pill rows.
- Count-match **Excel/PDF** use **Export** `ActionMenu` below `lg`; full buttons on desktop.
- Suggested matches: keep **Auto-match all** visible; secondary bulk actions in **More bulk** menu below `md`.
- Do not remove badge counts or **Confirm match** until preparers validate the compact layout (`docs/RECONCILE_COUNT_MATCH_UX_TEST.md` or in-app **Preparer check** on Match by counting).

## Accessibility

- Buttons: visible `focus-visible` ring (see `Button.tsx`).
- Menus: `aria-expanded`, `aria-haspopup="menu"`, Escape to close; arrow keys between items (`ActionMenu`).
- Tabs: `role="tablist"` / `aria-selected`; arrow keys move selection (`Tabs.tsx`).
- Status: include text in badges, not color alone.

## Components

- `web/src/components/ui/Button.tsx`
- `web/src/components/ui/Badge.tsx` — `shape`: `pill` | `soft`
- `web/src/components/ui/Tabs.tsx`
- `web/src/components/ui/ActionMenu.tsx`
- `web/src/components/layout/ListToolbar.tsx` — search + filter drawer (`AdminListToolbar` re-exports for compatibility)
- `web/src/components/reconcile/CountMatchListFilters.tsx` — mobile list picker for count-match
- `web/src/components/reconcile/CountMatchUxChecklistModal.tsx` — preparer sign-off (localStorage per project)
- `web/src/components/ui/PageLoadError.tsx` — standard query/load failure (lists, settings, admin, header popovers, upload/reconcile panels)
- `web/src/lib/userFacingTerms.ts` — Ghana-facing role and organisation labels
- `docs/GHANA_PLAIN_LANGUAGE_GUIDE.md` — glossary and copy maintenance
- `web/src/components/ui/Table.tsx` — optional `compact` prop for dense rows
