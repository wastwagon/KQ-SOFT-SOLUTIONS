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
1. update UI + Excel + PDF together
2. do not add new columns unless explicitly approved
3. update this schema in the same change
4. validate against client screenshot/template expectations before release

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
