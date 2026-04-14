# Ghana BRS Layout & Terminology

Standard layout and terminology for Bank Reconciliation Statements (BRS) as used in Ghana and implemented in this application.

---

## Statement flow (standard order)

1. **Company name** (and optional logo).
2. **Title:** "BANK RECONCILIATION STATEMENT AS AT [DD-MMM-YYYY]".
3. **Bank:** When a single bank account is selected, the report header (web, PDF, and Excel) shows **"Bank account: [name]"** (e.g. "Ecobank Main", "GCB Operating"). This appears in the BRS statement block and on the first sheet/header of exports.
4. **Currency:** e.g. "GHS" or "GH₵".
5. **Closing balance per bank statement** — single prominent amount.
6. **Add: Uncredited lodgments** — table (Date, Name/Details, Amount) + **total**.
7. **Less: Unpresented cheques** — table (Date, Name/Details, Chq No, Amount) + **total**.
8. **Balance per cash book at end of period** — single prominent amount (= bank closing + lodgments − cheques).
9. Sign-off (Prepared by, Reviewed by, Approved by) and optional narrative/comments.
10. Footer (from organisation branding).

---

## Terminology (use consistently)

| Term | Use in report, PDF, Excel |
|------|---------------------------|
| **Uncredited lodgments** | Receipts/lodgments not yet credited by the bank. |
| **Unpresented cheques** | Cheques issued but not yet presented to the bank. |
| **Balance per cash book at end of period** | Resulting balance after reconciliation. |
| **As at [date]** | Reconciliation date in title, e.g. "AS AT 31-DECEMBER-2024". |
| **Closing balance per bank statement** | Balance from the bank statement. |

---

## Date & number formatting (Ghana)

- **Dates (display):** DD MMM YYYY (e.g. 31 Dec 2024), via `formatDate()`.
- **BRS title date:** DD-MMM-YYYY (e.g. 31-DECEMBER-2024), via `formatDateBRSTitle()`.
- **Amounts:** Currency symbol + en-GB grouping (e.g. GH₵61,131.32), via `formatAmount(amount, currency)`.
- **Default currency:** GHS (GH₵).

See `web/src/lib/format.ts` and `web/src/lib/currency.ts`.
