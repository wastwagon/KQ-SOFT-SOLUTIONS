# Lordship Ecobank — complete manual mark review (√ / ** / ??)

**Purpose:** Explain why Lordship feels “hard,” what every preparer mark means, and how platform figures relate — especially **`??`** columns the client keeps citing.

**Manuals (answer keys only — do not upload):**
- `file2/q1-2026-answer-keys/Account901 brs as at31.3.2026 updated.xlsx` → acct **9033** / 1441001519033  
- `file2/q1-2026-answer-keys/Account902 brs as at 31.3.2026 updated.xlsx` → acct **9035** / 1441001519035  

**Live source packs:**
- 9033 → `accountno552records/`  
- 9035 → `accountno095details/`  

---

## Preparer mark legend

| Mark | Meaning | Use on face BRS? |
|------|---------|------------------|
| **`√`** | Verified final figure | **Yes** — this is the signed answer |
| **`**`** | Pair / cleared against the other schedule | Remove from “open” when netting |
| **`??`** | Working / intermediate column | **Relevant for understanding**, not the final signed line |

The workbook is a **two-column working paper**: left = section / √ path; right (`??`) = gross-before-final-netting path. Both can be arithmetically consistent if the companion `??` lines are used together.

---

## Account 901 / 9033

### Face BRS — `√` (what the platform should match)

| Line | √ amount (GHS) | Platform (workbook netting ON) |
|------|----------------|--------------------------------|
| Closing balance per bank | **18,643.29** | ✓ |
| Uncredited lodgments | 0 | ✓ |
| Unpresented cheques (final) | **10,660.97** | ✓ |
| Bank-only debits | **374,054.70** | ✓ |
| Bank-only credits | **3,479.73** | ✓ |
| Balance per cash book | **378,557.29** | ✓ |
| Tie-out | ~0 | ✓ |

How **10,660.97** is reached (workbook Groups 2–3), not typed as a single √ on the unpresented TOTAL row:
- Section A list total = **8,000.26** (4 cheques)
- After Groups 2–3 / judgment netting → face unpresented **10,660.97**
- That is the only unpresented amount that ties bank + bank-only √ lines to cash book √

### `??` companions (why 17,825.86 keeps coming up)

| Row | Left (section / √ path) | Right (`??` / working) |
|-----|-------------------------|-------------------------|
| Unpresented TOTAL | **8,000.26** (section A only) | **17,825.86** `??` |
| Bank-only debits TOTAL | **374,054.70** √ | **381,219.59** `??` |

**Their method (now implemented as BRS schedule → Working (??)):**

```
?? unpresented = Section A (true unpresented)     8,000.26
               + Open B₁ timing (not marked **)   9,825.60
               ─────────────────────────────────────────
               =                                 17,825.86

?? bank-only debits = √ BOD + (?? unp − √ unp)
                    = 374,054.70 + 7,164.89
                    = 381,219.59
```

Open B₁ = allowance/security/fuel-timing cheques still unmatched after `**` clearing pairs are removed (Samuel Narh ×2, Skones ×3, Royal Adjei 5,000). Judgment lines (GRA, Vodafone, …) stay out of this column.

In the product: Report → **BRS schedule → Working (??)** (or `?workbookNetting=working`).

**How 17,825.86 is built (same numbers):**

```
Section A unpresented          8,000.26
+ Unmatched payments without **  9,825.60
───────────────────────────────────────
=                               17,825.86  ??
```

(`**` payments ~16,925.20 are excluded because they pair to bank clearing/withdrawals.)

**When 17,825.86 is valid:** only with companion bank-only debits **381,219.59**:

```
18,643.29 − 17,825.86 + 381,219.59 − 3,479.73 = 378,557.29 ✓
```

**When it breaks:** keep bank-only at **374,054.70** and force unpresented **17,825.86** → cash book off by **7,164.89**.

So the client figure is **relevant as a working total**, but it is **not** the √ face “Less: Unpresented” unless the `??` bank-only column is used too.

### `**` pairs (9033) — open items that are actually cleared

Examples (cash payment ↔ bank debit/clearing):

| Chq / amount | Mark |
|--------------|------|
| 925881 / 950 | ** |
| 925975 / 975.20 | ** |
| 925976, 926102, 926059 / 5,000 fuel | ** |
| Matching bank withdrawals / inward clearing | ** |

These must **not** stay in unpresented after netting.

### Why Lordship 9033 feels broken

1. One Excel cell shows **17,825.86** next to unpresented — easy to read as “the” answer.  
2. Platform (correctly for √ path) shows **10,660.97**.  
3. With workbook netting **OFF**, platform shows ~**18,354.86** and a schedule warning — a third number.  
4. Roll-forward carries **section A 8,000.26** (4 cheques), not 10,660.97 or 17,825.86.

Three different “unpresented” concepts in one file — that is the confusion, not a missing upload.

---

## Making sense of √ vs ?? (product rule)

Both columns are real. They are two presentations of the same books:

1. **Match clearing/withdrawal pairs first** (`**` / Ecobank pattern match) so those payments leave the open pool.
2. **Group remaining unmatched payments:**
   - **True unpresented (A)** — cheque not on bank yet  
   - **Open timing (B₁)** — board/security/fuel-allowance/short-loan style still open  
   - **Judgment / other** — tax, utility, odd settlements (kept off unpresented totals)
3. **Working (??) unpresented** = A + open timing; **bank-only debits** shift by the same delta so cash book still ties.
4. **Face (√) unpresented** = continue Groups 2–3 netting on that pool (signed BRS line).

Report → **BRS schedule** chooses which presentation to show. Expand **Why Face (√) and Working (??) differ** for live group totals.

---

## Account 902 / 9035


### Face BRS — `√`

| Line | √ amount (GHS) | Platform |
|------|----------------|----------|
| Bank closing | **4,899.28** | ✓ |
| Unpresented | **2,623.18** | ✓ |
| Bank-only debits | **236,614.00** | ✓ |
| Bank-only credits | **311,018.52** | ✓ |
| Cash book | **-63,299.04** | ✓ |
| Intrinsic tie-out | **8,829.38** | ✓ (manual also has this residual) |

### `??` companions (9035)

| Row | Left | Right `??` |
|-----|------|------------|
| Unpresented TOTAL | **2,623.18** | **28,576.80** `??` |
| Bank-only debits TOTAL | **236,614** √ | **271,397** `??` |

**Working (??) build (now in product):**
```
Face unpresented                         2,623.18
+ Finders/IBAG HSE/clearing offsets     25,953.62
────────────────────────────────────────────────
= ?? unpresented                        28,576.80

?? BOD from cash-book identity → 271,397
4,899.28 − 28,576.80 + 271,397 − 311,018.52 = −63,299.04 ✓
```

Report → **BRS schedule → Working (??)** on the 9035 project.

Same pattern: gross open-payments working column vs √ face totals. Platform supports both.

### `**` / `√` on lines (9035)

- Many payments marked **`**`** = paired to inward clearing / HSE (finders fees, IBAG levies, etc.).  
- Some IBAG levy rows marked **`√`** individually (still in schedules — preparer verified those lines).  
- Bank-only debit schedule: treasury **Auct.** lines and charges marked **`√`** and included in **236,614**.

---

## File map (what belongs where)

| File | Period | Role |
|------|--------|------|
| `file2/prior-year-2025/*` | 31 Dec 2025 | Prior BRS only |
| `file2/q1-2026-answer-keys/*` | 31 Mar 2026 | Manual with √/**/?? |
| `file2/q1-2026-sources/*` | Sparse / PDFs | Reference — prefer `accountno*` for live |
| `accountno552records/` | Q1 2026 full | Live 9033 cash + bank |
| `accountno095details/` | Q1 2026 full | Live 9035 cash + bank |

---

## Platform stance (recommended)

| Show to client as “final BRS” | Show as “working paper note” |
|-------------------------------|------------------------------|
| 9033 unpresented **10,660.97** | Gross open path **17,825.86** (+ BOD **381,219.59**) |
| 9033 BOD **374,054.70** | — |
| 9035 unpresented **2,623.18** | Gross path **28,576.80** |
| 9035 BOD **236,614** | Working BOD **271,397** |

**Workbook netting ON** for 9033 is required so the UI does not show the legacy ~18k figure.

---

## Bottom line

- We are not “missing” Lordship files; we are comparing to a **multi-column preparer workbook**.  
- **`??` figures are relevant** — they are the **gross / pre-netting** path.  
- **`√` figures are authoritative** for the signed BRS and for platform tie-out.  
- Client’s **17,825.86** = section A + non-`**` unmatched payments; it only ties with **`??` bank-only debits 381,219.59**.

Optional product follow-up: surface both columns on the Ecobank report (“Face BRS” vs “Workbook gross”) so preparers see 10,660.97 and 17,825.86 labelled correctly.
