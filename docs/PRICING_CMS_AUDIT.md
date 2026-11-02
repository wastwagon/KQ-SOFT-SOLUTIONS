# Pricing & plans CMS — audit checklist

**Last sweep:** November 2026  
**Source of truth:** Platform admin **Plans**, **Pricing page layout**, and PostgreSQL `Plan` rows. Public site reads `GET /api/v1/public/plans` (60s cache). Offline fallback: `web/src/lib/plans.ts` → `MARKETING_PLANS` only when that API fails.

---

## Wired to CMS (runtime)

| Area | Behaviour |
|------|-----------|
| Public landing pricing | API plans + pricing_page comparison groups; contact-sales prices from CMS tagline |
| Paystack checkout / webhook | `isCheckoutPlanSlug` + `isSelfServePlan` (not fixed slug list) |
| Usage & quotas | Plan table + trial → Free caps (`usage.ts`) |
| Downgrades | `sortOrder` via `isSelfServeDowngrade`; schedule any valid slug |
| Contract billing | `isContractBillingPlan` — blocks self-serve checkout/schedule; keeps subscription active |
| Feature flags | Plan.features JSON + runtime entitlements |
| Feature depth ranks | `replacePlanSlugRanks` from CMS `sortOrder` |
| Bulk/audit numeric caps | Rank vs canonical `free` / `basic` / `premium` / `firm` thresholds |
| Admin org list filter | `paid` = self-serve slugs from DB; per-slug filter any CMS slug |
| Admin UI plan labels | `usePlanDisplayNames` / `planDisplayName` on usage API |
| Complimentary grant | Highest paid slug before `firm` (`complimentaryPlanSlug`) |
| Plan reorder | `PUT /admin/plans/reorder` → `sortOrder` |

---

## Intentional catalogue defaults (not live prices)

| Location | Role |
|----------|------|
| `api/src/config/planFeatures.ts` | Which **feature** unlocks at which **canonical** tier slug (partial/full depth); overridden by CMS boolean flags |
| `api/src/config/subscription.ts` | Fallback limits/prices if a slug missing from DB |
| `web/src/lib/plans.ts` `MARKETING_PLANS` | Offline marketing fallback |
| `web/src/lib/plans.ts` `PUBLIC_PLAN_NAMES` | Fallback display names when CMS name unknown |
| `web/src/lib/planRank.ts` `PLAN_ORDER` | Fallback ordering when `planOrder` not loaded |
| Seed scripts / demo orgs | Fixed test slugs (`basic@test.com`, etc.) |

---

## Marketing copy (editable in CMS; static text OK elsewhere)

- **Tagline + lead bullet** on pricing cards follow numeric **Projects / TX / seats / banks** at API serve time (`syncMarketingQuotaProse`), on **Save** in Platform admin → Plans, and again when rendering cards (`planPricingCardCopy` on landing).
- Comparison-table **limit rows** always follow quotas when the site loads (`applyQuotaToMarketingMatrix`).
- Landing FAQ paragraphs and hero copy still mention Solo/Team/Firm **as examples** — update in Plans marketing or FAQ content when positioning changes.
- `planFeatures.ts` catalog **hints** (e.g. “Solo and above”) are admin UI labels only.

---

## Deploy checklist

1. `cd api && npx prisma migrate deploy`
2. Confirm platform admin **Plans** match go-live pricing (prices, limits, marketing, sort order, show on public).
3. Save **Pricing page layout** if comparison sections changed.
4. Deploy API (plan cache + slug ranks load at startup via `refreshPlanCache`).
5. Deploy web build.
6. Smoke: `/#pricing`, sign-in → Settings → Billing, one Paystack test on a self-serve slug.
7. Optional: `GET /api/v1/public/plans` and `GET /subscription/usage` (auth) — verify `planDisplayName`, `contractBilling`.

---

## Related docs

- `docs/STAKEHOLDER_PRICING_BRIEF.md` — business snapshot (reconcile with live CMS before external use)
- `docs/ADMIN_SETTINGS_VERIFICATION.md` — admin vs user settings flows
