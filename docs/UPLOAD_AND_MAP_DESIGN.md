# Upload & Map Design: Real Documents vs System Types

## The problem you raised

- **Bank statements** in the real world are **one document** that contains both credits and debits. Asking users to “extract credits only” and “debits only” into separate files is wrong.
- **Cash books** are often one document with both receipts and payments (or one export from accounting software). Forcing separate “Receipts only” / “Payments only” uploads doesn’t match how people work.
- The system should allow **multiple documents per project** and rely on **intelligent analysis at Map/Reconcile** to detect columns, suggest mappings, and advise or take actions.

## Current behaviour (after UX fix)

1. **Upload**
   - Two sections only: **Cash book** and **Bank statement**.
   - For each section the user can choose:
     - **Both** (default): “Use this file for receipts + payments” or “credits + debits”. The same file is sent to the API twice (once per type). So one real document is stored as two logical documents (receipts + payments, or credits + debits). At **Map**, the user maps columns for each; the system already supports column detection and suggested mappings.
     - **Receipts only** / **Payments only** or **Credits only** / **Debits only**: for users who already have split files.
   - Multiple files per section are supported (several cash book or bank statement documents per project).

2. **Map**
   - Each uploaded document (including the “same file” when uploaded as Both) appears in Map. User maps columns (date, amount, reference, etc.). The backend already:
     - Detects Ghana bank formats and suggests mappings for bank docs.
     - Uses document type (cash_book_receipts, cash_book_payments, bank_credits, bank_debits) to know which canonical amount field to use (amt_received, amt_paid, credit, debit).
   - So for “one statement with both”: the user maps the **credits** document to the credit column(s) and the **debits** document to the debit column(s). No need to split the file manually.

3. **Reconcile / Report**
   - Unchanged: reconciliation and report logic expect these four document types and use the mapped transactions.

## Why the backend still has four types

- The reconciliation engine (and report) is built around four logical streams: cash book receipts, cash book payments, bank credits, bank debits. So the API and database use `cash_book_receipts`, `cash_book_payments`, `bank_credits`, `bank_debits`.
- Sending the same file twice when the user chooses “Both” keeps the backend unchanged and gives the correct behaviour: one real document is used for both sides, and at Map the user assigns columns per side.

## Future improvements (AI / smart behaviour)

1. **Single “combined” document type (backend change)**  
   - New document type(s), e.g. `cash_book` and `bank_statement`, with no receipt/payment or credit/debit split at upload.
   - At **Map** (or an import step), the system parses the file, detects columns (e.g. “Credit”, “Debit”, “Deposit”, “Withdrawal”), and either:
     - Splits rows into two logical streams (credits vs debits) and stores them for reconcile, or
     - Keeps one document and the reconcile engine reads “credit” and “debit” columns from the same document.
   - This would remove the need to upload the same file twice when it contains both.

2. **Smarter Map step**
   - **Column detection**: Use headers and sample data to detect “this column is credit”, “this is debit”, “this is date”, “this is reference”. The app already has some Ghana bank format detection; this can be extended (and applied to cash book).
   - **AI suggestions**: Suggest mappings and, at Reconcile, suggest matches and actions (e.g. “flag for review”, “auto-match”). Plan features already mention `ai_suggestions`; that can drive “advise actions and take actions” at Map/Reconcile.

3. **Multiple documents per project**
   - Already supported: user can upload several files in each section. Map and Reconcile already work with multiple documents; no change needed for “several documents belonging to the same project”.

## Summary

- **Now**: Upload is two sections (Cash book | Bank statement). “Use as: Both” lets one real document be used for both sides without manually splitting; Map is where the user assigns which columns are receipts/payments or credits/debits. Multiple documents per project are supported.
- **Later**: Backend can add combined document types and/or smarter parsing so one upload stays one document and Map/Reconcile use column detection and AI to advise and take actions.
