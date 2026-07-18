Prudential Bank — Grace Academy (Sep 2023) corrected parse package
Generated: July 2026

WHAT IS "CORRECTED"
The bank PDF is the original statement from Prudential (unchanged).
The correction is in KQ Soft's PDF parser: inward clearing, split lines, and commission noise are handled correctly.
Use the parsed Excel for upload/reconciliation; compare with Grace Academy BRS workbooks in reference-grace-academy-brs/.

FILES
  original/
    Prudential bank(0091900180008)_sep 23[10235].pdf — source statement
  parsed-excel/
    ... - parsed.xlsx — Transactions sheet from updated prudential_pdf parser
  reference-grace-academy-brs/
    grace-academy-brs-as-at-3oth-sept-2023-bank-statement-receipts.xlsx
    grace-academy-brs-as-at-3oth-sept-2023-bank-statement-payments.xlsx

PARSE TOTALS (Sep 2023 PDF)
  Rows: 284 (231 debits + 53 credits in manifest; see Transactions sheet)
  Sum debits:  GHS 419,133,070.68
  Sum credits: GHS 428,126,625.12

Grace Excel had 29 receipt rows / 352 payment rows (manual subset); PDF parse finds additional inward credits not in that workbook.

Full multi-bank corrected specimens: corrected-bank-specimens-for-user/10-prudential/ or corrected-bank-specimens-for-user.zip

WHERE IS THE PDF?
  • ORIGINAL-Prudential-bank-statement-Sep-2023.pdf  (same file, easy name — top of this folder)
  • original/Prudential bank(0091900180008)_sep 23[10235].pdf  (bank filename)
  • parsed-excel/  contains only the Excel — not the PDF
