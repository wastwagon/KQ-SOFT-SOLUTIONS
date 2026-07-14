# Supported Ghana Banks

The BRS platform auto-detects bank statement formats for the following Ghanaian banks and suggests column mappings for credits and debits.

| Bank | Detection | Typical columns |
|------|-----------|-----------------|
| **Ecobank Ghana** | Headers + description content (FUNDS TRANSFER, CHEQUE WITHDRAWAL, etc.) | Transaction Date, Description, Credit/Debit or Payments/Deposits |
| **GCB Bank** | PDF text / Value Date + Particulars + Credit/Debit | Transaction Date, Description, Debit, Credit |
| **Standard Chartered (SCB)** | ENTRY DATE + DEBITS + CREDITS (Excel); bank name in project | Entry Date, Value Date, Description, Debits, Credits |
| **National Investment Bank (NIB)** | Booking Date + Description + Debit/Credit; UMB PDF shares NIB layout | Booking Date, Description, Debit, Credit |
| **Agricultural Development Bank (ADB)** | Branch + Reference + Debit/Credit columns | Date, Description, Debit, Credit |
| **Bank of Africa** | Our Reference + Value Date + Debit/Credit | Operation Date, Value Date, Description, Debit, Credit |
| **Bank of Ghana (BOG)** | Post Date + Description + Debit/Credit | Post Date, Description, Debit, Credit |
| **Prudential Bank** | Transaction Date + Reference + Debit/Credit (normalized PDF) | Transaction Date, Description, Debit, Credit |
| **United Merchant Bank (UMB)** | UMB PDF text (same shape as NIB); Excel may show ENTRY DATE layout | Booking/Entry Date, Description, Debit, Credit |
| **Access Bank Ghana** | Header contains "access" + standard columns | Date, Description, Credit, Debit |
| **Stanbic Bank Ghana** | Bank name in content or "Transaction Description" column | Transaction Date, Description, Credit, Debit |
| **Fidelity Bank Ghana** | Header or content contains "fidelity" | Value Date, Posting Date, Description, Credit, Debit |
| **UBA Ghana** (United Bank for Africa) | Cheque No column in normalized PDF; bank name in content | Transaction Date, Description, Debit, Credit |
| **Absa Ghana** (formerly Barclays) | Header or content contains "absa" or "barclays" | Value Date, Posting Date, Description, Credit, Debit |

## Detection logic

- **PDF parsers** (Ecobank, GCB, NIB, ADB, Absa, UBA, Prudential, UMB, BOA): Native text is normalized to standard Debit/Credit columns before mapping.
- **Excel parsers** (SCB glued rows, BOG, BOA, Stanbic, Ecobank): Workbook rows are cleaned to one transaction per line where needed.
- **SCB**: Multiline "glued" Excel cells are split; VALUE DATE is preferred for mapping when present.
- **Stanbic vs UBA vs Prudential**: Banks with similar Transaction Date layouts are distinguished by bank name in content, parser-specific columns (e.g. UBA Cheque No), or Stanbic's Transaction Description column.

## Auto-mapping on upload

When date and amount columns are detected with medium or high confidence, mapping is applied automatically after upload (`AUTO_MAP_ON_UPLOAD`, default on). Supported specimens in `corrected-bank-specimens-for-user/` are tested for this path.

## Manual mapping

If your bank is not auto-detected, map columns manually in the Mapping step. The platform expects:

- **Credits**: Date, Description/Narrative/Particulars, Credit amount
- **Debits**: Date, Description/Narrative/Particulars, Debit amount

Export statements as Excel (`.xlsx`) or CSV for best results. PDF uploads are supported for the banks listed above with dedicated parsers.
