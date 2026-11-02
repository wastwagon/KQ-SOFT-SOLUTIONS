# KQ-SOFT Solutions  
## Pricing & packaging brief for stakeholders

**Product:** Bank reconciliation and BRS delivery for accounting firms and in-house finance teams (not a full general ledger — works alongside Tally, Sage, and similar)  
**Market:** Ghana (billing in GHS via Paystack)  
**Document date:** November 2026  
**Status:** Production — **Platform admin → Plans** and **Pricing page layout** are the source of truth for public prices, limits, marketing copy, and comparison tables. This brief describes the default seed lineup; verify live data at `GET /api/v1/public/plans` or **/#pricing**.

---

## Executive summary

KQ-SOFT is positioned as **end-to-end bank reconciliation**: upload cash book and bank statement, match with intelligence, approve, and publish a **defensible BRS** (Excel/PDF) with audit trail.

**Commercial strategy in one line:** Keep **competitive list prices** and a **credible Free tier**, grow revenue through **workspace limits** (projects, transactions, bank accounts, seats, clean exports) and **team/control features**, and **enforce plan limits in the product** so the website, checkout, and day-to-day use stay aligned.

**Paid entry point:** **GHS 199/month** (Solo). Checkout is always in **GHS through Paystack**; optional USD/EUR/GBP on the website are **reference only**.

---

## Who each package is for

| Package | Typical buyer | Monthly list (GHS) | Headline limits |
|--------|----------------|---------------------|-----------------|
| **Free** | Trial / very small use | 0 | 1 user · 1 bank · 300 tx/mo · 3 projects/mo |
| **Solo** | Individual accountant | **199** | 1 user · 3 banks · 3,000 tx/mo · 12 projects/mo |
| **Team** | Small finance team | **399** | 5 users · 10 banks · 15,000 tx/mo · 40 projects/mo |
| **Firm** | Established practice | **990** | 10 users · 30 banks · 40,000 tx/mo · 100 projects/mo |
| **Custom** | Large firm / enterprise | From **~1,800** (contract) | Unlimited-style quotas · API · onboarding · SLA |

**Billing periods:** Monthly, quarterly (~5% off), or yearly (save up to ~17%).  
**Self-serve Paystack checkout:** Any CMS plan with active self-serve prices (typically Solo, Team, Firm list prices). **Custom / contract** tiers are sales-led (zero checkout price or `firm` slug).

**Admin:** `/platform-admin/plans` (packages, drag order), `/platform-admin/pricing-page` (comparison sections), `/platform-admin/organizations` (plan filter from CMS).

---

## What differentiates each tier (features, not just numbers)

### Free — “prove it on a real rec”

- Full import path (Excel, CSV, PDF, OCR) and auto-match suggestions  
- BRS export with **watermarked / sample** clean downloads  
- **Bulk confirm up to 10 pairs** per action  
- **Partial** review tools: 5-row discrepancy preview, limited missing-cheques rows, **14-day** activity log  

**Goal:** Let prospects complete a real reconciliation without a card; caps create a natural upgrade when they run multiple clients or need clean client deliverables.

### Solo (GHS 199) — “paid professional”

Everything in Free, plus:

- **5 full clean exports/month**, higher project and transaction quotas  
- **Split & many-to-many** matching, **roll-forward** across periods  
- **AI match ranking** from confirmed history  
- **Full** discrepancy and missing-cheques reports  
- **Up to 5 bank rules**; bulk confirm **up to 50 pairs**  
- Bookkeeping advisory positioning on marketing materials  

**Goal:** Default paid SKU for sole practitioners and side practices.

### Team (GHS 399) — “collaborate and brand” *(highlight tier)*

Everything in Solo, plus:

- **5 seats**, more banks and exports  
- **Full bank rules engine** (not capped at 5)  
- **Audit trail export**, **logo & report branding**  
- **Approval threshold warning** before sign-off  

**Goal:** Small teams that need shared work, client-ready reports, and reviewer visibility.

### Firm (GHS 990) — “control and throughput”

Everything in Team, plus:

- **10 seats**, higher limits, **60 clean exports/month**  
- **Threshold can block reviewer approval** (hard control)  
- **Priority support**, bulk confirm **up to 100 pairs**  
- Firm dashboard on home  

**Goal:** Practices with formal prep/review/approve and higher volume.

### Custom — “platform & contract”

Everything in Firm, plus:

- **Unlimited**-style projects, exports, banks, and seats (contractual)  
- **Public REST API** for firm automation  
- Personalised onboarding, **4-hour SLA** narrative, custom contract  

**Goal:** Multi-client firms and integrators; not self-serve downgrade/upgrade through Paystack alone.

---

## Pricing philosophy (for board / partners)

1. **Do not strip tier features on downgrade** — use **partial vs full** and **numeric caps** (bulk pairs, audit rows, rules count) so the story stays “we don’t remove capabilities unfairly,” while economics stay protected in code.

2. **Free is marketing + product-led growth**, not a crippled demo.

3. **List prices held** — differentiation is limits and depth, not headline price cuts.

4. **GHS-first** — aligns with Paystack and local buyers; foreign currency on the landing page is indicative only.

5. **Upgrade = immediate value** (more seats, banks, exports, control). **Downgrade = scheduled at period end** so revenue and customer expectations stay fair.

---

## Subscription behaviour (customer-facing promises)

| Action | Behaviour |
|--------|-----------|
| **Upgrade** | Paystack checkout in GHS; **unused time on current plan can reduce** the upgrade charge (proration credit). |
| **Downgrade** | **Scheduled for end of billing period** via Billing — not instant cheap checkout to a lower tier. |
| **After downgrade** | Org may exceed new **seat**, **bank account**, or **bank rule** caps; product **enforces** (locked banks, paused rules, seat limit for non-admins). Admins retain access to billing and settings. |
| **API keys** | Plans CMS **`api_access`** flag (typically Custom / `firm`) — not hardcoded to one slug. |

Optional launch promo (if enabled in environment): **50% off first 2 months** on self-serve paid tiers — confirm with operations before advertising.

---

## Competitive messaging (use externally)

- **“Free plan included · Paid plans from GHS 199/mo · No card required”** to start.  
- **Pre-built bank layouts** for major Ghana banks plus generic Excel/CSV/PDF.  
- **Audit-ready BRS** — branded exports, sign-off states, discrepancy and activity trail on higher tiers.  
- **Team** positioned as **most popular** for collaboration and branding.

---

## Pre go-live checklist (internal)

1. **API + web running** (e.g. API `9001`, web `9100` with proxy, or production URLs).  
2. Open **/#pricing** — plan cards, comparison table, and **Reference pricing** match this brief. Confirm `GET /api/v1/public/fx-rates` returns `source: live` or `manual` (not only client fallback).  
3. Sign in → **Settings → Billing**: upgrade copy, proration credit, schedule/cancel downgrade, usage meters (projects, transactions, banks, clean exports).  
4. **Dashboard** — plan-usage warnings appear when near caps; **New project** blocks at monthly project limit.  
5. After deploy, confirm **Plans CMS** and **`npx prisma migrate deploy`** — database entitlements and marketing drive checkout, usage caps, and the landing page (no stale hardcoded tier list in admin).  
6. From repo root: `npm test -- --run` (API), `npm run build --prefix web`, `npm run test:e2e:smoke` (Playwright). Optional: `./scripts/verify-go-live.sh` with Postgres up; `--with-live-api` for `/healthz` and smoke create.  
7. Push latest release to production when satisfied.

---

## Contact

**KQ-SOFT Solutions**  
Web: https://kqsoftwaresolutions.com  
Email: info@kqsoftwaresolutions.com  

*Default seed values below. Runtime pricing, limits, and copy come from the Plans CMS; this brief is a stakeholder snapshot — reconcile with the live public plans API before external commitments.*
