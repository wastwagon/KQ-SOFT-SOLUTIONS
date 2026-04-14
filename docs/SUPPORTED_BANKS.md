# Supported Ghana Banks

The BRS platform auto-detects bank statement formats for the following Ghanaian banks and suggests column mappings for credits and debits.

| Bank | Detection | Typical columns |
|------|-----------|-----------------|
| **Ecobank Ghana** | Headers + description content (FUNDS TRANSFER, CHEQUE WITHDRAWAL, etc.) | Transaction Date, Description, Credit/Debit |
| **GCB Bank** | Value Date, Particulars, Credit/Debit | Value Date, Particulars, Credit, Debit |
| **Access Bank Ghana** | Header contains "access" + standard columns | Date, Description, Credit, Debit |
| **Stanbic Bank Ghana** | Header or content contains "stanbic" or "standard bank" | Value Date, Posting Date, Description, Credit, Debit |
| **Fidelity Bank Ghana** | Header or content contains "fidelity" | Value Date, Posting Date, Description, Credit, Debit |
| **UBA Ghana** (United Bank for Africa) | Header or content contains "uba" or "united bank" | Value Date, Posting Date, Description, Credit, Debit |
| **Absa Ghana** (formerly Barclays) | Header or content contains "absa" or "barclays" | Value Date, Posting Date, Description, Credit, Debit |

## Detection logic

- **Ecobank** and **GCB**: Primarily header-based with optional content patterns.
- **Access Bank**: Requires "access" in header row.
- **Stanbic, Fidelity, UBA, Absa**: Require bank name in header or transaction descriptions, plus standard date/description/credit/debit columns.

## Manual mapping

If your bank is not auto-detected, you can map columns manually in the Mapping step. The platform expects:

- **Credits**: Date, Description/Narrative/Particulars, Credit amount
- **Debits**: Date, Description/Narrative/Particulars, Debit amount

Export statements as Excel (`.xlsx`) or CSV for best results.
