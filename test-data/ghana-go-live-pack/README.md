# Ghana Go-Live Test Pack – Horizon Insurance Brokers Ltd

Advanced Ghana cash book + Ecobank-style bank statement for **system completeness / going-live** testing.
Use the same figures for **manual Excel BRS** and **platform Excel/PDF** import tests.

## Platform run (live)

| Item | Value |
|------|--------|
| Account | `accounts@horizonbrokers.gh` / `Test123!` |
| Org | Horizon Insurance Brokers Ltd (**premium**, subscription active) |
| Project | [horizon-ecobank-golive-jun-2026-v3](http://localhost:9100/projects/horizon-ecobank-golive-jun-2026-v3) |
| Result | **All golden BRS lines tied** (see `05_platform_run_result.json`) |
| Re-run | `API_URL=http://localhost:9101 node scripts/run-ghana-go-live-pack-test.mjs` |

## Files
| File | Purpose |
|------|---------|
| `01_cash_book_horizon_jun2026.xlsx` | Cash book upload (Excel) |
| `01_cash_book_horizon_jun2026.pdf` | Same cash book (PDF upload test) |
| `02_bank_statement_ecobank_jun2026.xlsx` | Bank statement upload (Excel) |
| `02_bank_statement_ecobank_jun2026.pdf` | Same bank statement (PDF upload test) |
| `03_final_brs_as_at_30_june_2026.xlsx` | Manual golden BRS (Excel) |
| `03_final_brs_as_at_30_june_2026.pdf` | Manual golden BRS (PDF) |
| `04_manual_reference_map.xlsx` | Expected match / timing / bank-only map |
| `generate_ghana_go_live_pack.py` | Regenerator script |

## Company / Account
- **Company:** Horizon Insurance Brokers Ltd
- **Bank:** Ecobank Ghana
- **Account Number:** 1441002289035
- **Period:** 1 June 2026 – 30 June 2026
- **As at:** 30TH JUNE, 2026
- **Currency:** GHS (GH₵)

## Expected balances (golden)
| Metric | GHS |
|--------|-----|
| Opening cash book | 245,680.75 |
| Opening bank | 245,680.75 |
| BF uncredited (clears in June) | 0.00 |
| BF unpresented (clears in June) | 0.00 |
| Closing cash book | 373,162.54 |
| Closing bank statement | 372,007.29 |
| Uncredited lodgments (period-end) | 16,200.00 |
| Unpresented cheques (period-end) | 15,200.00 |
| Bank-only debits | 280.00 |
| Bank-only credits | 124.75 |
| Derived CB from schedule | 373,162.54 |
| Difference | 0.00 |

Workbook formula used:
`Cash book = Bank closing + Uncredited − Unpresented + Bank-only debits − Bank-only credits`

## Transaction types included (37 cash-book lines, 36 bank lines)
1. Funds transfer inward / outward  
2. MoMo / GIPS incoming  
3. Cheque clearing / house cheque deposit  
4. ACH other banks inward  
5. Treasury bills matured + reinvestment  
6. Staff salaries  
7. Statutory (GRA PAYE, SSNIT, NBC 2nd tier)  
8. Utilities, rent, commissions, welfare  
9. Uncredited lodgments (2)  
10. Unpresented cheques (3)  
11. Bank-only COT, SMS, maintenance, cheque book, interest  
12. One-to-many combined deposit  
13. Narration variants (`CHQ NO` vs `CHQ#`)  
14. Date / value-date lag  
15. Reversal pair  
16. Duplicate amounts (different counterparties)  
17. Brought-forward timing that clears in the period  

## How to use
1. Upload Excel cash book + bank statement into a new project (or PDF pair for PDF path).  
2. Map columns if not auto-detected (`DATE/DETAILS/AMT RECEIVED/AMT PAID` and `Transaction Date/Description/Debit/Credit/Balance`).  
3. Run matching / reconciliation.  
4. Export platform BRS and compare to `03_final_brs_as_at_30_june_2026.xlsx` / `.pdf`.  
5. Do the same reconciliation manually in Excel using the golden totals above.

## Colour cues (Excel only – not required for upload)
- Amber rows on cash book = uncredited  
- Red/orange rows on cash book = unpresented  
- Green = challenge cases (batch, reversal, duplicates)  
- Amber on bank statement = bank-only items  
