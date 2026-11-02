# Platform UI polish — large phases (2026)

**Status: lift complete** for planned large phases (Nov 2026). `npm run build` green.

## Completed tracks

| Track | Deliverable |
|-------|-------------|
| Nav chrome 1–5 | ListToolbar, ActionMenu, hubs, reconcile mobile, preparer check |
| P0 loading | In-layout `RouteFallback`; public `PublicRouteSuspense` |
| P0 shell & honesty | Grouped nav, ⌘K, Reports list, KPI labels |
| P0 reconcile workbench | Tables first; assistants in `<details>`; sticky jumps |
| P1 layout banner | `workspaceLayoutBanner.ts` single slot |
| P1 load errors | `PageLoadError` — workspace, admin, project workflow, settings, manual, **header widgets** (notifications, org switcher), settings sections (API keys, members, bank rules), upload step, count-match diagnostic |
| P1 table density | `Table compact` — lists above plus AdminRetention, AdminOpsMetrics, AdminOrgDetail payments, PlansDraggableTable, CountMatchPanel diagnostic table |
| P1 dashboard | Flat KPI cards; Reports card copy |
| P2 cmd-k / skip link | Command palette; skip link in `SidebarShell` |
| Currency 1–5 | Platform defaults, FX service, manual rates, **report display currency** on `ProjectReport` |
| Paywall UX | `SubscriptionRenewalPanel` defers when layout strip visible |

## Optional later (not blocking deploy)

- Mechanical pass: raw `<button>` → `Button` on low-traffic / marketing pages (ActionMenu and reconcile mobile intentionally keep native buttons where needed).
- Preparer **Record pass** on a real reconcile project before hiding count-match UX badges (product gate; see `RECONCILE_COUNT_MATCH_UX_TEST.md`).

## References

- Canvas: `platform-ui-ux-2026-gaps`, `navigation-pills-premium-scorecard`
- `docs/UI_CHROME_GUIDE.md` · `docs/NAVIGATION_UI_HANDOFF.md`
- `docs/CURRENCY_FX_ADMIN_GAPS_PHASES.md`

Deploy: `cd web && npm run build` · API + web per `docs/DEPLOY_COOLIFY.md`.
