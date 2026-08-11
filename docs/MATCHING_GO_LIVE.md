# Matching — go-live status

**Status: complete for Ghana BRS matching methodology.** This document is the close-out record so matching work does not need to be reopened unless a new product requirement appears.

**Not the full product ship gate** — use [GO_LIVE_VERIFICATION.md](./GO_LIVE_VERIFICATION.md) for parsers, identity, date order, count-match, and clean-export A+B verification.

Canonical user guide: [MAPPING_AND_MATCHING_MANUAL.md](./MAPPING_AND_MATCHING_MANUAL.md) (keep in-app [`web/public/mapping-and-matching-manual.md`](../web/public/mapping-and-matching-manual.md) aligned).

## Shipped

| Area | Implementation |
|------|----------------|
| Core 1:1 scoring | Amount ± platform tolerance, date ± window (null dates do not get date credit), ref/chq, narration similarity |
| False-positive controls | Ambiguity drop, cheque gate, bank-rule corroboration (no amount-only), SCB unique-amount ≤0.84 |
| Multi-match | 1:many / many:1 subset-sum suggestions; many:many confirm validates equal sums |
| Pattern layers | Ecobank, SCB, GCB, NIB, Prudential, Absa, Bank of Africa |
| Phase B auto-match | ≥0.85 only for bank-pattern suggestions (`bankPattern` / reason tags) |
| Profile UI | Bank-specific tip banner from `reconcileProfile.bankFormat` |
| Count-match diagnostic | Read-only amount-frequency lists (only CB / only bank / open imbalances / batch-cancel schedule). Excel + PDF export; Select lines capped at 50/side. Does **not** clear matches. Lives on Reconcile (not a standalone Tools module). |
| Docs | Mapping & Matching manual, USER_MANUAL, BRS factors (points here) |

## Product limits (not open gaps)

These are intentional and documented — do not treat as unfinished matching work:

1. **No FX conversion in matching** — one currency per project; amounts compared as-is.
2. **No pro-rata / open-item partials** — use 1:many / many:1 when lines sum to a full amount.

Reopen matching work only if a customer project explicitly requires FX convert-on-match or true partial open items.

## Key code

- `api/src/services/matching.ts` — core engine
- `api/src/services/bankRules.ts` — rule corroboration
- `api/src/services/ecobankClearingMatcher.ts` / `scbSweepMatcher.ts` / `ghanaRegionalMatchers.ts` — pattern layers
- `api/src/routes/reconcile.ts` — profile detection, merge, annotate (`bankPattern`)
- `web/src/lib/phasedAutoMatch.ts` — Phase A/B bulk
- `web/src/lib/ghanaBankProfileTips.ts` — reconcile tip copy
- `api/src/services/countMatchDiagnostic.ts` — match-by-counting schedules
- `GET /api/v1/reconcile/:projectId/count-match` — diagnostic API
- `web/src/components/reconcile/CountMatchPanel.tsx` — reconcile UI + Excel export
