# Implementation Phases — Gaps & Consistency Follow-up

Safe, phased implementation of items from `HONEST_REVIEW_GAPS_AND_CONSISTENCY.md`.

---

## Phase 1 — New Project form (high impact) ✅ Done

- **1a** Optional **Reconciliation date** on ProjectNew → `reconciliationDate` (ISO).
- **1b** Optional **Roll forward from** (completed projects) → `rollForwardFromProjectId`.

**Outcome:** New Project form aligned with API/DB; users can set date and roll forward without going via Report only.

---

## Phase 2 — Deep links for project steps (medium) ✅ Done

- Hash steps: `/projects/:id#upload`, `#map`, `#reconcile`, `#review`, `#report` (ProjectDetail + hashchange).

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
- **4b** Consistent light-theme surfaces inside ProjectReconcile, ProjectReview, ProjectReport (shared border/surface tokens).

**Outcome:** Clearer filter state; consistent project-step chrome (single premium light theme).

---

## Order

1. Phase 1 → 2 → 3 → 4 (implement in this order).
2. Each phase is self-contained; can pause after any phase.
