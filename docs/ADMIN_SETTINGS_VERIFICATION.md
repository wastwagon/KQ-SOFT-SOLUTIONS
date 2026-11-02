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
| `/platform-admin/plans` | AdminPlans | Plans CMS (any slug, marketing, drag reorder) |
| `/platform-admin/pricing-page` | AdminPricingPage | Landing comparison sections (drag reorder) |
| `/platform-admin/pricing-page` | AdminPricingPage | Landing comparison sections & extra flags |
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
| API keys | Gated by plan feature `api_access` (CMS) |
| Bank rules | Gated by plan feature `bank_rules` (CMS) |

### Branding ↔ Platform Defaults

- **New orgs:** Branding initialised from platform defaults at registration
- **Existing orgs:** Can now "Reset to platform default" to apply report title, footer, colours from platform
- **API:** `GET /settings/platform-defaults` returns `defaultCurrency`, `reportTitle`, `footer`, `primaryColor`, `secondaryColor`

---

## 3. Plans & Subscriptions

### Plan slugs (CMS)

- **Platform admin → Plans:** Create/edit any slug (`^[a-z][a-z0-9_-]*$`), display name, quotas, prices, marketing JSON, `sortOrder`, `showOnPublic`.
- **Public site:** `GET /api/v1/public/plans` and landing pricing use DB plans (offline fallback in `web/src/lib/plans.ts` if API is down).
- **Legacy slugs** `free`, `basic`, `standard`, `premium`, `firm` remain the default seed; runtime entitlements merge CMS feature flags with `planFeatures.ts` catalogue.

### Subscription flow

1. **User upgrade:** Settings → Billing → self-serve plans from CMS (`isSelfServePlan`) → Paystack → webhook updates `org.plan`.
2. **Downgrade:** Schedule at period end using CMS `sortOrder` (not a fixed tier enum).
3. **Contract billing:** `firm` or zero-price non-free plans — no self-serve checkout; subscription stays active without Paystack.
4. **Admin override:** AdminOrgDetail / Organizations list — set plan directly (no payment).

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
| Admin plans CMS + pricing layout | `admin/plans.ts`, `admin/pricing-page.ts`, `AdminPlans.tsx`, `AdminPricingPage.tsx` |
| Org list plan filter from CMS | `admin/organizations.ts` (`paid` = self-serve slugs from DB) |

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
| Plan slugs match planFeatures | ✅ CMS slugs + runtime ranks; catalogue thresholds use canonical seed slugs |
| Paystack uses CMS checkout plans | ✅ `isCheckoutPlanSlug` |
| Usage returns CMS display name | ✅ `planDisplayName`, `contractBilling` |
| Admin plan override works | ✅ |
| User upgrade flow (Paystack) works | ✅ |
| Pricing CMS audit reference | ✅ `docs/PRICING_CMS_AUDIT.md` |
| Settings tabs link correctly | ✅ |
| Platform admin nav links work | ✅ |
