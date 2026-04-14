# Super Admin & User Settings Verification

**Date:** 2026-03-10

---

## Summary

Verified and improved consistency between super admin dashboard settings and user dashboard settings. Implemented fixes for platform defaults flow, plan slug validation, and user branding reset.

---

## 1. Super Admin Dashboard

### Routes & Pages

| Route | Page | Purpose |
|-------|------|---------|
| `/platform-admin` | AdminOverview | Counts (users, orgs, plans) |
| `/platform-admin/organizations` | AdminSubscribers | Orgs list, bulk plan change |
| `/platform-admin/organizations/:slug` | AdminOrgDetail | Org detail, plan override, suspend |
| `/platform-admin/users` | AdminUsers | Platform users |
| `/platform-admin/plans` | AdminPlans | Plans CRUD (basic, standard, premium, firm) |
| `/platform-admin/payments` | AdminPayments | Payment history |
| `/platform-admin/revenue` | AdminRevenue | Revenue analytics |
| `/platform-admin/generation-settings` | AdminGenerationSettings | Platform defaults |

### Generation Settings (Admin)

- Report title, footer, primary/secondary colours
- Default currency (GHS/USD/EUR)
- Manual FX rates, use manual only
- Matching: amount tolerance, date window
- Data retention years
- API rate limit

**Flow:** Saved to `PlatformSettings` (key `generation`). Cache invalidated on save so `getPlatformDefaults()` returns fresh data.

---

## 2. User Dashboard Settings

### Tabs

| Tab | Purpose |
|-----|---------|
| Branding | Logo, colours, report title, footer, letterhead, approval threshold |
| Billing | Current plan, upgrade (Paystack) |
| Members | Team members, roles |
| API keys | (Firm plan) |
| Bank rules | (Standard+ plan) |

### Branding ↔ Platform Defaults

- **New orgs:** Branding initialised from platform defaults at registration
- **Existing orgs:** Can now "Reset to platform default" to apply report title, footer, colours from platform
- **API:** `GET /settings/platform-defaults` returns `defaultCurrency`, `reportTitle`, `footer`, `primaryColor`, `secondaryColor`

---

## 3. Plans & Subscriptions

### Plan Slugs (Standardised)

- **Allowed:** `basic`, `standard`, `premium`, `firm` only
- **AdminPlans:** Slug restricted to dropdown; API validates `z.enum(['basic','standard','premium','firm'])`
- **Reason:** `planFeatures.ts` and `USER_LIMIT_BY_PLAN` only support these slugs

### Subscription Flow

1. **User upgrade:** Settings → Billing → choose plan → Paystack → webhook updates org.plan
2. **Admin override:** AdminOrgDetail or AdminSubscribers → change plan directly (no payment)
3. **Renewals:** Paystack recurring; webhook handles `charge.success`

---

## 4. Settings Linking

| From | To | How |
|------|-----|-----|
| Admin generation settings | New orgs | `auth.ts` copies branding at registration |
| Admin generation settings | Report generation | `report.ts` uses `branding.X \|\| platformDefaults.X` |
| Admin generation settings | Matching | `reconcile.ts` uses `amountTolerance`, `dateWindowDays` |
| Admin generation settings | User branding | "Reset to platform default" fetches and applies |
| Admin plans | User billing | `subscription/plans` returns plans from DB + config |

---

## 5. Changes Implemented

| Change | File(s) |
|--------|---------|
| Platform defaults cache invalidation on admin save | `platformDefaults.ts`, `admin/settings.ts` |
| Extended platform-defaults API (branding fields) | `settings.ts` |
| User Settings "Reset to platform default" button | `Settings.tsx` |
| AdminPlans slug restricted to basic/standard/premium/firm | `admin/plans.ts`, `AdminPlans.tsx` |

---

## 6. Deployment

- No deployment-specific settings in super admin UI
- Deployment config: `VITE_API_URL`, `CORS_ORIGIN`, `docker-compose.yml`, Paystack webhook URL

---

## 7. Consistency Checklist

| Item | Status |
|------|--------|
| Admin generation settings save & invalidate cache | ✅ |
| User branding can reset to platform default | ✅ |
| Plan slugs match planFeatures | ✅ |
| Admin plan override works | ✅ |
| User upgrade flow (Paystack) works | ✅ |
| Settings tabs link correctly | ✅ |
| Platform admin nav links work | ✅ |
