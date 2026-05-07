# Report Layout Schema (Locked)

This document defines the **approved compact layout** for BRS report sections.

Purpose:
- keep UI and export formats consistent
- prevent column creep after future updates
- ensure a clean, client-facing presentation

---

## Scope

Applies to:
- On-screen report (`ProjectReport`)
- Excel export (`/api/v1/report/:projectId/export?format=excel`)
- PDF export structure where section tables are rendered

---

## 0) Primary BRS workbook (two-column schedule)

Applies to: **first block** on `ProjectReport`, Excel sheet **`BANK RECONCILIATION`**, PDF **Bank Reconciliation Statement** summary table.

**Column rules**

1. Left: Description (main lines + optional indented **composition** sub-lines when roll-forward splits apply).
2. Right: `Amount ({currency})` — **positive magnitudes** for Add / Less / Deduct lines (worksheet style).

**Main lines (fixed order)**

1. Closing balance per bank statement — **bold** amount.
2. Add: Uncredited lodgments / uncleared deposits — **timing** total (current-period unmatched receipts + brought-forward receipt lodgments, when roll-forward).
3. Less: Unpresented cheques — **magnitude** (current unpresented after blank-detail rule + brought-forward cheques).
4. Add: Bank-only debits not in cash book.
5. Deduct: Bank-only credits not in cash book.
6. Cash book balance at end of period — **bold** amount.

**Optional composition sub-lines** (shown only when the corresponding brought-forward slice is material):

- Under (2): current-period timing uncredited; brought-forward timing uncredited (prior period).
- Under (3): current-period unpresented; brought-forward unpresented (prior period).
- Under (5): current-period bank-only credits; brought-forward bank-only credits (prior period).

**Formula (must match `deriveCashBookFromWorkbookSchedule` in API)**

`cashBook = bankClosing + timingUncredited − unpresentedMagnitude + bankOnlyDebits − bankOnlyCredits`

**Tie-out**

- API/UI expose `workbookScheduleDerivedCashBook` and `workbookScheduleTieOutVariance` (`declaredCashBook − derived`). Non-zero beyond tolerance → data review.

**Header**

- Bank line uses **`{BankName} Account Number {digits}`** when `bankName`/`accountNo` exist (not legacy `ACCOUNT NO:` all-caps).

---

## 1) Matched Transactions (Compact)

Allowed columns:
1. `Cash Book` (date + description)
2. `Cash Book Amount`
3. `Bank` (date + description)
4. `Bank Amount`
5. `Variance`

Not allowed in compact layout:
- separate cheque columns
- separate reference columns
- split amount received/paid columns in this section

---

## 2) Reconciliation Discrepancy Report (Compact)

Allowed columns:
1. `Cash Book` (date + short description)
2. `Cash Book Amount`
3. `Bank` (date + short description)
4. `Bank Amount`
5. `Variance`
6. `Date Diff`

Not allowed in compact layout:
- duplicate reference columns
- duplicate cheque columns
- split received/paid columns

---

## 3) Uncredited Lodgments (Compact)

Allowed columns:
1. `Date`
2. `Details`
3. `Amount`

Totals:
- `Subtotal (unmatched receipts)`
- `TOTAL UNCREDITED LODGMENTS (FOR BRS ADD LINE)`

---

## 4) Unpresented Cheques (Compact)

Allowed columns:
1. `Date`
2. `Details`
3. `Amount`

Totals:
- `Subtotal (unmatched payments)`
- `Subtotal (brought forward)` (when applicable)
- `Total Unpresented Cheques (for BRS Less line)`

---

## 5) Header and Metadata Requirements

Required:
- BRS title with reconciliation date
- bank account reference line (`BANK NAME  ACCOUNT NO: ...`) when available
- report completion timestamp
- print timestamp

---

## 6) Change Control Rules

When modifying report layout:
1. update UI + Excel + PDF together (and JSON `brsStatement` if amounts or composition change)
2. do not add new columns unless explicitly approved
3. update this schema in the same change
4. validate against client screenshot/template expectations before release
5. keep **supporting** section totals for uncredited / unpresented **magnitude-aligned** with the primary workbook block (same numbers; signed display only where it aids drill-down tables)

---

## 7) Review Checklist

Before release, verify:
- no crowded sections in Matched/Discrepancy blocks
- all key calculations unchanged
- totals and variances still reconcile correctly
- timestamp and bank account details are visible
- exported files match on-screen compact structure

---

Schema status: **Active**
