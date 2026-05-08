# KQ BRS Platform User Manual

**Product:** KQ Bank Reconciliation System (BRS)  
**Company:** KQ SOFT SOLUTIONS (Ghana)  
**Audience:** End users (accounting teams, reviewers, firm admins)  
**Updated:** May 2026

---

## 1) What This Platform Does

KQ BRS helps your team reconcile cash book transactions against bank statements and produce professional Bank Reconciliation Statements (BRS).

With this platform, you can:
- upload cash book and bank files (Excel, CSV, PDF, image formats)
- map columns once and reuse that setup
- reconcile receipts vs credits, and payments vs debits
- review exceptions and complete approval workflow
- export branded BRS reports in PDF and Excel

---

## 2) Who Should Use It

- **Preparers:** upload documents, map columns, reconcile transactions, prepare reports
- **Reviewers:** review exceptions, approve/reopen projects, validate final output
- **Admins:** manage team members, branding, billing, plan features, and platform settings
- **Viewers:** read-only access where enabled

---

## 3) Accessing the Platform

1. Open your platform URL in a browser.
2. Select **Register** to create an account, or **Login** if already registered.
3. If you forget your password, use **Forgot password** and follow the reset link.

After login, you land on the Dashboard.

---

## 4) Main Navigation

- **Dashboard:** usage, recent activity, and quick start actions
- **Projects:** create and manage reconciliation jobs
- **Reports:** completed project reports and exports
- **Clients:** client list for project organization
- **Audit:** activity history (plan-dependent)
- **Settings:** branding, billing, members, API keys, bank rules (plan-dependent)

---

## 5) End-to-End Workflow (Recommended)

Every project follows this sequence:

1. **Upload**
2. **Map**
3. **Reconcile**
4. **Review**
5. **Report**

Follow this order for the cleanest and fastest reconciliations.

---

## 6) Create a New Project

Go to `Projects` -> `New project`, then complete:
- **Project name** (example: `Ecobank - Jan 2026`)
- **Client** (optional)
- **Reconciliation date**
- **Currency** (`GHS`, `USD`, `EUR`)
- **Copy settings from another project** (optional)
- **Roll forward from completed project** (if enabled on your plan)

Save to start the workflow.

---

## 7) Step 1: Upload Documents

### Cash Book Upload
- Select use mode: `Receipts`, `Payments`, or `Both`
- Upload one or multiple files
- If one file contains both sides, choose `Both`

### Bank Statement Upload
- Select use mode: `Credits`, `Debits`, or `Both`
- Optionally assign/select a bank account if handling multiple accounts
- Upload one or multiple files

### Supported File Types
- `.xlsx`, `.xls`, `.csv`, `.pdf`, `.png`, `.jpg`, `.jpeg`, `.tiff`

### Best Practices
- Prefer Excel/CSV for highest parsing accuracy
- Ensure date and amount fields are clearly structured
- Upload complete period files before mapping/reconciling

---

## 8) Step 2: Map Columns

In `Map`, the system suggests mappings from your headers.  
You can:
- click **Apply suggested mapping to all documents** (fast path), or
- map documents individually

### Typical Fields
- **Cash book:** `date`, `name`, `details`, `doc_ref`, `chq_no`, `amt_received`, `amt_paid`
- **Bank:** `transaction_date`, `description`, `credit`, `debit`

### Important Rules
- Always map a **date field** for matching quality
- If one amount column contains positive/negative values, signed amount mode is supported
- Review confidence labels (high/medium/low) before applying

---

## 9) Step 3: Reconcile Transactions

In `Reconcile`, work in one of these views:
- **Receipts vs Credits**
- **Payments vs Debits**
- **Cash book (all)** for overview

### Matching Types
- **1:1** (all plans)
- **1:many**, **many:1**, **many:many** (plan-dependent)

### Reconcile Actions
- manual row selection and match
- suggested matches review
- bulk matching (plan-dependent)
- unmatch incorrect pairings
- bank-account filtering for multi-account projects

### Suggested Matching Parameters
- Strict (amount + date + reference + cheque)
- Amount + Date
- Amount only (broadest; review carefully)

---

## 10) Step 4: Review & Exceptions

The review page summarizes:
- matched transaction count
- unmatched cash book transactions
- unmatched bank transactions
- variance indicator

You can:
- inspect exception tables
- mark exceptions as reviewed (internal checklist support)
- move back to `Reconcile` if corrections are needed
- proceed to report with or without unresolved exceptions

---

## 11) Step 5: Report & Finalization

The report page generates the formal BRS output.

### Report Features
- branded statement layout
- narrative summary and notes
- preparer/reviewer comments
- missing cheques report (plan-dependent)
- discrepancy report (plan-dependent)
- supporting document attachments

### Actions
- export **Excel**
- export **PDF**
- print/save as PDF
- submit for review
- approve (role-based)
- reopen for editing (role-based)
- undo reconciliation (role-based, with reason)
- create next period via roll-forward (plan-dependent)

---

## 12) Supporting Functional Areas

### Clients
- Create and manage client records
- Link projects to clients for organization and filtering

### Members (Settings -> Members)
- Invite existing users by email
- Assign roles (`admin`, `reviewer`, `preparer`, `viewer`, `member`)
- Remove members and update roles (role-based)

### Branding (Settings -> Branding)
- report title
- letterhead address
- footer text
- primary/secondary colors
- logo upload (plan-dependent)
- approval threshold (plan-dependent)

### Billing (Settings -> Billing)
- view current plan and subscription status
- upgrade via supported payment flow (if configured)

### API Keys (Settings -> API keys, plan-dependent)
- create/revoke keys for programmatic access
- one-time key display after creation

### Bank Rules (Settings -> Bank rules, plan-dependent)
- define conditions on bank data fields
- actions: suggest match or flag for review
- set priority for rule order

---

## 13) Roles and Permission Summary

General behavior:
- **Admin:** full organization control
- **Reviewer:** review/approval authority
- **Preparer:** operational reconciliation work
- **Viewer:** read-only access

Typical gated actions include:
- project deletion
- approving/reopening
- editing branding
- managing billing/members
- deleting attachments
- API key and bank-rule management

Use your organization settings to align roles with internal approval policy.

---

## 14) Subscription and Feature Gating

Some capabilities depend on your plan, including:
- advanced matching modes
- bulk match and AI-assisted flows
- missing cheques and discrepancy reporting
- full branding controls
- bank rules
- API access
- roll-forward workflow

If a feature is unavailable, the UI will show an upgrade/plan notice.

---

## 15) Troubleshooting Guide

### Login or access problems
- confirm correct URL and credentials
- use password reset if needed
- contact admin if your role/access changed

### Upload or parse issues
- retry with CSV/XLSX for validation
- verify files cover the same period
- check date and amount columns for clean formatting

### Mapping issues
- ensure required date fields are mapped
- avoid mapping debit/credit to the wrong side
- re-run mapping for all documents after corrections

### Reconcile issues
- switch to Receipts/Credits or Payments/Debits view
- verify match parameters are not too strict or too broad
- use bank account filters for multi-account projects

### Export issues
- large reports may take longer to generate
- retry export after a short wait
- reduce unresolved data noise before export for cleaner output

### Billing / upgrade not available
- payment integration may not be configured in your environment
- contact platform support/admin

---

## 16) Data Quality Checklist (For Better Results)

Before reconciliation:
- same date range across cash book and bank files
- consistent number formats (decimal precision, separators)
- clear references/cheque numbers where available
- no duplicate uploads of the same statement period
- map once, then validate sample extracted rows

---

## 17) Suggested Team SOP (Commercial Rollout)

Use this simple operating model with client teams:

1. **Preparer** creates project and uploads all period files
2. **Preparer** maps fields and performs reconciliation
3. **Reviewer** checks exceptions and variance
4. **Reviewer/Admin** approves final report
5. **Team** exports final PDF/Excel and archives attachments

This creates a repeatable, audit-friendly monthly process.

---

## 18) Quick Glossary

- **Cash book:** internal ledger of receipts/payments
- **Bank statement:** bank-side record of credits/debits
- **Uncredited lodgments:** cash book receipts not yet reflected by bank
- **Unpresented cheques:** cash book payments not yet reflected by bank
- **Variance:** difference indicator between unmatched totals
- **Roll-forward:** carry period-end pending items into next project

---

## 19) Support Handover Template

Share this with new customer users:

1. Platform URL
2. Login instructions
3. Role assignment list
4. First project naming convention
5. Supported input file formats
6. Escalation contact for billing/access issues

---

**Document End**
