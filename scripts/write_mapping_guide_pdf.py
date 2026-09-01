#!/usr/bin/env python3
"""User guide PDF: auto-suggested vs manual column mapping (Map step)."""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "download" / "KQ-Soft-Mapping-Guide-Auto-and-Manual.pdf"

GREEN = colors.HexColor("#0F3D2E")
GOLD = colors.HexColor("#C4A35A")
INK = colors.HexColor("#1A1A1A")
MUTED = colors.HexColor("#5C6570")
RULE = colors.HexColor("#D7DDE3")
ROW = colors.HexColor("#F4F7F5")
TIP_BG = colors.HexColor("#E8F3EC")
WARN_BG = colors.HexColor("#FFF6E8")


def styles():
    base = getSampleStyleSheet()
    return {
        "kicker": ParagraphStyle(
            "kicker",
            parent=base["Normal"],
            fontName="Times-Bold",
            fontSize=8.5,
            textColor=GOLD,
            tracking=1.2,
            spaceAfter=2 * mm,
        ),
        "title": ParagraphStyle(
            "title",
            parent=base["Title"],
            fontName="Times-Bold",
            fontSize=20,
            leading=24,
            textColor=GREEN,
            spaceAfter=2 * mm,
        ),
        "subtitle": ParagraphStyle(
            "subtitle",
            parent=base["Normal"],
            fontName="Times-Italic",
            fontSize=10.5,
            leading=14,
            textColor=MUTED,
            spaceAfter=4 * mm,
        ),
        "h": ParagraphStyle(
            "h",
            parent=base["Heading2"],
            fontName="Times-Bold",
            fontSize=12.5,
            leading=16,
            textColor=GREEN,
            spaceBefore=5 * mm,
            spaceAfter=2.5 * mm,
        ),
        "h3": ParagraphStyle(
            "h3",
            parent=base["Heading3"],
            fontName="Times-Bold",
            fontSize=10.5,
            leading=14,
            textColor=INK,
            spaceBefore=3 * mm,
            spaceAfter=2 * mm,
        ),
        "body": ParagraphStyle(
            "body",
            parent=base["Normal"],
            fontName="Times-Roman",
            fontSize=10,
            leading=14,
            textColor=INK,
            alignment=TA_JUSTIFY,
            spaceAfter=2.2 * mm,
        ),
        "cell": ParagraphStyle(
            "cell",
            parent=base["Normal"],
            fontName="Times-Roman",
            fontSize=8.6,
            leading=11.5,
            textColor=INK,
        ),
        "cellb": ParagraphStyle(
            "cellb",
            parent=base["Normal"],
            fontName="Times-Bold",
            fontSize=8.6,
            leading=11.5,
            textColor=GREEN,
        ),
        "head": ParagraphStyle(
            "head",
            parent=base["Normal"],
            fontName="Times-Bold",
            fontSize=8.4,
            leading=11,
            textColor=colors.white,
        ),
        "bullet": ParagraphStyle(
            "bullet",
            parent=base["Normal"],
            fontName="Times-Roman",
            fontSize=10,
            leading=13.5,
            textColor=INK,
            leftIndent=2 * mm,
        ),
        "callout": ParagraphStyle(
            "callout",
            parent=base["Normal"],
            fontName="Times-Roman",
            fontSize=9.5,
            leading=13,
            textColor=INK,
        ),
    }


def p(style, text):
    return Paragraph(text, style)


def bullets(style, items):
    return ListFlowable(
        [ListItem(p(style, item)) for item in items],
        bulletType="bullet",
        leftIndent=12,
        bulletFontName="Times-Roman",
        bulletFontSize=10,
    )


def table(data, col_widths, header=True):
    t = Table(data, colWidths=col_widths, repeatRows=1 if header else 0)
    cmds = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("GRID", (0, 0), (-1, -1), 0.35, RULE),
        ("BACKGROUND", (0, 1), (-1, -1), colors.white),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, ROW]),
    ]
    if header:
        cmds.insert(0, ("BACKGROUND", (0, 0), (-1, 0), GREEN))
        cmds.insert(1, ("TEXTCOLOR", (0, 0), (-1, 0), colors.white))
    t.setStyle(TableStyle(cmds))
    return t


def callout_box(text, bg=TIP_BG, border=GOLD):
    inner = [[p(styles()["callout"], text)]]
    t = Table(inner, colWidths=[174 * mm])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), bg),
                ("BOX", (0, 0), (-1, -1), 0.6, border),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    return t


def header_footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(GREEN)
    canvas.rect(0, h - 8 * mm, w, 8 * mm, fill=1, stroke=0)
    canvas.setFillColor(GOLD)
    canvas.rect(0, h - 9.2 * mm, w, 1.2 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Times-Bold", 8)
    canvas.drawString(18 * mm, h - 5.6 * mm, "KQ SOFT SOLUTIONS")
    canvas.setFont("Times-Roman", 8)
    canvas.drawRightString(w - 18 * mm, h - 5.6 * mm, "Bank Reconciliation System")
    canvas.setFillColor(GREEN)
    canvas.rect(0, 0, w, 12 * mm, fill=1, stroke=0)
    canvas.setFillColor(GOLD)
    canvas.rect(0, 12 * mm, w, 1 * mm, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Times-Roman", 8)
    canvas.drawString(18 * mm, 5 * mm, "Mapping guide — auto-suggested & manual  ·  September 2026")
    canvas.drawRightString(w - 18 * mm, 5 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build_story():
    s = styles()
    story = []

    # Cover
    story.append(p(s["kicker"], "USER GUIDE  ·  MAP STEP"))
    story.append(p(s["title"], "Column mapping: auto-suggested and manual"))
    story.append(
        p(
            s["subtitle"],
            "KQ Bank Reconciliation System  ·  For preparers and reviewers  ·  Updated September 2026",
        )
    )
    story.append(
        p(
            s["body"],
            "This guide explains the full <b>Map</b> step: how the system reads your uploaded files, "
            "how <b>auto-suggested mapping</b> works, when you must map <b>manually</b>, and how to "
            "confirm you are ready for Reconcile and Report. Mapping is a one-time setup per document; "
            "matching happens later on the Reconcile tab.",
        )
    )

    story.append(p(s["h"], "1. Where mapping fits in the workflow"))
    story.append(
        table(
            [
                [p(s["head"], "Step"), p(s["head"], "Tab"), p(s["head"], "What you do")],
                [
                    p(s["cellb"], "1. Upload"),
                    p(s["cell"], "Upload"),
                    p(s["cell"], "Add cash book and bank statement files. Choose Receipts, Payments, Both, or bank Credits/Debits as needed."),
                ],
                [
                    p(s["cellb"], "2. Map"),
                    p(s["cell"], "Map"),
                    p(
                        s["cell"],
                        "<b>This guide.</b> Tell the system which column is Date, Amount, Description, etc. Extract transactions.",
                    ),
                ],
                [
                    p(s["cellb"], "3. Reconcile"),
                    p(s["cell"], "Reconcile"),
                    p(s["cell"], "Link cash book rows to bank rows (or leave unmatched for BRS timing items)."),
                ],
                [
                    p(s["cellb"], "4. Review / Report"),
                    p(s["cell"], "Report"),
                    p(s["cell"], "Check variance, enter closing balances, export the Bank Reconciliation Statement (BRS)."),
                ],
            ],
            [22 * mm, 24 * mm, 128 * mm],
        )
    )

    story.append(p(s["h"], "2. Key concepts before you map"))
    story.append(p(s["h3"], "2.1 Mapping vs matching"))
    story.append(
        p(
            s["body"],
            "<b>Mapping</b> connects your file’s columns to standard fields (Date, Amount received, Credit, etc.). "
            "It runs once per logical document and produces the transaction list used everywhere else. "
            "<b>Matching</b> (Reconcile) links an extracted cash book row to a bank row. Do not confuse the two.",
        )
    )
    story.append(p(s["h3"], "2.2 Logical document types"))
    story.append(
        p(
            s["body"],
            "One physical Excel file may become several logical documents in the project:",
        )
    )
    story.append(
        bullets(
            s["bullet"],
            [
                "<b>cash_book_receipts</b> — money recorded as received (map Amount received).",
                "<b>cash_book_payments</b> — money recorded as paid (map Amount paid).",
                "<b>bank_credits</b> — credits on the bank statement.",
                "<b>bank_debits</b> — debits on the bank statement.",
            ],
        )
    )
    story.append(
        p(
            s["body"],
            "If you uploaded a cash book as <b>Both</b>, you will map the same file twice — once for receipts and once for payments — "
            "usually with the same worksheet but different amount columns.",
        )
    )

    story.append(p(s["h"], "3. What happens when you map (behind the scenes)"))
    story.append(
        bullets(
            s["bullet"],
            [
                "The file is read (Excel, CSV, PDF, or scanned image).",
                "For Excel workbooks with multiple tabs, a <b>worksheet</b> is chosen (see Section 5).",
                "Header rows are detected. Supported Ghana banks and ERP layouts may be normalised automatically.",
                "Each canonical field (Date, Amount, …) is linked to a column index.",
                "Rows are extracted: dates parsed (including Excel serial dates), amounts cleaned, zero lines skipped.",
                "Duplicate identical rows may be skipped (same date, amount, and narrative).",
                "Transactions are stored for Reconcile and Report.",
            ],
        )
    )
    story.append(
        callout_box(
            "<b>Required:</b> Every document must have a <b>date</b> column mapped. "
            "Without a date, matching and ageing cannot run reliably."
        )
    )

    story.append(PageBreak())
    story.append(p(s["h"], "4. Auto-suggested mapping (bulk apply)"))
    story.append(
        p(
            s["body"],
            "On the Map tab, the panel <b>Bulk apply — which files?</b> lists every uploaded document. "
            "Ticked files are included when you click <b>Apply suggested mapping to selected</b>. "
            "New uploads are ticked automatically; untick any file you want to skip or map by hand.",
        )
    )
    story.append(p(s["h3"], "4.1 What the system suggests"))
    story.append(
        bullets(
            s["bullet"],
            [
                "Matches header names to standard fields (Date, Credit, Debit, Description, Cheque no., etc.).",
                "For Excel, picks the <b>best worksheet</b> — the tab with date + amount columns and the most transaction rows.",
                "Applies a <b>saved layout</b> from your organisation if a similar file was mapped before.",
                "For known Ghana bank exports (Ecobank, GCB, SCB, NIB, BOG, Absa, Stanbic, …), may apply bank-specific normalisation.",
                "For TGL/IBIS ERP cash books, may split signed Amount into receipt and payment columns and preserve foreign-currency columns.",
            ],
        )
    )
    story.append(p(s["h3"], "4.2 When auto-suggested is enough"))
    story.append(
        table(
            [
                [p(s["head"], "Situation"), p(s["head"], "Recommendation")],
                [
                    p(s["cell"], "Single-sheet cash book or bank statement"),
                    p(s["cellb"], "Use bulk apply, then spot-check row counts."),
                ],
                [
                    p(s["cell"], "Monthly export with clear Date + Debit/Credit columns"),
                    p(s["cellb"], "Use bulk apply."),
                ],
                [
                    p(s["cell"], "Same layout as a file you mapped last month (saved layout banner)"),
                    p(s["cellb"], "Use bulk apply; adjust only if preview looks wrong."),
                ],
                [
                    p(s["cell"], "Report tie-out variance ≈ 0 after mapping"),
                    p(s["cellb"], "Proceed to Reconcile."),
                ],
            ],
            [88 * mm, 86 * mm],
        )
    )
    story.append(p(s["h3"], "4.3 After bulk apply — read the summary"))
    story.append(
        table(
            [
                [p(s["head"], "Message"), p(s["head"], "Meaning")],
                [
                    p(s["cellb"], "X transaction(s) extracted"),
                    p(s["cell"], "Mapping succeeded for that file."),
                ],
                [
                    p(s["cellb"], "Sign warnings"),
                    p(s["cell"], "Some amounts have unexpected signs (e.g. negative in a receipts column). Review preview."),
                ],
                [
                    p(s["cellb"], "Skipped duplicate rows"),
                    p(s["cell"], "Identical lines were deduplicated."),
                ],
                [
                    p(s["cellb"], "Skipped zero-amount rows"),
                    p(s["cell"], "Blank or zero lines ignored."),
                ],
                [
                    p(s["cellb"], "Some files have no extracted transactions"),
                    p(s["cell"], "That document still needs mapping or the sheet has no data."),
                ],
            ],
            [52 * mm, 122 * mm],
        )
    )

    story.append(p(s["h"], "5. Manual mapping (individual documents)"))
    story.append(
        p(
            s["body"],
            "Use <b>Or select a document to map or adjust</b> when bulk apply is wrong or you need to verify a multi-sheet workbook.",
        )
    )
    story.append(
        bullets(
            s["bullet"],
            [
                "Choose the document from the dropdown (e.g. acct430 cash book.xlsx — cash_book_receipts).",
                "Review the preview table (first rows and column indices).",
                "If the file has multiple tabs, open <b>Worksheet (Excel)</b> and pick the correct sheet.",
                "For each canonical field, select the matching source column.",
                "Read Fix required / Check / Tip messages and confidence labels (high / medium / low).",
                "Click <b>Apply mapping</b>.",
            ],
        )
    )
    story.append(p(s["h3"], "5.1 When you must map manually (or adjust after bulk apply)"))
    story.append(
        table(
            [
                [p(s["head"], "Situation"), p(s["head"], "What to do")],
                [
                    p(s["cell"], "Multi-sheet ERP export (TGL/IBIS) with notes tabs"),
                    p(s["cell"], "Open cash book manually; select the pre-reconciliation sheet (not the double-entry sheet)."),
                ],
                [
                    p(s["cell"], "Auto-pick chose the tab with more rows but wrong data"),
                    p(s["cell"], "Change Worksheet, clear mapping, re-apply."),
                ],
                [
                    p(s["cell"], "Multi-currency — BRS uses foreign currency (EUR/USD)"),
                    p(s["cell"], "Map FC AMT RECEIVED / FC AMT PAID (or Foreign Currency Amount), not GHS equivalent only."),
                ],
                [
                    p(s["cell"], "Receipt/payment counts look inverted (e.g. 17 payments / 9 receipts when you expect the opposite)"),
                    p(s["cell"], "Wrong worksheet or wrong amount column — re-map manually."),
                ],
                [
                    p(s["cell"], "Yellow tie-out warning on Report after mapping"),
                    p(s["cell"], "Re-check worksheet, closing balances, and do not accept wrong reconcile matches."),
                ],
                [
                    p(s["cell"], "Saved layout applied but columns shifted"),
                    p(s["cell"], "Adjust fields; use Forget layout if the saved map is wrong for this file type."),
                ],
            ],
            [78 * mm, 96 * mm],
        )
    )

    story.append(p(s["h"], "6. Worksheet (Excel) selection"))
    story.append(
        p(
            s["body"],
            "When an Excel workbook has more than one tab, the Map page shows a <b>Worksheet (Excel)</b> dropdown. "
            "Bulk apply automatically uses the best transaction sheet (date + amount columns, row count, clean rows). "
            "You can change the tab at any time before Apply mapping; changing the sheet clears the current column picks.",
        )
    )
    story.append(
        callout_box(
            "<b>Example — TGL GT Bank EUR (acct 430):</b> Sheet1 contains double-entry and post-BRS updates; "
            "Sheet2 is the pre-reconciliation cash book. Auto-pick may choose Sheet1 because it has more rows. "
            "For BRS you must select <b>Sheet2</b> manually.",
            bg=WARN_BG,
        )
    )
    story.append(
        p(
            s["body"],
            "<b>Alternative:</b> Export only the correct sheet from your accounting system and upload that single-tab file — "
            "then auto-pick cannot choose the wrong tab.",
        )
    )

    story.append(PageBreak())
    story.append(p(s["h"], "7. Fields to map"))
    story.append(p(s["h3"], "7.1 Cash book"))
    story.append(
        table(
            [
                [p(s["head"], "Field"), p(s["head"], "App label"), p(s["head"], "Required?"), p(s["head"], "Notes")],
                [
                    p(s["cellb"], "date"),
                    p(s["cell"], "Date"),
                    p(s["cell"], "Yes"),
                    p(s["cell"], "Excel serial dates (e.g. 43388) convert automatically."),
                ],
                [
                    p(s["cellb"], "amt_received"),
                    p(s["cell"], "Amount received"),
                    p(s["cell"], "Receipts doc"),
                    p(s["cell"], "Map for cash_book_receipts."),
                ],
                [
                    p(s["cellb"], "amt_paid"),
                    p(s["cell"], "Amount paid"),
                    p(s["cell"], "Payments doc"),
                    p(s["cell"], "Map for cash_book_payments."),
                ],
                [
                    p(s["cellb"], "name / details"),
                    p(s["cell"], "Name / Details"),
                    p(s["cell"], "Optional"),
                    p(s["cell"], "Improves matching and BRS narrative."),
                ],
                [
                    p(s["cellb"], "chq_no"),
                    p(s["cell"], "Cheque no."),
                    p(s["cell"], "Optional"),
                    p(s["cell"], "Strongly recommended for cheque matching."),
                ],
                [
                    p(s["cellb"], "doc_ref / accode"),
                    p(s["cell"], "Doc ref / Account code"),
                    p(s["cell"], "Optional"),
                    p(s["cell"], "Reference and chart-of-accounts code."),
                ],
            ],
            [28 * mm, 32 * mm, 24 * mm, 90 * mm],
        )
    )
    story.append(p(s["h3"], "7.2 Bank statement"))
    story.append(
        table(
            [
                [p(s["head"], "Field"), p(s["head"], "App label"), p(s["head"], "Required?"), p(s["head"], "Notes")],
                [
                    p(s["cellb"], "transaction_date"),
                    p(s["cell"], "Transaction date"),
                    p(s["cell"], "Yes"),
                    p(s["cell"], ""),
                ],
                [
                    p(s["cellb"], "credit"),
                    p(s["cell"], "Credit"),
                    p(s["cell"], "Credits doc"),
                    p(s["cell"], "Map for bank_credits."),
                ],
                [
                    p(s["cellb"], "debit"),
                    p(s["cell"], "Debit"),
                    p(s["cell"], "Debits doc"),
                    p(s["cell"], "Map for bank_debits."),
                ],
                [
                    p(s["cellb"], "description"),
                    p(s["cell"], "Description"),
                    p(s["cell"], "Recommended"),
                    p(s["cell"], "Cheque numbers can be read from narrative text."),
                ],
            ],
            [28 * mm, 32 * mm, 24 * mm, 90 * mm],
        )
    )
    story.append(p(s["h3"], "7.3 Signed amount mode (one amount column)"))
    story.append(
        p(
            s["body"],
            "If one column holds both sides (positive = receipt/credit, negative = payment/debit), map the <b>same column</b> "
            "to both amount fields. The app shows a Signed amount mode notice and splits rows by sign.",
        )
    )

    story.append(p(s["h"], "8. Saved layouts and Forget layout"))
    story.append(
        p(
            s["body"],
            "After you apply a mapping, your organisation can <b>remember</b> that column layout (by header names). "
            "The next similar upload shows a <b>Saved layout applied</b> banner and pre-fills fields.",
        )
    )
    story.append(
        bullets(
            s["bullet"],
            [
                "<b>Forget layout</b> deletes that saved memory for future uploads. It does <b>not</b> unmap the current file or delete transactions.",
                "Map again and apply to save a new layout.",
                "Use Forget layout when the remembered columns are wrong for this export type going forward.",
            ],
        )
    )

    story.append(p(s["h"], "9. Decision guide — auto or manual?"))
    story.append(
        table(
            [
                [p(s["head"], "Your file"), p(s["head"], "Start with"), p(s["head"], "Then")],
                [
                    p(s["cell"], "Bank statement (one sheet)"),
                    p(s["cellb"], "Bulk apply"),
                    p(s["cell"], "Proceed if row count looks right."),
                ],
                [
                    p(s["cell"], "Cash book (one sheet, clear headers)"),
                    p(s["cellb"], "Bulk apply"),
                    p(s["cell"], "Proceed if row count looks right."),
                ],
                [
                    p(s["cell"], "Multi-sheet ERP / TGL / IBIS export"),
                    p(s["cellb"], "Bulk apply"),
                    p(s["cell"], "Open each cash book doc; confirm Worksheet; re-apply if needed."),
                ],
                [
                    p(s["cell"], "GT Bank EUR + manual BRS target"),
                    p(s["cellb"], "Bulk apply + manual check"),
                    p(s["cell"], "Sheet2, FC amounts, closing balances on Report, no spurious Reconcile matches."),
                ],
                [
                    p(s["cell"], "Scanned PDF / poor OCR quality"),
                    p(s["cellb"], "Manual review"),
                    p(s["cell"], "Prefer Excel export; verify every column in preview."),
                ],
            ],
            [48 * mm, 38 * mm, 88 * mm],
        )
    )

    story.append(p(s["h"], "10. Checklist before Proceed to Reconcile"))
    story.append(
        bullets(
            s["bullet"],
            [
                "Every uploaded document shows a transaction count (not zero).",
                "Cash book receipts + payments row counts match your source extract.",
                "Bank credits + debits match the statement.",
                "Correct Excel worksheet selected for multi-tab files.",
                "No Fix required messages on critical fields (Date, Amount).",
                "On Report (optional early check): enter bank and cash book closing balances if your BRS uses declared figures.",
                "Tie-out variance on Report is ≈ 0 (or you understand remaining exceptions).",
            ],
        )
    )

    story.append(p(s["h"], "11. Quick reference"))
    story.append(
        table(
            [
                [p(s["head"], "Action"), p(s["head"], "Where"), p(s["head"], "Button / control")],
                [
                    p(s["cell"], "Map all ticked files at once"),
                    p(s["cell"], "Map tab"),
                    p(s["cellb"], "Apply suggested mapping to selected"),
                ],
                [
                    p(s["cell"], "Map or fix one file"),
                    p(s["cell"], "Map tab"),
                    p(s["cellb"], "Select a document → Apply mapping"),
                ],
                [
                    p(s["cell"], "Change Excel tab"),
                    p(s["cell"], "Map tab → document open"),
                    p(s["cellb"], "Worksheet (Excel) dropdown"),
                ],
                [
                    p(s["cell"], "Remove saved column memory"),
                    p(s["cell"], "Map tab → preview banner"),
                    p(s["cellb"], "Forget layout"),
                ],
                [
                    p(s["cell"], "Continue workflow"),
                    p(s["cell"], "Map tab"),
                    p(s["cellb"], "Proceed to Reconcile"),
                ],
            ],
            [52 * mm, 40 * mm, 82 * mm],
        )
    )

    story.append(Spacer(1, 6 * mm))
    story.append(
        p(
            s["subtitle"],
            "KQ SOFT SOLUTIONS  ·  Bank Reconciliation System  ·  "
            "In-app help: Map tab → How bulk apply picks sheets  ·  Full manual: docs/MAPPING_AND_MATCHING_MANUAL.md",
        )
    )
    return story


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=18 * mm,
        title="Column mapping — auto-suggested and manual",
        author="KQ SOFT SOLUTIONS",
    )
    doc.build(build_story(), onFirstPage=header_footer, onLaterPages=header_footer)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
