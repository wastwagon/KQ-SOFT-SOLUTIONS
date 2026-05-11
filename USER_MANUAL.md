# Bank Reconciliation System — User Manual

**KQ SOFT SOLUTIONS** | Global product · HQ Ghana  
**Version 1.0** | March 2026

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Features List](#2-features-list)
3. [Getting Started](#3-getting-started)
4. [Account Management](#4-account-management)
5. [Dashboard](#5-dashboard)
6. [Projects](#6-projects)
7. [Reconciliation Workflow (5 Steps)](#7-reconciliation-workflow-5-steps)
8. [Clients](#8-clients)
9. [Settings](#9-settings)
10. [Audit Log](#10-audit-log)
11. [Reports](#11-reports)
12. [Subscription Plans & Limits](#12-subscription-plans--limits)
13. [Supported Banks](#13-supported-banks)
14. [Roles & Permissions](#14-roles--permissions)
15. [Troubleshooting](#15-troubleshooting)
16. [Glossary](#16-glossary)

---

## 1. Introduction

The Bank Reconciliation System (BRS) is a web-based SaaS application for accounting firms and finance teams. It helps you:

- Upload cash books and bank statements (Excel, CSV, PDF, images)
- Map columns to the correct fields
- Reconcile receipts vs credits and payments vs debits with intelligent matching
- Generate professional Bank Reconciliation Statements (BRS) with your branding
- Export reports as PDF or Excel

The system ships pre-built parsers for many regional bank statement layouts (with auto-detection where supported) and offers flexible matching (1-to-1, 1-to-many, many-to-1, many-to-many).

---

## 2. Features List

### Core Features (All Plans)

| Feature | Description |
|---------|-------------|
| **Document upload** | Upload cash book and bank statement in Excel (.xlsx), CSV, PDF, or images (PNG, JPG, TIFF) |
| **Multi-bank support** | One project can have multiple bank accounts; filter by account during reconcile and report |
| **Column mapping** | Map your document columns to date, amount, description, reference, cheque number |
| **1-to-1 matching** | Match a single cash book line to a single bank line |
| **Side-by-side view** | View receipts vs credits and payments vs debits in a clear layout |
| **Report generation** | Generate BRS with closing balance, uncredited lodgments, unpresented cheques |
| **Export** | Export report as PDF or Excel |
| **Clients** | Link projects to clients for organisation |
| **Currency** | Support for GHS, USD, EUR per project |

### Standard Plan and Above

| Feature | Description |
|---------|-------------|
| **Bank rules** | Create custom rules (e.g. if description contains X → suggest match) |
| **Bulk match** | Match up to 50 transactions at once |
| **AI suggestions** | Suggested matches based on amount, date, and reference |
| **Audit trail** | View action history (who did what, when) |
| **Discrepancy report** | Identify variances and exceptions |
| **Missing cheques report** | Track unpresented cheques |

### Premium Plan and Above

| Feature | Description |
|---------|-------------|
| **1-to-many / many-to-many** | Match one cash book line to multiple bank lines (or vice versa) |
| **Roll-forward** | Carry unpresented cheques to the next period |
| **Threshold approval** | Set an approval threshold amount (e.g. above GH₵10,000 needs reviewer) |
| **Full branding** | Logo, primary/secondary colours, letterhead, report title, footer |

### Firm Plan

| Feature | Description |
|---------|-------------|
| **API access** | Create API keys for programmatic access |
| **Multi-client dashboard** | Manage multiple client organisations |
| **Unlimited** | Unlimited projects and transactions |

### Ghana Bank Support

| Bank | Auto-detection |
|------|----------------|
| Ecobank Ghana | ✓ |
| GCB Bank | ✓ |
| Access Bank Ghana | ✓ |
| Stanbic Bank Ghana | ✓ |
| Fidelity Bank Ghana | ✓ |
| UBA Ghana | ✓ |
| Absa Ghana | ✓ |

---

## 3. Getting Started

### Accessing the System

1. Open your web browser and go to the application URL (e.g. `https://app.yourdomain.com`).
2. If you do not have an account, click **Register**.
3. If you have an account, enter your email and password and click **Login**.

### First-Time Setup

1. **Register** — Create an account with your email, password, name, and organisation name.
2. **Verify your email** — If required, follow the verification link sent to your email.
3. **Sign in** — You will be taken to the Dashboard.

---

## 4. Account Management

### Registration

1. Go to the **Register** page.
2. Enter:
   - **Email** — Your email address
   - **Password** — At least 8 characters (recommended: mix of letters, numbers, symbols)
   - **Name** — Your full name
   - **Organisation name** — Your company or firm name
3. Click **Register**.
4. You will be created as an organisation admin and can invite other members.

### Login

1. Go to the **Login** page.
2. Enter your **email** and **password**.
3. Click **Login**.
4. You will be redirected to the Dashboard.

### Forgot Password

1. Click **Forgot password** on the login page.
2. Enter your email address.
3. Click **Send reset link**.
4. Check your email for a reset link (ensure `RESEND_API_KEY` is configured for production).
5. Click the link and set a new password.

### Logout

Click your profile/name in the top-right corner and select **Logout**.

---

## 5. Dashboard

The Dashboard gives you an overview of your organisation.

### What You See

- **Usage metrics** — Number of projects and transactions used this month vs your plan limit
- **Recent projects** — Quick links to your latest projects
- **Quick actions** — Links to create a new project, view reports, or go to settings

### Navigation

Use the main navigation menu:

- **Dashboard** — Home
- **Projects** — List and manage projects
- **Reports** — Completed projects (ready for export)
- **Clients** — Manage clients
- **Audit** — Action history (Standard plan and above)
- **Settings** — Branding, billing, members, API keys, bank rules

---

## 6. Projects

### Creating a Project

1. Go to **Projects** → **New project**.
2. Enter:
   - **Name** — e.g. "Ecobank Jan 2025"
   - **Client** (optional) — Select from your clients or leave blank
   - **Currency** — GHS (default), USD, or EUR (reporting currency for this project’s BRS only; workspace subscription remains GHS via Paystack — see Settings → Billing)
   - **Roll-forward from** (optional) — Select a completed project to carry unpresented cheques forward (Premium+)
3. Click **Create**.

### Project List

- View all projects with status: **Draft**, **Reconciling**, **In review**, **Completed**.
- Filter by status using the filter dropdown.
- Click a project to open it and start the reconciliation workflow.

### Editing a Project

1. Open the project.
2. Click **Edit** next to the project name.
3. Change name, client, or currency.
4. Click **Save**.

### Deleting a Project

- Only **Admin** can delete a project.
- Click **Delete** and confirm. This removes the project and all related data.

---

## 7. Reconciliation Workflow (5 Steps)

Each project follows a 5-step workflow. Use the step tabs at the top: **Upload** → **Map** → **Reconcile** → **Review** → **Report**.

### Step 1: Upload

Upload your cash book and bank statement.

#### Cash Book

- **Receipts** — Money received (income)
- **Payments** — Money paid out (expenses)
- **Both** — If one file contains both, select "Both" and upload once

**Supported formats:** Excel (.xlsx), CSV, PDF, images (PNG, JPG, TIFF).

#### Bank Statement

- **Credits** — Money credited to your account
- **Debits** — Money debited from your account
- **Both** — If one file contains both, select "Both" and upload once

**Multiple bank accounts:** If you have more than one account, add or select a bank account name before uploading.

#### Tips

- Use Excel or CSV for best parsing results.
- Ghana bank formats (Ecobank, GCB, Access, etc.) are auto-detected.
- Ensure dates and amounts are in clear columns.

---

### Step 2: Map

If any document has unmapped columns, the Map step will show them.

1. For each document (cash book receipts, payments, bank credits, debits):
   - Select which column maps to **Date**
   - Select which column maps to **Amount Received** (amt_received) or **Amount Paid** (amt_paid) for cash book; **Credit** or **Debit** for bank
   - Select which column maps to **Description** (or Particulars, Narrative)
   - Optionally map **Reference** and **Cheque number**
2. Click **Save mapping**.
3. Proceed to **Reconcile**.

---

### Step 3: Reconcile

Match cash book lines to bank lines.

#### Cash Book table columns

- **Date** — Transaction date
- **Name** — Counterparty (payer/payee)
- **Description** — Details/particulars
- **Chq no.** — Cheque number (for payments)
- **Amount Received** — Money received (receipts)
- **Amount Paid** — Money paid out (payments)
- **Balance** — Running balance
- **Note** — Unmatched reason (if applicable)

The Cash Book shows both receipts and payments together by default. Use **Receipts vs Credits** or **Payments vs Debits** to match.

#### Bank Statement table columns

- **Date** — Transaction date
- **Description** — Bank description
- **Debit** — Amount debited
- **Credit** — Amount credited
- **Balance** — Running balance
- **Note** — Unmatched reason (if applicable)

#### Receipts vs Credits

- **Receipts** — Money you recorded as received (cash book)
- **Credits** — Money the bank has credited to your account

Match each receipt to its corresponding bank credit (or leave unmatched if it is an uncredited lodgment).

#### Payments vs Debits

- **Payments** — Money you recorded as paid (e.g. cheques issued)
- **Debits** — Money the bank has debited from your account

Match each payment to its corresponding bank debit (or leave unmatched if it is an unpresented cheque).

#### How to Match

1. **Single match:** Select one cash book line and one bank line, then click **Match**.
2. **Bulk match (Standard+):** Select multiple pairs (up to 50) and click **Bulk match**.
3. **1-to-many / many-to-many (Premium+):** Select one cash book line and multiple bank lines (or vice versa), then match.

#### Suggestions

- If your plan includes AI suggestions, suggested matches appear. Review and accept or ignore.
- Use **Bank rules** (Settings → Bank rules) to auto-suggest matches based on conditions.

#### Filters

- Filter by **bank account** if you have multiple.
- Filter by **amount** or **date** to find specific transactions.

#### Unmatched Items

- **Uncredited lodgments** — Receipts not yet credited by the bank. Leave unmatched; they appear on the BRS as additions.
- **Unpresented cheques** — Cheques issued but not yet presented. Leave unmatched; they appear on the BRS as deductions.

---

### Step 4: Review

1. When reconciliation is complete, click **Submit for review** (if you have a reviewer).
2. The project status becomes **In review**.
3. A **Reviewer** or **Admin** can:
   - **Approve** — Mark as completed
   - **Send back** — Return to the preparer for changes

---

### Step 5: Report

View and export the Bank Reconciliation Statement.

#### Report Contents

- **Closing balance per bank statement**
- **Add: Uncredited lodgments** — Table with date, name, description, amount received, amount paid
- **Less: Unpresented cheques** — Table with date, cheque number, name, description, amount received, amount paid
- **Unmatched credits/debits in bank** — Tables with date, description, debit, credit, balance
- **Balance per cash book at end of period**

#### Actions

- **Edit summary & notes** — Add narrative, preparer comment, reviewer comment
- **Add supporting documents** — Attach approval scans, extra PDFs (not parsed for transactions)
- **Export PDF** — Download the BRS as PDF (includes name, description, cheque no. for exceptions)
- **Export Excel** — Download as Excel (full columns: Name, Description, Chq no., Debit, Credit, Balance)
- **Print** — Print the report
- **Approve** (Reviewer/Admin) — Mark project as completed
- **Reopen** (Reviewer/Admin) — Return to Reconcile for changes
- **Roll-forward** (Premium+) — Create a new project with unpresented cheques carried forward

---

## 8. Clients

Manage clients to organise projects.

### Adding a Client

1. Go to **Clients**.
2. Click **Add client**.
3. Enter the client name (max 200 characters).
4. Click **Save**.

### Using Clients

- When creating or editing a project, select a client from the dropdown.
- Clients help you filter and organise projects by client.

---

## 9. Settings

Access **Settings** from the main menu. Tabs: **Branding**, **Billing**, **Members**, **API keys**, **Bank rules**.

### Branding (Admin only)

- **Logo** — Upload your organisation logo (PNG or JPEG)
- **Primary colour** — Main colour for buttons and accents
- **Secondary colour** — Secondary accent
- **Letterhead address** — Address shown on reports
- **Report title** — Default "Bank Reconciliation Statement" or custom
- **Footer** — Text at bottom of reports
- **Approval threshold** (Premium+) — Amount above which reviewer approval is required

Click **Reset to platform default** to restore platform defaults.

### Billing (Admin only)

- View **current plan** and usage (projects, transactions)
- **Upgrade** — Click to pay via Paystack (GHS)
- **Intro offer** — 50% off first payment when enabled by platform
- **Currency note:** Workspace billing is always in **GHS**. Each **project** still uses its own reporting currency (**GHS**, **USD**, or **EUR**) for the BRS — set when you create the project, not in Billing.

### Members (Admin only)

- **Add member** — Enter email and assign role (Admin, Reviewer, Preparer, Viewer)
- **Change role** — Edit existing members
- **Remove member** — Remove from organisation

### API Keys (Firm plan, Admin only)

- **Create API key** — Generate a key for programmatic access
- **Revoke** — Delete a key when no longer needed

### Bank Rules (Admin/Reviewer)

Create rules to auto-suggest matches:

1. **Condition** — e.g. "Description contains" → "SALARY"
2. **Action** — e.g. "Suggest match" or "Flag for review"
3. **Priority** — Higher priority rules run first

---

## 10. Audit Log

(Standard plan and above)

- View **Audit** to see who did what and when.
- Actions logged: login, project create/edit/delete, upload, match, submit, approve, reopen, etc.
- Export audit log if your plan supports it.

---

## 11. Reports

- **Reports** in the menu shows projects with status **Completed**.
- Click a project to open its Report step and export PDF or Excel.

---

## 12. Subscription Plans & Limits

| Plan | Projects/mo | Transactions/mo | Users |
|------|-------------|-----------------|-------|
| Basic | 5 | 500 | 1 |
| Standard | 20 | 2,000 | 3 |
| Premium | 100 | 10,000 | 5+ |
| Firm | Unlimited | Unlimited | Unlimited |

- **Intro offer:** 50% off first payment when enabled.
- **Yearly billing:** ~17% discount vs monthly.

---

## 13. Supported Banks

The system auto-detects these bank statement formats (examples; generic CSV/Excel/PDF is also supported):

| Bank | Detection |
|------|-----------|
| Ecobank Ghana | Headers + description content |
| GCB Bank | Value Date, Particulars, Credit/Debit |
| Access Bank Ghana | Header contains "access" |
| Stanbic Bank Ghana | Header or content contains "stanbic" |
| Fidelity Bank Ghana | Header or content contains "fidelity" |
| UBA Ghana | Header or content contains "uba" |
| Absa Ghana | Header or content contains "absa" or "barclays" |

If your bank is not auto-detected, use the **Map** step to manually map columns.

---

## 14. Roles & Permissions

| Action | Admin | Reviewer | Preparer | Viewer |
|--------|-------|----------|----------|--------|
| Delete project | ✓ | | | |
| Reopen project | ✓ | ✓ | | |
| Edit bank rules | ✓ | ✓ | | |
| Edit branding | ✓ | | | |
| Manage billing | ✓ | | | |
| Manage members | ✓ | | | |
| Export report | ✓ | ✓ | ✓ | |
| Create project | ✓ | ✓ | ✓ | |
| Upload documents | ✓ | ✓ | ✓ | |
| Map documents | ✓ | ✓ | ✓ | |
| Reconcile | ✓ | ✓ | ✓ | |
| Submit for review | ✓ | ✓ | ✓ | |
| Approve | ✓ | ✓ | | |
| Delete attachment | ✓ | ✓ | | |

---

## 15. Troubleshooting

| Issue | Solution |
|-------|----------|
| Cannot log in / 401 | Check API is running; ensure `VITE_API_URL` points to the API |
| Upload fails | Use Excel or CSV for testing; ensure file is not corrupted |
| Parse errors | Check column headers; use Map step to correct mapping |
| No suggested matches | Ensure you have Standard plan or above; check bank rules |
| Export fails | For large reports (200+ transactions), wait 30–60 seconds |
| CORS errors | Ensure frontend URL is in `CORS_ORIGIN` (production) |
| Password reset not received | Configure `RESEND_API_KEY` and `APP_URL` in production |

---

## 16. Glossary

| Term | Meaning |
|------|---------|
| **Cash book** | Your organisation's record of receipts and payments |
| **Bank statement** | The bank's record of credits and debits to your account |
| **Receipts** | Money received (cash book) |
| **Payments** | Money paid out (cash book) |
| **Credits** | Money credited to your account (bank) |
| **Debits** | Money debited from your account (bank) |
| **Uncredited lodgments** | Receipts you recorded but not yet credited by the bank |
| **Unpresented cheques** | Cheques you issued but not yet presented to the bank |
| **Balance per cash book** | Reconciled balance = bank closing + lodgments − unpresented cheques |
| **BRS** | Bank Reconciliation Statement |
| **Roll-forward** | Carry unpresented cheques to the next period |

---

*End of User Manual*
