# KQ BRS Platform User Manual

**Product:** KQ Bank Reconciliation System (BRS)  
**Company:** KQ SOFT SOLUTIONS LIMITED  
**Audience:** End users and operations teams  
**Updated:** May 7, 2026

> Welcome to KQ BRS. This manual is your official guide for onboarding, day-to-day reconciliation, approvals, reporting, and support escalation.  
> For best results, share this page with all new users during kickoff and role assignment.

## Changelog

| Date | Version | Changes |
|------|---------|---------|
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
- [ ] Billing/plan features confirmed

---

## 1) Overview

KQ BRS helps teams reconcile cash book entries with bank statements and generate professional Bank Reconciliation Statements.

Core capabilities:
- Upload cash book and bank files (Excel, CSV, PDF, image formats)
- Map columns once and extract transactions
- Reconcile receipts vs credits and payments vs debits
- Review exceptions and complete sign-off
- Export final reports in PDF and Excel

---

## 2) Navigation

- **Dashboard**: summary and quick actions
- **Projects**: create and manage reconciliation jobs
- **Reports**: completed jobs and exports
- **Clients**: client directory
- **Audit log**: activity records (plan-based)
- **Settings**: branding, billing, members, API keys, bank rules (plan-based)
- **User manual**: this documentation page

---

## Platform Walkthrough (Screenshots)

Add your screenshots to make training easier for end users.

Recommended screenshots:
1. Dashboard home
2. New project form
3. Upload step
4. Mapping step
5. Reconcile screen (both views)
6. Review exceptions
7. Final report/export page

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
4. Review plan-gated features with your team

### Preparer (daily operations)
1. Create project
2. Upload files
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

Go to **Projects -> New project**, then set:
- project name
- client (optional)
- reconciliation date
- currency (`GHS`, `USD`, `EUR`)
- optional roll-forward source (if enabled)

---

## 5) Upload Step

### Cash Book
- Upload as `Receipts`, `Payments`, or `Both`

### Bank Statement
- Upload as `Credits`, `Debits`, or `Both`
- For multiple accounts, assign/select bank account name

Supported formats:
- `.xlsx`, `.xls`, `.csv`, `.pdf`, `.png`, `.jpg`, `.jpeg`, `.tiff`

---

## 6) Map Step

Map source columns to canonical fields.

Common fields include:
- Cash book: `date`, `name`, `details`, `doc_ref`, `chq_no`, `amt_received`, `amt_paid`
- Bank: `transaction_date`, `description`, `credit`, `debit`

Tips:
- Always map date columns
- Use "Apply suggested mapping to all documents" for speed

---

## 7) Reconcile Step

Work in:
- **Receipts vs Credits**
- **Payments vs Debits**
- **Cash book (all)** for overview

Matching modes:
- 1:1 (base)
- 1:many / many:1 / many:many (plan-based)

Available actions:
- manual matching
- suggested matching
- bulk matching (plan-based)
- unmatch
- bank account filtering

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
- roll-forward (plan-based)

---

## 10) Roles

- **Admin**: full control
- **Reviewer**: review and approval flows
- **Preparer**: upload/map/reconcile/report preparation
- **Viewer**: read-only access

---

## 11) Troubleshooting

- **Upload issues:** retry with CSV/XLSX and verify date/amount columns
- **No matches:** review mapping and matching parameters
- **Export delay:** large reports may require additional processing time
- **Billing unavailable:** payment integration may not be configured in the environment

---

## Data Preparation Rules (Recommended)

To improve reconciliation accuracy:

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
Common reasons:
- date/amount/reference differences
- missing transactions in one source
- wrong mapping on one side
- post-period timing differences

### 4) Can we finalize a report with exceptions?
Yes. You can proceed to report with exceptions noted, then approve based on your internal policy.

### 5) Who can approve or reopen a project?
Approval and reopen access are role-based (typically reviewer/admin roles).

### 6) How do we keep users aligned after UI updates?
Update this manual changelog every release and announce changes to all active teams.

---

## Training and Go-Live Plan

### Week 1
- Complete onboarding checklist
- Run one pilot reconciliation end-to-end

### Week 2
- Move live periods to platform
- Enforce role-based review process

### Week 3+
- Track exceptions trend
- Standardize file formats per client/bank

---

## Support and Escalation

Set your customer-facing support details here:

- **Support email:** `support@yourdomain.com`
- **Support phone/WhatsApp:** `+233-XX-XXX-XXXX`
- **Business hours:** `Mon-Fri, 8:00-17:00 GMT`
- **Critical incident SLA target:** `2 hours initial response`

### Quick Support Message Template

Use this template when raising incidents:

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

When contacting support, include:
- organization name
- project name
- error message screenshot
- file type used (CSV/XLSX/PDF)
- browser and time of issue

---

## Commercial Use and Governance

For customer-facing deployments, define and communicate:

- **Data ownership:** customer retains ownership of all uploaded files and generated reports
- **Access control:** customer admins are responsible for role assignment and periodic access review
- **Approval policy:** define who can submit, approve, and reopen reconciliations
- **Record retention:** specify how long reports and attachments are retained
- **Change communication:** announce user-facing workflow changes before release

Recommended:
- perform a monthly role/access audit
- standardize upload templates per client/bank
- document exception handling thresholds in team SOPs

---

## 12) Keeping This Manual Updated

This online page loads content from:

`web/public/user-manual.md`

To update user documentation:
1. Edit `web/public/user-manual.md`
2. Deploy your platform update
3. Users instantly see the new manual version on `/manual`

Recommended update policy:
- update changelog every release
- update this manual for any user-facing workflow change
- keep screenshots refreshed after major UI updates

