# Database, Backend & Dashboard Comparison

**Purpose:** Align database models, API routes, admin dashboard, and user dashboard. Identify mismatches, incomplete features, conflicts, and duplicates.

---

## 1. Database Models (Prisma)

| Model | Description | API Exposure |
|-------|-------------|--------------|
| User | Users with email, password, name, suspendedAt | Auth, Admin users |
| PasswordResetToken | Password reset flow | Auth /forgot-password, /reset-password |
| Plan | Plans (basic, standard, premium, firm) | Subscription, Admin plans |
| Organization | Orgs with plan, branding, suspendedAt | Auth/me, Admin organizations, Settings |
| OrganizationMember | Org membership with role | Settings members, Admin org members |
| ApiKey | Org API keys ( Firm plan ) | Settings > API keys |
| BankRule | Org bank rules ( Standard+ ) | Settings > Bank rules |
| Client | Clients per org | Clients API |
| Project | Projects with status, roll-forward | Projects API |
| Document | Cash book / bank statement uploads | Documents API |
| Transaction | Bank/cash transactions | Documents, Reconcile |
| Match, MatchItem | Matches (one-to-one, etc.) | Reconcile API |
| BrsAttachment | Project attachments | Attachments API |
| AuditLog | Org audit trail ( Standard+ ) | Audit API |
| Payment | Subscriptions / Paystack | Subscription, Admin payments |
| UsageLog | Per-org usage per period | Internal (usage service) |
| PlatformSettings | Key-value platform config | Admin settings (generation) |

**Schema Note:** `OrganizationMember.role` includes `admin | reviewer | preparer | viewer | member` (default `member`).

---

## 2. API Routes vs Frontend

### 2.1 User-Facing API (web app)

| Route | Method | Used By |
|-------|--------|---------|
| /auth/me | GET | AuthHydrator, Layout |
| /auth/register | POST | Register |
| /auth/login | POST | Login |
| /auth/forgot-password | POST | ForgotPassword |
| /auth/reset-password | POST | ResetPassword |
| /clients | GET, POST | Clients page |
| /projects | GET, POST, PATCH, DELETE | Projects, ProjectNew, ProjectDetail |
| /projects/:id/submit | PATCH | ProjectDetail |
| /projects/:id/approve | PATCH | ProjectDetail |
| /projects/:id/reopen | PATCH | ProjectDetail |
| /projects/:id/undo-reconciliation | PATCH | ProjectDetail |
| /upload/cash-book/:projectId | POST | ProjectDetail |
| /upload/bank-statement/:projectId | POST | ProjectDetail |
| /upload/attachments/:projectId | POST | ProjectDetail |
| /upload/branding-logo | POST | Settings |
| /attachments | GET | ProjectDetail |
| /attachments/:id/download | GET | ProjectDetail |
| /attachments/:id | DELETE | ProjectDetail |
| /documents/:id/preview | GET | ProjectDetail |
| /documents/:id/map | POST | ProjectDetail |
| /documents/:id/transactions | GET | ProjectDetail |
| /reconcile/:projectId | GET, POST match, multi, bulk, DELETE match | ProjectDetail |
| /report/:projectId | GET | ProjectReport |
| /report/:projectId/export | GET | ProjectReport |
| /subscription/usage | GET | Dashboard, Settings |
| /subscription/plans | GET | Settings Billing |
| /subscription/initialize | POST | Settings Billing |
| /audit | GET | Audit page |
| /settings/branding | GET, PATCH | Settings Branding |
| /settings/members | GET, POST | Settings Members |
| /settings/members/:userId | DELETE, PATCH | Settings Members (remove, role update via dropdown) |
| /api-keys | GET, POST, DELETE | Settings API Keys |
| /bank-rules | GET, POST, PATCH, DELETE | Settings BankRulesSection |

Org admins can add, remove, and change member roles via the role dropdown in Settings > Members.

### 2.2 Admin API (platform admin)

| Route | Method | Admin Frontend |
|-------|--------|----------------|
| /admin | GET | — |
| /admin/overview | GET | AdminOverview ✓ |
| /admin/settings | GET, PUT | AdminGenerationSettings ✓ |
| /admin/plans | GET, POST | AdminPlans, AdminSubscribers, AdminOrgDetail ✓ |
| /admin/plans/:id | GET, PUT, DELETE | AdminPlans ✓ |
| /admin/users | GET | AdminUsers ✓ |
| /admin/users/:id | GET, PATCH | AdminUserDetail ✓ |
| /admin/organizations | GET | AdminSubscribers ✓ |
| /admin/organizations/export/csv | GET | AdminSubscribers (export) ✓ |
| /admin/organizations/:id | GET, PATCH | AdminOrgDetail ✓ |
| /admin/organizations/bulk-plan | POST | AdminSubscribers ✓ |
| /admin/organizations/:orgId/members/:userId | PATCH, DELETE | AdminOrgDetail ✓ |
| /admin/payments | GET | AdminPayments ✓ |
| /admin/analytics/revenue | GET | AdminRevenue ✓ |

---

## 3. Admin Dashboard vs API

| Admin Page | Route | API Used | Status |
|------------|-------|----------|--------|
| AdminOverview | /platform-admin | GET /admin/overview | ✓ |
| AdminSubscribers | /platform-admin/organizations | GET /admin/organizations, /admin/plans, PATCH, bulk-plan, export | ✓ |
| AdminOrgDetail | /platform-admin/organizations/:slug | GET /admin/organizations/:slug, PATCH, members PATCH/DELETE | ✓ |
| AdminUsers | /platform-admin/users | GET /admin/users | ✓ |
| AdminUserDetail | /platform-admin/users/:id | GET /admin/users/:id, PATCH | ✓ |
| AdminPlans | /platform-admin/plans | GET/POST /admin/plans, PUT/DELETE /admin/plans/:id | ✓ |
| AdminRevenue | /platform-admin/revenue | GET /admin/analytics/revenue | ✓ |
| AdminGenerationSettings | /platform-admin/generation-settings | GET/PUT /admin/settings | ✓ |
| AdminPayments | /platform-admin/payments | GET /admin/payments (paginated, org filter) | ✓ |

**Naming:** `AdminSubscribers` lists organizations; route is `/platform-admin/organizations`. `/platform-admin/subscribers` redirects to `/platform-admin/organizations`. No conflict; "Subscribers" is effectively "Organizations" in UI.

---

## 4. User Dashboard (Settings) vs API

| Settings Tab | API | Status |
|--------------|-----|--------|
| Branding | GET/PATCH /settings/branding, POST /upload/branding-logo | ✓ |
| Billing | GET /subscription/usage, /subscription/plans, POST initialize | ✓ |
| Members | GET/POST /settings/members, DELETE /settings/members/:userId | ✓ |
| Members – role update | PATCH /settings/members/:userId | ✓ (role dropdown in MembersSection) |
| API keys | GET/POST/DELETE /api-keys | ✓ |
| Bank rules | GET/POST/PATCH/DELETE /bank-rules | ✓ |

**Bank rules shape:** API returns `{ rules: [...] }`. BankRulesSection correctly uses `data?.rules`. ✓

---

## 5. Conflicts & Duplicates

### 5.1 Member Management

| Scope | API | UI |
|-------|-----|-----|
| Org admin (own org) | /settings/members | Settings > Members |
| Platform admin (any org) | /admin/organizations/:id/members | AdminOrgDetail |

Not duplicates: different audiences (org admin vs platform admin). Org admins can add, remove, and change member roles via Settings > Members.

### 5.2 Plans

| Context | API | UI |
|---------|-----|-----|
| User subscription | /subscription/plans | Settings > Billing |
| Admin CRUD | /admin/plans | AdminPlans |
| Admin list (slug/name) | /admin/plans | AdminSubscribers, AdminOrgDetail |

No conflict. User plans show public pricing; admin plans expose full CRUD and extra fields.

### 5.3 Settings

| Type | API | UI |
|------|-----|-----|
| Org settings (branding, members) | /settings/* | Settings |
| Platform settings (generation) | /admin/settings | AdminGenerationSettings |

Different scopes; no duplication.

---

## 6. Summary of Gaps & Recommendations

| # | Item | Type | Status |
|---|------|------|--------|
| 1 | PATCH /settings/members/:userId | Incomplete UI | ✅ Implemented: role dropdown in Settings > Members |
| 2 | GET /admin/payments | Incomplete UI | ✅ Implemented: AdminPayments page and nav link |
| 3 | OrganizationMember.role comment | Inconsistency | ✅ Fixed: Prisma comment now includes `member` |
| 4 | settings.updateMemberRole | Unused API client | ✅ Implemented: used in MembersSection for role updates |

---

## 7. API Index (GET /api/v1)

The index lists: `auth`, `admin`, `clients`, `projects`, `upload`, `attachments`, `documents`, `reconcile`, `report`, `subscription`, `audit`, `settings`, `apiKeys`, `bankRules`. Sub-paths are not enumerated; this is acceptable for a high-level index.
