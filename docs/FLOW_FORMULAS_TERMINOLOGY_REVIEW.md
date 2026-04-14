# Flow, Formulas & Terminology Review

**Purpose:** End-to-end review of the BRS application flow, calculation formulas, accuracy, and professional account/reconciliation terminology.

---

## 1. End-to-end flow

| Step | Purpose | Inputs | Outputs / Next |
|------|---------|--------|----------------|
| **1. Upload** | Ingest source data | Cash book file(s), bank statement file(s); document type (receipts/payments/both, credits/debits/both); optional bank account | Documents stored with type; transactions not yet created |
| **2. Map** | Map columns to canonical fields; parse rows into transactions | Document ID, column index mapping (date, name, details, amount, chq_no, etc.) | Transactions created; project status → mapping |
| **3. Reconcile** | Match cash book entries to bank entries | Receipts ↔ Credits; Payments ↔ Debits; optional bank account filter | Matches (pairs/groups); suggestions (amount ± tolerance, date window, ref/chq) |
| **4. Review** | Summarise match status; variance; submit/approve | Reconcile data (matches, unmatched lists) | Submit for review → status submitted_for_review; Approve → completed; or proceed to Report with exceptions |
| **5. Report** | Generate BRS and five report sections | Report API (project, optional bank account); uses same documents & matches | BRS statement, summary, brought forward, missing cheques, discrepancy, matched, exceptions, supporting documents; PDF/Excel export |

**Linking:** Each step uses the same project (by slug). Map writes transactions to documents; Reconcile and Report read those documents and project.matches. No step is skipped in sequence; hash/step state keeps Upload → Map → Reconcile → Review → Report in sync.

---

## 2. Calculations and formulas

### 2.1 Upload

- **No formulas.** Files are stored; document type is set from user choice (receipts / payments / both for cash book; credits / debits / both for bank). For “both”, the backend creates two documents (e.g. receipts + payments) from the same file.

### 2.2 Map

- **Amount extraction:** One amount per row:
  - Cash book receipts: column mapped to `amt_received`.
  - Cash book payments: column mapped to `amt_paid`.
  - Bank credits: column mapped to `credit`.
  - Bank debits: column mapped to `debit`.
- **Parsing:** `parseNum(v)` strips non-numeric characters except digits, `.`, `-`; then `parseFloat`. Empty or non-numeric → 0. Rows with amount 0 and no date/name/details can be skipped (current logic includes them if any of date/name/details exist).
- **Date:** `parseDate` via `new Date(String(v))`; invalid → null. Used for ageing and matching.

**Accuracy:** Amount and date parsing are consistent. No rounding at map stage; amounts stored as entered/parsed.

### 2.3 Reconcile — matching engine

- **Amount match:** `|cb.amount - bank.amount| ≤ 0.01` (AMOUNT_TOLERANCE). Same tolerance in backend only; frontend displays amounts as stored.
- **Date window:** Suggestions only if dates within 3 days (DATE_WINDOW_DAYS). Null dates treated as “within window” (no false exclude).
- **Confidence (suggestions):**  
  - Amount match: +0.6  
  - Date within window: +0.3  
  - Description overlap (first 20 chars): +0.1  
  - Reference/chq match: +0.15  
  - Cap at 1.0. Suggestion included only if confidence ≥ 0.6.
- **Cheque rule (payments ↔ debits):** If cash book transaction has `chqNo`, a suggestion is only added when reference/chq matches (refsMatch); amount still required.

**Accuracy:** Tolerance 0.01 is suitable for currency with 2 decimal places. Confidence is for ranking only; user confirms matches. Cheque rule reduces wrong same-amount suggestions when chq no is present.

### 2.4 Review — variance

- **Variance (reconcile-variance.ts and Review UI):**  
  - `totalUnmatchedCb = sum(unmatched receipts amounts) + sum(unmatched payments amounts)`  
  - `totalUnmatchedBank = sum(unmatched credits amounts) + sum(unmatched debits amounts)`  
  - `variance = totalUnmatchedCb - totalUnmatchedBank`
- **Interpretation:**  
  - Variance &gt; 0: total unmatched cash book value &gt; total unmatched bank → “(CB &gt; Bank)”.  
  - Variance &lt; 0: total unmatched bank &gt; total unmatched cash book → “(Bank &gt; CB)”.  
  - Used for threshold approval (Premium+): when `|variance| > approvalThresholdAmount`, only admin can approve.

**Accuracy:** Formula is consistent between API (getProjectVariance) and Review page (totalUnmatchedCb - totalUnmatchedBank). It is a **discrepancy indicator** (unmatched totals difference), not “balance per cash book minus balance per bank”.

### 2.5 Report — BRS statement

- **Balance per cash book:**  
  `balancePerCashBook = Σ(receipts.amount) − Σ(payments.amount)`  
  i.e. total receipts minus total payments (all transactions in the project’s cash book documents).

- **Uncredited lodgments total:**  
  `uncreditedLodgmentsTotal = Σ(unmatched receipts.amount)`  
  Receipts not yet matched to any bank credit.

- **Unpresented cheques total:**  
  `unpresentedChequesTotal = Σ(unmatched payments.amount) + Σ(broughtForwardItems.amount)`  
  Unmatched payments (current period) plus brought-forward unpresented cheques from the previous period (roll-forward).

- **Closing balance per bank statement (derived):**  
  `bankClosingBalance = balancePerCashBook + unpresentedChequesTotal − uncreditedLodgmentsTotal`  
  This satisfies the identity:  
  **Bank closing + Uncredited lodgments − Unpresented cheques = Balance per cash book**  
  So: `bankClosingBalance = balancePerCashBook − uncreditedLodgmentsTotal + unpresentedChequesTotal`.

**Accuracy:** Algebra is correct. The report **derives** “Closing balance per bank statement” from the cash book and the two adjustments so the printed identity holds. The system does not currently take an “as per bank statement” closing balance as a separate input; if that is added later, it could be shown alongside the derived figure for comparison.

### 2.6 Report — ageing (missing cheques)

- **Reference date:** `project.reconciliationDate` or today.
- **Days outstanding:** `floor((refDate − txDate) / (24×60×60×1000))` (whole days).
- **Bands:** 0–30, 31–60, 61–90, 90+ days. Counts and totals per band are consistent with `missingChequesWithAgeing`.

### 2.7 Report — discrepancy (variance in matched pairs)

- **Included in discrepancy list:** Pairs where `|cb.amount − bank.amount| > 0.01` or `|date difference| > 0` days.
- **Amount variance:** `|cb.amount − bank.amount|`; bands 0–1, 1–100, 100–500, 500+.
- **Date variance:** Days between cb.date and bank.date; bands 0–7, 7–30, 30+ days.

**Accuracy:** Same 0.01 tolerance as matching; variance bands are consistent with displayed pairs.

---

## 3. Terminology — professional use

### 3.1 Standard BRS terms (aligned)

| Term | Use in app | Professional meaning |
|------|------------|----------------------|
| **Closing balance per bank statement** | First line of BRS; value derived so identity holds | Balance as per bank at period end (here: derived from cash book and adjustments). |
| **Add: Uncredited lodgments** | Second line; sum of unmatched receipts | Receipts recorded in cash book not yet credited by the bank. |
| **Less: Unpresented cheques** | Third line; unmatched payments + brought forward | Cheques issued (cash book) not yet presented to the bank. |
| **Balance per cash book at end of period** | Fourth line; receipts − payments | Reconciled cash book balance; equals bank + uncredited − unpresented. |
| **Uncredited lodgments** (in narrative/help) | Report narrative; Reconcile “Note”; BrsHelp | Same as above; “receipts not in bank” / “not yet shown as credited by the bank”. |
| **Unpresented cheques** (in narrative/help) | Report narrative; Reconcile “Note”; BrsHelp | Same as above; “payments not in bank” / “not yet presented to the bank”. |
| **Brought forward (from previous period BRS)** | Report section; roll-forward | Unpresented cheques carried from the previous period’s BRS. |
| **Missing Cheques Report** | Report section; ageing | Unpresented cheques with days outstanding and ageing bands. |
| **Reconciliation Discrepancy Report** | Report section | Matched pairs with amount or date variance. |

### 3.2 Cash book vs bank (document types)

- **Cash book receipts** / **Cash book payments** — standard; “receipts” = money in, “payments” = money out (including cheques).
- **Bank credits** / **Bank debits** — standard; credits = lodgments to account, debits = withdrawals.
- **Matching:** Receipts ↔ Credits, Payments ↔ Debits — correct and consistently used in Reconcile and Report.

### 3.3 Review and variance labels

- **“Unmatched cash book”** — count of unmatched receipt + payment rows; clear.
- **“Unmatched bank”** — count of unmatched credit + debit rows; clear.
- **“Variance (CB &gt; Bank)” / “(Bank &gt; CB)”** — reflects sign of (total unmatched CB amounts − total unmatched bank amounts). Professionally, this is a **reconciliation discrepancy indicator** (difference in unmatched totals), not the balance difference. Optional improvement: add a short in-app tooltip such as “Difference between total unmatched cash book amounts and total unmatched bank amounts.”

### 3.4 Draft vs final

- **Draft** — current report before submit/approve; used in Review and Help.
- **Final report** — after Approve; “Final report” stamp and approval date on Report. Terminology is consistent.

---

## 4. Consistency and recommendations

### 4.1 Consistency summary

- **Flow:** Upload → Map → Reconcile → Review → Report is linear; project and documents are shared; hash and step state stay in sync.
- **Formulas:** BRS identity (bank + uncredited − unpresented = cash book) is implemented correctly; balance per cash book, uncredited total, and unpresented total (including brought forward) are defined and used consistently in API, web report, and Excel/PDF export.
- **Tolerances:** 0.01 for amount matching and discrepancy; 3-day window for suggestion dates; same logic in matching and discrepancy report.
- **Terminology:** “Uncredited lodgments”, “Unpresented cheques”, “Balance per cash book”, “Closing balance per bank statement”, “Brought forward”, “Missing cheques”, “Reconciliation Discrepancy” are used in line with standard BRS and Ghana practice.

### 4.2 Optional improvements

1. **Bank statement closing balance (optional input):** If the organisation has an “as per bank statement” closing balance, consider an optional field and show it on the BRS (e.g. “As per bank statement: X” vs “Reconciled (derived): Y”) for audit clarity.
2. **Variance explanation:** Add a brief tooltip or help line on Review that “Variance” is the difference between total unmatched cash book amounts and total unmatched bank amounts (discrepancy indicator).
3. **Map step:** Document or hint that “date” is required for ageing and matching; already hinted on Upload for cash book date and cheque amounts.
4. **Row filter at map:** Rows with amount 0 and no date/name/details are currently included if any of date/name/details exist; consider documenting or optionally excluding fully empty rows.

---

## 5. Summary

- **Flow:** Five steps are well defined and linked; data flows from Upload/Map into Reconcile and Report without gaps.
- **Formulas:** BRS formula and all derived totals (balance per cash book, uncredited, unpresented, bank closing, ageing, discrepancy bands) are correct and consistent across API, web, and export.
- **Accuracy:** Amount tolerance (0.01), date window (3 days), and variance/discrepancy logic are consistent; cheque rule and confidence scoring are used appropriately for suggestions.
- **Terminology:** Account and reconciliation terms (uncredited lodgments, unpresented cheques, balance per cash book, closing balance per bank statement, brought forward, missing cheques, discrepancy) are used in a professional and standard manner suitable for BRS and audit use.
