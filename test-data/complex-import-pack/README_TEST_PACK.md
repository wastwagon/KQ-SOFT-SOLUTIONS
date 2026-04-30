# Complex Import Pack (KQ-SOFT)

This folder contains a high-complexity import dataset for reconciliation testing.

## Files
- `cash_book_complex.xlsx`
- `bank_statement_complex.xlsx`
- `cash_book_complex.pdf`
- `bank_statement_complex.pdf`
- `cash_book_complex_page1.png` (and page2/page3)
- `bank_statement_complex_page1.png` (and page2/page3)
- `manual_reconciliation_reference.xlsx`

## Complexity Included
- Mixed signed amounts (single signed column + debit/credit breakout)
- Date posting lags and value-date differences
- Narration/reference variants (`CHQ 1055` vs `CHQ#1055`)
- One-to-many combined deposit
- Unpresented cheques
- Uncredited lodgement
- Bank-only charges and interest
- Reversal pair in both books
- Duplicate-amount transactions with different references

## Quick Manual Checks
- Opening cash balance: 125000.00
- Closing cash balance: 167620.00
- Opening bank balance: 123800.00
- Closing bank balance: 165229.50
- Uncredited lodgements total: 5300.00
- Unpresented cheques total: 4200.00
- Bank-only charges: 185.00
- Bank-only interest: 94.50
- Adjusted bank (bank + uncredited - unpresented): 166329.50

Use `manual_reconciliation_reference.xlsx` for exact mapping and expected statuses.
