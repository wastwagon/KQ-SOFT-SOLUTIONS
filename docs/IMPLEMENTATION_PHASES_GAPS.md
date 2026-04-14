# Implementation Phases — Gaps & Consistency Follow-up

Safe, phased implementation of items from `HONEST_REVIEW_GAPS_AND_CONSISTENCY.md`.

---

## Phase 1 — New Project form (high impact)

- **1a** Add optional **Reconciliation date** (date input) to ProjectNew; send `reconciliationDate` (ISO) when set.
- **1b** Add optional **Roll forward from** dropdown (list completed projects); send `rollForwardFromProjectId` when selected.

**Outcome:** New Project form aligned with API/DB; users can set date and create from a completed project without going via Report.

---

## Phase 2 — Deep links for project steps (medium)

- Support hash-based step: e.g. `/projects/:id#reconcile`, `#report`, `#map`, `#review`.
- On load, read `location.hash`, map to step index, set initial step so Reconcile/Report are shareable.

**Outcome:** Shareable links to Reconcile or Report step.

---

## Phase 3 — Roles (medium) ✅ Done

- **Implemented:** Role badge in top bar; API enforces permissions per role (canDeleteProject, canReconcile, canEditBankRules, canManageMembers, etc.).
- **Behaviour:** Admin: full access. Reviewer: approve, reopen, export. Preparer: upload, map, reconcile; cannot delete, reopen, manage bank rules. Viewer: read-only.
- Settings > Members: org admins can add, remove, and change member roles (role dropdown per member).

**Outcome:** Roles visible and enforced in API and UI.

---

## Phase 4 — UX polish (low) ✅ Done

- **4a** On Projects page, when `?clientId=` is in URL, show a **“Filtering by: Client Name”** chip with clear button.
- **4b** Apply dark mode consistently inside ProjectReconcile, ProjectReview, ProjectReport (tables, buttons, inputs).

**Outcome:** Clearer filter state; full dark mode parity.

---

## Order

1. Phase 1 → 2 → 3 → 4 (implement in this order).
2. Each phase is self-contained; can pause after any phase.
