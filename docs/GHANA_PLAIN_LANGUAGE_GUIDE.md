# Ghana-facing plain language — platform, workspace & tutorials

**Purpose:** Keep user-facing copy clear for Ghanaian preparers, checkers, and small-business teams, without SaaS or engineering jargon. Aligns with [GRA small-taxpayer guidance](https://gra.gov.gh/small-taxpayer-office/) (“maintaining good records”), Ghana SHS accounting terms ([curriculum bank reconciliation module](https://curriculumresources.edu.gh/)), and common bank SME glossaries (e.g. [Zenith Bank Ghana SME lounge](https://www.zenithbank.com.gh/sme-lounge/resources/glossary-of-terms/)).

**Implementation:** Shared labels live in `web/src/lib/userFacingTerms.ts`. In-app help: `web/src/components/BrsHelp.tsx`. Tutorials: `web/public/user-manual.md`, `web/public/mapping-and-matching-manual.md`.

---

## Principles

1. **Prefer terms accountants already use in Ghana** — *cash book*, *bank statement*, *uncredited lodgments*, *unpresented cheques*, *Prepared By / Checked By / Approved By* on the BRS.
2. **Explain once, then use the short label** — e.g. “Checker (approves the BRS)” then “Checker” in menus.
3. **Avoid SaaS jargon** in customer UI — replace *workspace* with **organisation**; avoid *slug*, *paywall*, *tenant*, *canonical*, *assistants* in end-user text.
4. **Keep technical file formats** where needed for support, but lead with plain words — “Excel, CSV, PDF, or photo of a statement” before OFX/MT940/CAMT in subtitles.
5. **Do not rename API roles or report line items** — backend still uses `preparer` / `reviewer`; reports keep **Uncredited lodgments** / **Unpresented cheques** per `docs/GHANA_BRS_LAYOUT.md`.

---

## Glossary — prefer this in UI & manuals

| Avoid (jargon) | Prefer (Ghana-facing) | Notes |
|----------------|----------------------|--------|
| Workspace | **Organisation** | One subscribed company / firm account. |
| Tenant | **Organisation** or **customer account** | Platform-admin docs only. |
| URL slug | **Link name** or **web address name** | Admin-only; never in preparer flows. |
| Preparer / Reviewer (bare) | **Preparer** / **Checker** | Checker matches BRS “Checked By”. |
| Variance (unmatched) | **Difference in unmatched totals** | Not the same as BRS tie-out variance. |
| CB > Bank | **Cash book total higher than bank** | Spell out on Review. |
| Count-match / Open — more / Only list | **Same amount, extra lines on one side** / **Left on one side only** | See mapping manual §10. |
| Matching assistants | **Matching helpers** | Suggested matches, split match, count matching. |
| ⌘K AI label | **Navigator** | Not “assistant” in customer UI. |
| Paywall | **Subscription inactive** / **Plan expired** | Already in layout banner copy. |
| Impersonation | **Support mode** | Admin viewing a customer organisation. |
| Org-wide | **Across your organisation** | Bank seats, limits. |
| Connections / webhook | **Bank import** / **Alerts email** | Settings; describe outcome not integration jargon. |
| Canonical fields | **Standard column names** | Manuals only. |
| BRS (first mention) | **Bank Reconciliation Statement (BRS)** | Then “BRS” alone is fine. |
| Lodgment | **Uncredited lodgment** (receipt not yet on statement) | Ghana Add line wording. |
| Debit / credit (bank) | **Money out** / **Money in** (bank side) | Keep debit/credit in tables where accountants expect them. |
| EFT | **Electronic transfer** | Optional expansion in help. |
| GRA / TIN | Keep **GRA**, **TIN** | Official Ghana terms; link to gra.gov.gh in marketing/legal. |

---

**Status: final sweep complete (Nov 2026, release-ready).** Run before each release:

```bash
cd web && rg -n 'workspace|Workspace|Enter workspace|Reviewer|reviewers|worldwide|Connections|Open —|Only CB|count-match|URL slug|Assistant' src --glob '*.tsx' | rg -v 'paywallBlocked|variant=.workspace|queryKey|import |/marketing-|handleEnter|tenantsActive|editReviewer|reviewerComment|workspacePlan|workspaceMobile|workspaceLayout|workspaceAgent|SettingsConnections|role === .reviewer|value="reviewer"|ROLES ='
```

Expect only code identifiers, API fields, and comments — not user-visible strings.

## Surfaces reviewed

| Surface | Status |
|---------|--------|
| Sidebar, org switcher, register/login | **Done** — organisation wording |
| Command palette (⌘K) | **Done** — organisation search; Bank import; **Navigator** (not Assistant) |
| Settings → Members, Billing, About | **Done** — roles, plan toasts, organisation label |
| Settings → Bank import (was Connections) | **Done** — tab label + manual |
| Reconcile help (`BrsHelp`) | **Done** |
| Reconcile / Review | **Done** — matching helpers; unmatched totals |
| Marketing (`Landing.tsx`) + `plans.ts` feature copy | **Done** |
| Terms & Privacy | **Done** |
| Platform admin (support mode, customers, plans) | **Done** — no “enter workspace” / “tenant” in UI |
| User manual & mapping guide | **Done** — synced to `USER_MANUAL.md` |
| PWA offline + subscription renewal panel | **Done** |
| Geo / marketplace | **Ghana primary** — GHS Paystack, Ghana bank parsers, `importLocale` on org; landing FX reference (USD/EUR/GBP) is indicative only. No multi-region plan store in DB yet. |

---

## Ghana curriculum & industry alignment (references)

| Concept | Ghana-facing phrase | Source |
|---------|---------------------|--------|
| Bank reconciliation | Compare **cash book (bank column)** with **bank statement** and explain differences | SHS Accounting LM; SSIP learner guide |
| Uncredited items | Receipts/deposits in cash book **not yet credited** by bank | BRS Add line; SHS “lodgments” |
| Unpresented cheques | Payments in cash book **not yet shown** on statement | BRS Less line |
| Bank charges | **Service charges** on statement | SSIP, Zenith glossary |
| Good records | **Maintaining good records** for GRA | GRA Small Taxpayer Office |
| Tax return | **Return** (official report to GRA) | GRA tax terminologies |

---

## What stays technical (on purpose)

- **Report and Excel/PDF line labels** — Ghana BRS layout (`docs/GHANA_BRS_LAYOUT.md`).
- **Internal code** — `workspace` routes/API keys, `count-match` queries, role slugs `preparer` / `reviewer`.

## Optional later (not blocking)

- **Report section titles** — “Reconciliation Discrepancy Report” keeps “variance” in export headers where auditors expect it; in-app blurbs can say “differences”.
- **API / developer docs** — keep technical terms (`workspace` in REST paths if any).

---

## Maintenance

When adding UI copy:

1. Check this glossary and `userFacingTerms.ts`.
2. Add new BRS concepts to `BrsHelp.tsx` and manual §Glossary.
3. Run a quick grep for `workspace`, `slug`, `paywall`, `assistant`, `variance` in `web/src` user strings before release.

Related: `docs/FLOW_FORMULAS_TERMINOLOGY_REVIEW.md` (formulas), `docs/GHANA_BRS_LAYOUT.md` (report labels).
