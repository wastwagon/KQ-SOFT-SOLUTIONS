#!/usr/bin/env python3
"""Client-facing PDF: attached BRS technique vs current product."""

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    KeepTogether,
    ListFlowable,
    ListItem,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

OUT = "/Users/OceanCyber/Downloads/KQ-SOFT-BRS-Reconcile-by-Count-Review.pdf"

GREEN = colors.HexColor("#0F3D2E")
GOLD = colors.HexColor("#C4A35A")
INK = colors.HexColor("#1A1A1A")
MUTED = colors.HexColor("#5C6570")
RULE = colors.HexColor("#D7DDE3")
ROW = colors.HexColor("#F4F7F5")
OK_BG = colors.HexColor("#E8F3EC")
GAP_BG = colors.HexColor("#FFF6E8")
NOTE_BG = colors.HexColor("#F7F4EC")


def styles():
    base = getSampleStyleSheet()
    s = {
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
            fontSize=18,
            leading=22,
            textColor=GREEN,
            alignment=TA_LEFT,
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
        "footer": ParagraphStyle(
            "footer",
            parent=base["Normal"],
            fontName="Times-Italic",
            fontSize=8,
            textColor=MUTED,
            alignment=TA_CENTER,
        ),
    }
    return s


def p(style, text):
    return Paragraph(text, style)


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
    canvas.drawString(18 * mm, 5 * mm, "Internal review for the client  ·  1 September 2026")
    canvas.drawRightString(w - 18 * mm, 5 * mm, f"Page {doc.page}")
    canvas.restoreState()


def main():
    s = styles()
    doc = SimpleDocTemplate(
        OUT,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=18 * mm,
        title="BRS reconcile-by-count — technique vs current product",
        author="KQ SOFT SOLUTIONS",
    )
    story = []
    story.append(p(s["kicker"], "PRODUCT REVIEW  ·  FOR THE CLIENT"))
    story.append(p(s["title"], "Reconcile by counting — your technique compared with the software today"))
    story.append(
        p(
            s["subtitle"],
            "KQ Bank Reconciliation System  ·  Prepared 1 September 2026  ·  No product changes in this note — review only.",
        )
    )
    story.append(
        p(
            s["body"],
            "Thank you for the six-step note on how BRS software should reconcile. "
            "This letter sets that method beside what the system already does, in plain language, "
            "so we can agree what is already in place and what is only a working method (not yet a guided screen).",
        )
    )

    story.append(p(s["h"], "1. What your note asks for"))
    story.append(
        p(
            s["body"],
            "Your note is a <b>working method for reconciling by count</b>, not a new overall product. "
            "The outer path is: Clean (if needed) → Upload cash book, bank statement and previous BRS → Map → Reconcile → Review → Report.",
        )
    )
    story.append(
        p(
            s["body"],
            "Inside Reconcile you want this order:",
        )
    )
    story.append(
        ListFlowable(
            [
                ListItem(
                    p(
                        s["bullet"],
                        "<b>Step 1 (a)</b> — Check and clear the <b>cancel-out</b> list using bulk match or one-to-one match.",
                    )
                ),
                ListItem(
                    p(
                        s["bullet"],
                        "<b>Step 1 (b)</b> — Check and clear the <b>open</b> lists the same way.",
                    )
                ),
                ListItem(
                    p(
                        s["bullet"],
                        "<b>Step 2</b> — Check the <b>only</b> lists using bulk match or auto-suggestions.",
                    )
                ),
            ],
            bulletType="bullet",
            leftIndent=12,
            bulletFontName="Times-Roman",
            bulletFontSize=10,
        )
    )
    story.append(Spacer(1, 2 * mm))
    note_inner = [
        [
            p(
                s["callout"],
                "<b>Your note:</b> after the open lists are cleared, anything still left there must "
                "<b>automatically move into the only list</b> before Step 2 is done.",
            )
        ]
    ]
    nt = Table(note_inner, colWidths=[174 * mm])
    nt.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), NOTE_BG),
                ("BOX", (0, 0), (-1, -1), 0.6, GOLD),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    story.append(nt)

    story.append(p(s["h"], "2. The six outer steps versus the software"))
    story.append(
        p(
            s["body"],
            "The project bar in the software is <b>Upload → Map → Reconcile → Review → Report</b>. "
            "Clean and previous BRS exist, but they are not numbered as steps 1 and 2 on that bar.",
        )
    )
    tw = [38 * mm, 48 * mm, 88 * mm]
    story.append(
        table(
            [
                [p(s["head"], "Your step"), p(s["head"], "In the software today?"), p(s["head"], "How it appears")],
                [
                    p(s["cellb"], "1. Clean CB and BS, if required"),
                    p(s["cell"], "Yes — optional tool"),
                    p(
                        s["cell"],
                        "Clean cash book and Clean bank statement are under <b>Tools</b>. They are not a required project step.",
                    ),
                ],
                [
                    p(s["cellb"], "2. Upload CB and BS (and previous BRS)"),
                    p(s["cell"], "Yes — with a difference"),
                    p(
                        s["cell"],
                        "Upload cash book and bank statement: yes. Previous BRS is <b>roll-forward</b> from a completed project (Premium), not “upload last month’s BRS PDF” on Upload.",
                    ),
                ],
                [
                    p(s["cellb"], "3. Map"),
                    p(s["cell"], "Yes"),
                    p(
                        s["cell"],
                        "Map columns (Date, Amount, Description, and so on). The system can remember a layout. <b>Forget layout</b> only stops that saved map being suggested next time; it does not unmap the current file.",
                    ),
                ],
                [
                    p(s["cellb"], "4. Reconcile"),
                    p(s["cell"], "Yes"),
                    p(
                        s["cell"],
                        "Match by counting lists, plus suggested matches, one-to-one, bulk match, and auto-match.",
                    ),
                ],
                [
                    p(s["cellb"], "5. Review"),
                    p(s["cell"], "Yes"),
                    p(s["cell"], "Review matches, unmatched items, and variance before the report."),
                ],
                [
                    p(s["cellb"], "6. Report"),
                    p(s["cell"], "Yes"),
                    p(s["cell"], "Bank Reconciliation Statement (Excel and PDF)."),
                ],
            ],
            tw,
        )
    )

    story.append(p(s["h"], "3. Names of the count lists"))
    story.append(
        p(
            s["body"],
            "The lists you named are already on Reconcile under <b>Match by counting</b>. "
            "The labels differ slightly. There is no separate “open-less” list because more on one side is the same as less on the other; each amount is shown once, with cash-book count, bank count, and the difference.",
        )
    )
    story.append(
        table(
            [
                [p(s["head"], "Your name"), p(s["head"], "Name in the software"), p(s["head"], "Meaning")],
                [
                    p(s["cellb"], "Cancel out"),
                    p(s["cell"], "Cancel — receipts = credits<br/>Cancel — payments = debits"),
                    p(s["cell"], "Same amount, same number of lines on both sides."),
                ],
                [
                    p(s["cellb"], "Open"),
                    p(s["cell"], "Open — more receipts in CB<br/>Open — more credits in bank<br/>Open — more payments in CB<br/>Open — more debits in bank"),
                    p(s["cell"], "Amount appears on both sides, but the counts are not equal."),
                ],
                [
                    p(s["cellb"], "Open-less"),
                    p(s["cell"], "Not a separate list"),
                    p(
                        s["cell"],
                        "Same rows as “open — more” on the other side. CB count, Bank count and Diff already show both sides.",
                    ),
                ],
                [
                    p(s["cellb"], "Only"),
                    p(s["cell"], "Only CB — Received / Payment<br/>Only bank — Lodgment / Debits"),
                    p(s["cell"], "Amount appears on one side only."),
                ],
            ],
            tw,
        )
    )

    story.append(p(s["h"], "4. How “clear the list” works today"))
    story.append(
        p(
            s["body"],
            "Your note says check and <b>clear</b> using bulk match or one-to-one. "
            "In the software, Match by counting is a <b>diagnostic schedule</b>. It does not confirm matches by itself. "
            "That is deliberate: a count of the same amount is not enough to clear without a human confirm (and, where needed, date, cheque, reference or narration).",
        )
    )
    story.append(
        p(
            s["body"],
            "What you can do today:",
        )
    )
    story.append(
        ListFlowable(
            [
                ListItem(
                    p(
                        s["bullet"],
                        "Open a list (Cancel, Open, or Only). Use <b>Select lines</b> on an amount (up to 50 lines per side).",
                    )
                ),
                ListItem(
                    p(
                        s["bullet"],
                        "Confirm with <b>one-to-one</b>, or many-to-many where the two sides <b>sum to the same total</b> (Premium).",
                    )
                ),
                ListItem(
                    p(
                        s["bullet"],
                        "Or use <b>Suggested matches</b>, <b>Bulk match</b> (ticked suggestions), or <b>Auto-match</b>. Bulk match works on suggestions, not as a “clear this whole count list” button.",
                    )
                ),
                ListItem(
                    p(
                        s["bullet"],
                        "Keep the count scope on <b>Unmatched</b>. After lines are matched, the lists rebuild and those lines drop out.",
                    )
                ),
            ],
            bulletType="bullet",
            leftIndent=12,
        )
    )
    story.append(Spacer(1, 2 * mm))
    story.append(
        p(
            s["body"],
            "The software does <b>not</b> force the order Cancel → Open → Only. All three sets of lists sit on one panel; you may open them in any order. Your method can already be followed by hand.",
        )
    )

    story.append(p(s["h"], "5. Your note on leftovers moving to Only"))
    story.append(
        p(
            s["body"],
            "Example: amount <b>GHS 100</b> appears <b>five</b> times in the cash book and <b>three</b> times on the bank. "
            "That row sits on <b>Open — more in cash book</b> (cash book 5, bank 3, difference +2).",
        )
    )
    story.append(
        p(
            s["body"],
            "Your method: match the three that cancel, then the leftover <b>two cash-book lines must appear on Only CB</b> before you work the Only lists.",
        )
    )
    story.append(
        p(
            s["body"],
            "<b>What happens today if you match three against three</b> and leave scope on Unmatched: the remaining two cash-book lines <b>do</b> show on Only CB, because the bank count for that amount is then zero. That part of the note already occurs as a result of unmatched counting — it is not a separate “move remaining to Only” button.",
        )
    )
    story.append(
        p(
            s["body"],
            "<b>What does not yet match the note:</b> <b>Select lines</b> on that open row currently selects <b>all five cash-book lines and all three bank lines</b>. Confirming that as one many-to-many match will not succeed (500 is not equal to 300). So an open row cannot be cleared in one click. The overlapping three must be matched first (one-to-one, or three-against-three many-to-many). After that, the leftover two appear on Only.",
        )
    )
    story.append(
        p(
            s["body"],
            "If <b>All lines</b> is left on instead of Unmatched, leftover counts stay mixed with lines that are already matched.",
        )
    )

    story.append(p(s["h"], "6. Side-by-side: already in place vs not encoded on screen"))
    ok = colors.HexColor("#1F6B45")
    story.append(
        table(
            [
                [p(s["head"], "Item"), p(s["head"], "Status")],
                [
                    p(s["cellb"], "Overall path: files in → map → match → review → report"),
                    p(s["cell"], "In place"),
                ],
                [
                    p(s["cellb"], "Count lists: cancel / open / only"),
                    p(s["cell"], "In place (names differ slightly)"),
                ],
                [
                    p(s["cellb"], "Open-more only (no duplicate open-less list)"),
                    p(s["cell"], "In place — by design"),
                ],
                [
                    p(s["cellb"], "After overlapping open items are matched, leftovers can land on Only"),
                    p(s["cell"], "In place, if scope is Unmatched"),
                ],
                [
                    p(s["cellb"], "One-to-one, bulk (suggestions), and auto-suggestions to actually clear"),
                    p(s["cell"], "In place"),
                ],
                [
                    p(s["cellb"], "Forget layout on Map"),
                    p(s["cell"], "In place — forgets saved column memory only"),
                ],
                [
                    p(s["cellb"], "Clean as step 1 of every project"),
                    p(s["cell"], "Not on the project bar — optional Tools"),
                ],
                [
                    p(s["cellb"], "Previous BRS as a file on Upload"),
                    p(s["cell"], "Not that way — roll-forward from a completed project"),
                ],
                [
                    p(s["cellb"], "Forced on-screen order: cancel, then open, then only"),
                    p(s["cell"], "Not encoded — you can still follow this by hand"),
                ],
                [
                    p(s["cellb"], "One action to clear a whole cancel or open list"),
                    p(s["cell"], "Not in place"),
                ],
                [
                    p(s["cellb"], "Select lines on Open picking only the overlapping count"),
                    p(s["cell"], "Not in place — it currently selects the full surplus row"),
                ],
                [
                    p(s["cellb"], "On-screen wording that leftovers automatically join Only after Open is cleared"),
                    p(s["cell"], "Not spelled out as a guided step"),
                ],
            ],
            [118 * mm, 56 * mm],
        )
    )

    story.append(p(s["h"], "7. Short answers to the two mapping / counting questions"))
    story.append(
        p(
            s["body"],
            "<b>What is Forget layout?</b> When you map a file, the organisation can remember that column layout. "
            "The next similar upload can be pre-filled. Forget layout deletes that memory so it is not suggested for later similar files. "
            "It does not delete the current file or unmap what you have already applied.",
        )
    )
    story.append(
        p(
            s["body"],
            "<b>Why Open-more and not Open-less?</b> For any amount on both sides with unequal counts, one side has more and the other has less. "
            "Listing both would duplicate every open amount. The software lists each amount once under Open-more on the side that has the surplus, and shows both counts on the row.",
        )
    )

    story.append(p(s["h"], "8. Where this leaves us"))
    story.append(
        p(
            s["body"],
            "Your technique and the software already share the same destination: use counting as a work order (cancel, then open, then only), "
            "and confirm real matches with one-to-one, bulk, or suggestions — counting itself never auto-clears.",
        )
    )
    story.append(
        p(
            s["body"],
            "The gap is not missing lists. It is that the software does not yet <b>walk the preparer through that order</b>, "
            "and Select lines on an Open row does not yet pick only the overlapping (cancellable) lines so leftovers fall into Only in one pass.",
        )
    )
    story.append(
        p(
            s["body"],
            "This note does not change the product. If you wish, the next discussion can be whether to add a guided cancel → open → only sequence, "
            "and an “select overlapping only” action on Open lists.",
        )
    )
    story.append(Spacer(1, 6 * mm))
    story.append(p(s["subtitle"], "KQ SOFT SOLUTIONS  ·  Bank Reconciliation System  ·  Review only — 1 September 2026"))

    doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
    print(OUT)


if __name__ == "__main__":
    main()
