# QA Checklist (Complex Import Pack)

Use this checklist with files in `test-data/complex-import-pack/`.

## A) Pre-check
- [ ] Logged in as Admin/Preparer with upload + reconcile permissions
- [ ] New project created (clean, no prior uploads)
- [ ] Correct timezone/date locale set (to avoid date confusion)
- [ ] `manual_reconciliation_reference.xlsx` open for verification

## B) Excel Import Path
- [ ] Upload `cash_book_complex.xlsx` as cash book
- [ ] Upload `bank_statement_complex.xlsx` as bank statement
- [ ] Mapping completed for date, ref, narration, amount/debit/credit, cheque
- [ ] Signed amount mode works correctly (no inverted signs)
- [ ] Parse completes without crash/timeout
- [ ] Row counts look reasonable and non-zero for both files

## C) PDF Import Path
- [ ] Upload `cash_book_complex.pdf` + `bank_statement_complex.pdf`
- [ ] Native PDF text extraction succeeds OR fallback OCR runs gracefully
- [ ] Parsed fields map correctly (no major column drift)
- [ ] Reconcile runs successfully after PDF ingestion

## D) Image Import Path (OCR)
- [ ] Upload one image pair (`cash_book_complex_page1.png`, `bank_statement_complex_page1.png`)
- [ ] OCR extraction works (no fatal parsing errors)
- [ ] Key columns still mappable
- [ ] Reconcile runs (even if with lower match rate than Excel)

## E) Matching and Exception Logic
- [ ] One-to-many case appears: `RCPT-APR-017A` + `RCPT-APR-017B` vs `BATCH-DEP-APR17`
- [ ] Unpresented cheques appear: `PYMT-APR-CHQ1045`, `PYMT-APR-VOID111`
- [ ] Uncredited lodgement appears: `RCPT-APR-LDG2001`
- [ ] Bank-only charge appears: `BANK-CHARGE-APR23`
- [ ] Bank-only interest appears: `INTEREST-APR24`
- [ ] Reversal pair recognized (`PYMT-REV-5102*`, `TRF-5102-*`)
- [ ] Duplicate amounts handled by reference/date context (`7731`, `7732`)
- [ ] No false mass-matching on same amount only

## F) Balances and Manual Validation
- [ ] Opening/closing balances match expected values in `Summary` sheet
- [ ] Uncredited total matches manual reference
- [ ] Unpresented total matches manual reference
- [ ] Bank-only adjustments visible and correct
- [ ] Adjusted bank logic aligns with manual computation

## G) Report Output
- [ ] Report generates successfully
- [ ] Missing Cheques section populated correctly
- [ ] Uncredited Lodgements section populated correctly
- [ ] Discrepancy section reflects intentional anomalies
- [ ] Supporting docs/attachments section behaves as expected
- [ ] Exported report values match reconcile screen totals

## H) UX / Robustness
- [ ] Clear validation messages for mapping mistakes
- [ ] No silent failures during upload/reconcile
- [ ] Retry behavior works after a failed parse
- [ ] Performance acceptable (no UI freeze on these files)
- [ ] Navigation/state not lost between steps

## I) Regression Safety
- [ ] Existing simple sample files still import correctly
- [ ] Existing reconcile workflows unaffected
- [ ] Role permissions still enforced (viewer cannot modify)

---

## Defect Template

- **Title:**
- **Environment:** (prod/staging/local, browser, account role)
- **File Type:** (Excel/PDF/Image)
- **Steps to Reproduce:**
  1.
  2.
  3.
- **Expected Result:**
- **Actual Result:**
- **Reference Transaction(s):** (e.g. `RCPT-APR-LDG2001`)
- **Screenshot / Evidence:**
- **Severity:** (Critical/High/Medium/Low)
