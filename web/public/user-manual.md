# KQ BRS Platform User Manual

**Product:** KQ Bank Reconciliation System (BRS)  
**Company:** KQ SOFT SOLUTIONS  
**Audience:** End users and operations teams  
**Updated:** July 26, 2026

> Welcome to KQ BRS. This manual is your official guide for onboarding, day-to-day reconciliation, approvals, reporting, billing, and support.  
> Share this page with all new users during kickoff and role assignment.

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-07-26 | 1.4 | Jul 2026 pricing (Basic/Standard/Premium/Custom), quarterly billing, org-wide bank seats, intro offer (first 2 months), clean document tools, Connections, Prudential and expanded bank list, dashboard usage meters. |
| 2026-06-22 | 1.3 | Added dedicated [Mapping & Matching guide](/mapping-and-matching-manual.md) with field reference, matching settings, troubleshooting, and training checklist. |
| 2026-05-11 | 1.2 | FAQ on subscription (GHS) vs project reporting currency; Settings → Billing; New project currency hint; manual cross-references. |
| 2026-05-07 | 1.1 | Added dedicated in-app online manual page (`/manual`), dashboard help shortcut, and live update process. |
| 2026-05-01 | 1.0 | Initial commercial user manual release. |

---

## Before You Start (Onboarding Checklist)

Use this checklist when onboarding a new customer team:

- [ ] Platform URL shared with all users
- [ ] Admin account created and tested
- [ ] Team roles assigned (`admin`, `reviewer`, `preparer`, `viewer`)
- [ ] First reconciliation period confirmed
- [ ] Sample cash book and bank statement files validated
- [ ] Branding configured (logo/colors/report title) if required
- [ ] Billing/plan confirmed (trial or paid; see [Subscription Plans](#12-subscription-plans--limits))
- [ ] Bank account seats understood (counted **org-wide**, not per project)

---

## 1) Overview

KQ BRS helps teams reconcile cash book entries with bank statements and generate professional Bank Reconciliation Statements.

Core capabilities:
- Upload cash book and bank files (Excel, CSV, PDF, image formats)
- Map columns once and extract transactions
- Reconcile receipts vs credits and payments vs debits
- Review exceptions and complete sign-off
- Export final reports in PDF and Excel
- Optional **Clean bank statement** / **Clean cash book** tools (preview free; sample downloads watermarked; full Excel/PDF on plan quota)

---

## 2) Navigation

- **Dashboard**: projects, usage meters (projects / transactions / **bank account seats**), quick actions
- **Projects**: create and manage reconciliation jobs
- **Clean bank statement** / **Clean cash book**: validate parsers → sample (watermarked) or full export (plan quota)
- **Reports**: completed jobs and exports
- **Clients**: client directory
- **Audit log**: activity records (Standard+)
- **Settings**: branding, billing, members, connections, API keys, bank rules (plan-based)
- **User manual**: this documentation page

---

## Platform Walkthrough (Screenshots)

Add your screenshots under `web/public/manual-images/` to make training easier.

Recommended screenshots:
1. Dashboard home (including bank seats meter)
2. New project form
3. Upload step (multi-bank selector)
4. Mapping step
5. Reconcile screen (both views)
6. Review exceptions
7. Final report/export page
8. Settings → Billing (monthly / quarterly / yearly)

Template:
- `![Dashboard](./manual-images/dashboard.png)`
- `![Reconcile](./manual-images/reconcile.png)`

---

## 3) Standard Workflow

Each project follows:

1. **Upload**
2. **Map**
3. **Reconcile**
4. **Review**
5. **Report**

---

## Quick Start by Role

### Admin (first day)
1. Open `Settings -> Members` and invite team
2. Assign roles for maker-checker flow
3. Configure branding and billing
4. Review plan limits (projects, transactions, **org-wide bank accounts**) with your team
5. Optionally configure **Connections** (import path / bank-feed waitlist)

### Preparer (daily operations)
1. Create project
2. Upload files (assign bank account when multi-bank)
3. Map columns
4. Reconcile and resolve major exceptions
5. Submit for review

### Reviewer (approval)
1. Open Review step
2. Validate unmatched items and variance
3. Approve or reopen with comments
4. Confirm final export package

---

## 4) Create a Project

Go to **Projects → New project**, then set:
- project name
- client (optional)
- reconciliation date
- currency (`GHS`, `USD`, `EUR`) — this is the **project reporting currency** for the BRS and workbook amounts
- optional roll-forward source (Premium+)

**Billing vs project currency:** Organisation subscriptions are charged in **GHS** via Paystack. Project currency is independent and can be **GHS**, **USD**, or **EUR** per reconciliation job.

---

## 5) Upload Step

### Cash Book
- Upload as `Receipts`, `Payments`, or `Both`

### Bank Statement
- Upload as `Credits`, `Debits`, or `Both`
- For multiple accounts, add or select a **bank account** name (counts toward your org-wide seat limit)

Supported formats:
- `.xlsx`, `.xls`, `.csv`, `.pdf`, `.png`, `.jpg`, `.jpeg`, `.tiff`

### Clean document tools
From the dashboard or sidebar (no project required to preview):
- **Clean bank statement** — upload a statement, parse with the same engine, preview rows
- **Clean cash book** — same for cash book files
- **Sample Excel/PDF** — truncated and watermarked (`BRS DEMO — NOT FOR OPERATIONAL USE`)
- **Full Excel/PDF** — complete extract; counts against your plan’s monthly clean-export quota

Useful for validating a bank format before starting a full reconciliation.

---

## 6) Map Step

Map source columns to canonical fields.

Common fields include:
- Cash book: `date`, `name`, `details`, `doc_ref`, `chq_no`, `amt_received`, `amt_paid`
- Bank: `transaction_date`, `description`, `credit`, `debit`

Tips:
- Always map date columns
- Use **Apply suggested mapping to selected** for speed (tick which files to include)
- After you apply a mapping, similar files can reuse that column map. **Forget layout** on the Map banner stops suggesting it for future uploads; it does not unmap the current file.

**Detailed guide:** [Mapping & Matching Transactions](/mapping-and-matching-manual.md) — field reference, signed amount mode, Ghana bank tips, matching settings, troubleshooting, and a training checklist.

---

## 7) Reconcile Step

Work in:
- **Receipts vs Credits**
- **Payments vs Debits**
- **Cash book (all)** for overview (switch to Receipts or Payments to match)

Matching modes:
- 1:1 (all plans)
- 1:many / many:1 / many:many (Premium+)

Matching settings presets:
- **Strict** — amount + date + reference + cheque
- **Amount + Date**
- **Amount only** (review carefully)

Available actions:
- manual matching (select rows → **Confirm Match**)
- suggested matching (Standard+)
- bulk matching and auto-match (Standard+)
- split suggestions for bulk deposits (Premium+)
- unmatch
- bank account filtering
- **Match by counting** (diagnostic): recommended order **Cancel → Open (select overlap) → Only**. There is no Open — less list — more on one side is less on the other. After Open overlap is matched, leftovers appear on Only (Unmatched scope).

See [Mapping & Matching Transactions](/mapping-and-matching-manual.md) for the full walkthrough.

---

## 8) Review Step

Review page shows:
- matched totals
- unmatched cash book items
- unmatched bank items
- variance indicator

Use it to validate exceptions before final report generation.

---

## 9) Report Step

Generate formal BRS output with:
- statement summary
- uncredited lodgments
- unpresented cheques
- discrepancy and missing-cheque reports (plan-based)
- supporting attachments

Actions:
- export Excel
- export PDF
- print
- submit for review
- approve/reopen (role-based)
- roll-forward (Premium+)

---

## 10) Settings

### Branding (Admin)
Logo, primary/secondary colours, letterhead, report title, footer. Full branding on PDF/Excel is Standard+.

### Billing (Admin)
- Current plan and subscription status (trial / active / expired)
- Usage: projects and transactions this month
- **Upgrade / renew** via Paystack: **monthly**, **quarterly** (~5% off), or **yearly** (~17% off)
- **Intro offer** (when enabled by platform): 50% off your first **2 billing periods**
- Workspace billing is always **GHS**; project reporting currency is separate

### Members (Admin)
Invite by email; assign Admin / Reviewer / Preparer / Viewer. Seat limits follow the plan.

### Connections
Configure how statements arrive (manual upload path today; bank-feed waitlist where offered).

### Bank Rules (Admin/Reviewer, Standard+)
Conditions on description/amount/date → suggest match or flag for review.

### API Keys (Custom / firm, Admin)
Create and revoke keys for programmatic access.

---

## 11) Roles

- **Admin**: full control (billing, members, branding, delete project)
- **Reviewer**: review and approval flows; bank rules
- **Preparer**: upload / map / reconcile / report preparation
- **Viewer**: read-only access

| Action | Admin | Reviewer | Preparer | Viewer |
|--------|-------|----------|----------|--------|
| Delete project | ✓ | | | |
| Reopen project | ✓ | ✓ | | |
| Edit bank rules | ✓ | ✓ | | |
| Edit branding / billing / members | ✓ | | | |
| Export report | ✓ | ✓ | ✓ | |
| Create project / upload / map / reconcile | ✓ | ✓ | ✓ | |
| Submit for review | ✓ | ✓ | ✓ | |
| Approve | ✓ | ✓ | | |

---

## 12) Subscription Plans & Limits

| Plan | Projects/mo | Transactions/mo | Bank accounts (org-wide) | Users |
|------|-------------|-----------------|--------------------------|-------|
| Basic | 10 | 1,000 | 5 | 1 |
| Standard | 30 | 5,000 | 10 | 3 |
| Premium | 100 | 20,000 | 30 | 5 |
| Custom (firm) | Unlimited | Unlimited | Unlimited | Unlimited |

| Plan | Monthly (GH₵) | Quarterly (GH₵) | Yearly (GH₵) |
|------|---------------|-----------------|--------------|
| Basic | 300 | 855 | 3,000 |
| Standard | 900 | 2,565 | 9,000 |
| Premium | 1,500 | 4,275 | 15,000 |
| Custom | Contract | — | — |

- **Trial:** 14 days on signup; renew via Paystack when the paywall is enabled.
- **Basic** includes bookkeeping consultancy / advisory messaging.
- **Bank account seats** are counted across the **whole organisation** (all projects), not per project.
- **Intro offer:** 50% off the first 2 billing periods when enabled (`INTRO_OFFER_ENABLED` on the server).
- **Billing periods:** monthly, quarterly (~5% off), yearly (~17% off vs paying monthly).

### Feature gating (summary)

| Capability | From |
|------------|------|
| 1:1 match, BRS export, OCR | Basic+ |
| Clean tools preview + sample (watermarked) download | Basic+ |
| Full clean Excel/PDF export | Basic+ with monthly quota (Basic 5 / Standard 20 / Premium 60 / Custom unlimited) |
| Suggested matches, bulk / auto-match, AI ranking | All tiers |
| Match by counting (diagnostic lists / cancel schedule; never auto-clears) | All tiers |
| Bank rules, audit, discrepancy | Standard+ |
| 1:many / many:many, roll-forward, threshold approval, priority support | Premium+ |
| Multi-client workspace, public API, custom contract | Custom |

---

## 13) Supported Banks

Pre-built / auto-detected layouts (examples; generic Excel, CSV, and PDF always work):

| Bank | Notes |
|------|--------|
| Ecobank | Headers + description content |
| GCB | Value Date, Particulars, Credit/Debit |
| Access | Header contains "access" |
| Stanbic | Header or content |
| Fidelity | Header or content |
| Zenith | Regional layouts |
| CalBank | Regional layouts |
| ADB | Regional layouts |
| Prudential | PDF statement layouts |
| UBA | Header or content |
| Absa | "absa" / "barclays" |

If your bank is not auto-detected, use the **Map** step to map columns manually. Standard+ includes parser tuning support via your account team.

---

## 14) Troubleshooting

| Issue | Solution |
|-------|----------|
| Cannot log in | Check email/password; use Forgot password if email delivery is configured |
| Upload fails | Prefer Excel/CSV; confirm file is not corrupted; check size limits |
| Parse / map errors | Fix date and amount columns; use Map step; see [Mapping guide](/mapping-and-matching-manual.md) |
| No suggested matches | Standard plan or above; check mapping and matching presets |
| Bank account limit reached | Org-wide seat limit — upgrade or archive unused accounts |
| Export delay | Large reports (200+ lines) may take 30–60 seconds |
| Billing unavailable | Ask an admin; Paystack may not be configured in that environment |
| Subscription inactive | Admin: **Settings → Billing** → pay monthly, quarterly, or yearly |

---

## Data Preparation Rules (Recommended)

- Keep one reporting period per project
- Avoid mixed date formats inside one file
- Ensure amounts are numeric (not text)
- Keep cheque/reference values in dedicated columns where possible
- Remove duplicated header rows before upload

---

## Frequently Asked Questions (FAQ)

### 1) Do I need to map columns every month?
No. If your file structure stays consistent, mapping is usually quick and reusable. Re-map only when source column formats change.

### 2) Can one statement file contain both credits and debits?
Yes. Upload it as `Both` during the Upload step.

### 3) Why do I still have unmatched items after reconciliation?
Common reasons: date/amount/reference differences, missing transactions, wrong mapping, or post-period timing differences.

### 4) Can we finalize a report with exceptions?
Yes. You can proceed to report with exceptions noted, then approve based on your internal policy.

### 5) Who can approve or reopen a project?
Approval and reopen are role-based (typically reviewer/admin).

### 6) How do we keep users aligned after UI updates?
Update this manual changelog every release and announce changes to active teams.

### 7) Why is our subscription billed in GHS if we reconcile in USD or EUR?
**Workspace billing** is processed in **GHS** through **Paystack**. Each **project's reporting currency** (`GHS`, `USD`, or `EUR`) is set when creating the project and controls BRS amounts only.

### 8) Where do we upgrade, renew, or see subscription status?
Admins: **Settings → Billing**. You will see plan, status, usage, and Paystack buttons for monthly / quarterly / yearly when billing is enabled.

### 9) Are bank account limits per project or for the whole firm?
**Org-wide.** Creating accounts across projects all count toward the same seat pool (5 / 10 / 30 / unlimited by plan).

### 10) What is the intro offer?
When enabled by the platform, eligible workspaces get **50% off** for their first **two** paid billing periods (each monthly, quarterly, or yearly checkout that applies the discount counts as one period).

---

## Training and Go-Live Plan

> Customer rollout plan for your firm — not the engineering verify harness (`docs/GO_LIVE_VERIFICATION.md`).

### Week 1
- Complete onboarding checklist
- Run one pilot reconciliation end-to-end
- Confirm bank seat usage on the Dashboard
- Try Clean tools: preview + sample download; note full-export quota on Billing

### Week 2
- Move live periods to platform
- Enforce role-based review process

### Week 3+
- Track exceptions trend
- Standardize file formats per client/bank

---

## Support and Escalation

- **Support email:** `info@kqsoftwaresolutions.com`
- **Website:** [kqsoftwaresolutions.com](https://kqsoftwaresolutions.com)
- **Business hours:** Mon–Fri, 8:00–17:00 GMT (or as contracted)

### Quick Support Message Template

```text
Organization:
Project:
User role:
Issue started at:
What happened:
Expected result:
Actual result:
File type used:
Browser:
Screenshot attached: Yes/No
```

---

## Commercial Use and Governance

- **Data ownership:** customer retains ownership of uploaded files and generated reports
- **Access control:** customer admins own role assignment and periodic access review
- **Approval policy:** define who can submit, approve, and reopen
- **Record retention:** agree retention for reports and attachments with your admin
- **Change communication:** announce user-facing workflow changes before release

Recommended:
- monthly role/access audit
- standardize upload templates per client/bank
- document exception handling thresholds in team SOPs

---

## Keeping This Manual Updated

This online page loads content from:

`web/public/user-manual.md`

To update user documentation:
1. Edit `web/public/user-manual.md`
2. Deploy the web app
3. Users see the new version on `/manual` (sign-in required)

Recommended update policy:
- update changelog every release
- update this manual for any user-facing workflow or pricing change
- keep screenshots refreshed after major UI updates
