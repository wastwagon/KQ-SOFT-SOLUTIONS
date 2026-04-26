# Efficiency System: Phased Implementation (Best Practice)

This plan adds customer efficiency and best practice **in phases**, without deviating from existing behaviour or customer expectations (manual process: obtain source data → input → system auto process → draft reports → review → final report; cash book date mandatory; cheque values must match bank; 5 reports; date/time stamp).

---

## Principles

- **No deviation**: Each phase keeps current flow (Upload → Map → Reconcile → Review → Report) and outputs (full BRS, 5 report sections, draft/final, timestamp).
- **Incremental**: One phase at a time; validate with customer before moving to next.
- **Best practice**: Align with customer’s manual mapping (KQ-SOFT SOLUTIONS process) and common BRS standards (Ghana/global).

---

## Phase 1 — Foundation (current phase)

**Goal:** Clear process, validation hints, and guidance so users complete the flow correctly and quickly.

| Item | Description | Status |
|------|-------------|--------|
| 1.1 Process summary on Upload | Short line: “Cash book date is required. Cheque amounts should match the bank statement for easy matching.” | Done |
| 1.2 Map step: date required hint | On Map, note that date column is required for matching; optional: warn if date not mapped. | Done |
| 1.3 Reconcile: matching hint | One line: “For cheques, match only when amount (and reference) match the bank.” | Done |
| 1.4 Review: draft vs final | Clarify in UI that “Draft” = current report; “Final” = after Submit for review / Approve. | Done |
| 1.5 Report footer | Already have “Generated … · For audit purposes retain supporting documents.” | Done |

**Deliverables:** In-app hints and labels only; no API or flow changes.

---

## Phase 2 — Smarter column mapping

**Goal:** Reduce time at Map step; better first-time mapping.

| Item | Description | Status |
|------|-------------|--------|
| 2.1 Broader header detection | Extend suggested mapping: recognise “Value Date”, “Cr”, “Dr”, “Deposit”, “Withdrawal”, “Amount”, “Receipts”, “Payments”. | Done |
| 2.2 Date format detection | Infer date format from sample row(s); normalise for parsing. | Deferred |
| 2.3 “Apply to all” improvement | Ensure “Apply suggested mapping to all documents” uses same logic for cash book and bank. | Done |

**Deliverables:** Better suggested mappings; same Map UI and API contract.

---

## Phase 3 — Smarter matching at Reconcile

**Goal:** Fewer manual matches; same accuracy and control.

| Item | Description | Status |
|------|-------------|--------|
| 3.1 Cheque rule | Backend/API: when suggesting matches for cheque transactions, prefer/require same amount; use reference (chq no) when present. | Done |
| 3.2 “Accept all high-confidence” | Optional button to apply all suggestions above a confidence threshold (e.g. 95%); user still reviews exceptions. | Done |
| 3.3 Exception reasons | Show short reason for unmatched items (e.g. “No bank debit with same amount” for cheques). | Done |

**Deliverables:** Better suggestions and one-click accept; Reconcile step unchanged in structure.

---

## Phase 4 — Previous period and roll-forward

**Goal:** Support “previous period bank reconciliation report” as input; carry forward items correctly.

| Item | Description | Status |
|------|-------------|--------|
| 4.1 Roll-forward from project | Already have “Create next period (roll forward)”. Document as “Previous period BRS” input. | Done |
| 4.2 Brought-forward display | Already show brought-forward unpresented cheques. Ensure narrative says “from previous period BRS”. | Done |
| 4.3 Optional: upload previous BRS PDF | Future: parse or attach previous BRS for audit trail; no change to core flow. | Optional |

**Deliverables:** No change to flow; clearer labelling and docs.

---

## Phase 5 — Review checklist and report polish

**Goal:** Officer can tick off exceptions; report explicitly “5 reports” and final stamp.

| Item | Description | Status |
|------|-------------|--------|
| 5.1 Exception tick-off | Optional checkbox per exception: “Reviewed” / “Resolved” before Submit for review. | Done |
| 5.2 “Five reports” label | On Report page, list: “1. BRS Statement 2. Summary 3. Missing Cheques 4. Discrepancy 5. Supporting Documents”. | Done |
| 5.3 Final report stamp | On approved report, show “Final report” and approval date (already have generation timestamp). | Done |

**Deliverables:** Clear draft vs final; optional tick-off; no change to report content logic.

---

## Summary

| Phase | Focus | Risk | Customer impact |
|-------|--------|------|------------------|
| 1 | Hints, validation messaging, process clarity | None | Faster, fewer errors |
| 2 | Smarter Map suggestions | Low | Less time at Map |
| 3 | Smarter Reconcile suggestions + one-click accept | Low | Less manual matching |
| 4 | Previous period / roll-forward clarity | None | Meets “previous BRS” expectation |
| 5 | Review tick-off, “5 reports”, final stamp | None | Meets draft/final and audit expectation |

Implementation order: **Phase 1 → 2 → 3 → 4 → 5**. After each phase, validate with customer before proceeding.
