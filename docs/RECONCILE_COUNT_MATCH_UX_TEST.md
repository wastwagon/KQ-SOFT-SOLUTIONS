# Match by counting — preparer UX check

Use this **5-minute script** on a real project (phone + desktop) before collapsing count-match UI further. **In app:** Reconcile sticky bar or **Match by counting** → **Preparer check** (same checklist; sign-off stored per project in this browser). Rules: `docs/UI_CHROME_GUIDE.md` · handoff: `docs/NAVIGATION_UI_HANDOFF.md`.

## Desktop (lg+)

- [ ] Summary badges (Only CB, Only bank, Open, Batch cancel) show counts and match your mental model.
- [ ] Cancel → Open → Only pill rows are findable; active list is obvious.
- [ ] Excel/PDF export works from header buttons.

## Phone / narrow (&lt; lg)

- [ ] Summary badges **still visible** (not hidden in a menu).
- [ ] **Choose count-match list** opens; picking Cancel/Open/Only lists is clear.
- [ ] **Export** menu downloads Excel or PDF.
- [ ] After selecting lines, **Confirm match** bar is reachable (not covered by bottom nav).

## Suggested matches (md breakpoint)

- [ ] **Auto-match all** remains visible (not buried).
- [ ] **More bulk** is acceptable for 90%+ / pattern matches.

## Pass / fail

| Result | Action |
|--------|--------|
| **Pass** | Note any copy tweaks; optional: tighten `lg` breakpoint. |
| **Fail** | File issues with screen size + list name; do **not** remove badge counts or primary CTAs. |

Tester: _______________ · Date: _______________ · Project: _______________
