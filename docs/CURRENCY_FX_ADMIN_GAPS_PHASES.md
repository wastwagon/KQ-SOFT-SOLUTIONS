# Currency Conversion & Admin Settings — Gap Implementation Phases

**Purpose:** Add free API currency conversion, cross-check admin manual currency settings, and fix admin→project currency linkage.

---

## Current State

| Feature | Status | Gap |
|---------|--------|-----|
| **Multi-currency display** | ✅ GHS, USD, EUR | Display only; no conversion |
| **Admin defaultCurrency** | ✅ In Generation Settings | **Not used** by ProjectNew (hardcodes GHS) |
| **Manual exchange rates** | ❌ Not implemented | No admin override for rates |
| **Free FX API** | ❌ Not implemented | No conversion between currencies |

---

## Phase 1 — Admin defaultCurrency → ProjectNew (Low Risk)

**Gap:** Admin sets `defaultCurrency` in Platform Admin → Generation Settings, but ProjectNew always starts with `'GHS'`.

**Fix:** ProjectNew fetches admin generation settings (or a lightweight endpoint) and uses `defaultCurrency` as initial value when creating a new project.

### Deliverables
- [ ] Add GET `/api/v1/settings/default-currency` (or use existing admin settings for org users — need a non-admin endpoint)
- [ ] **Alternative:** Add GET `/api/v1/platform-defaults` returning `{ defaultCurrency }` — callable by any authenticated user (read-only platform defaults)
- [ ] ProjectNew: fetch defaultCurrency on mount, set `currency` state from it
- [ ] Fallback to 'GHS' if fetch fails

### Files
- `api/src/routes/settings.ts` or new `platform-defaults.ts`
- `web/src/pages/ProjectNew.tsx`
- `web/src/lib/api.ts`

### Risk
Low. Backward compatible.

---

## Phase 2 — Free API Currency Conversion (Medium Risk)

**Gap:** No FX conversion. Users with mixed-currency projects cannot convert amounts.

**Approach:** Use **ExchangeRate-API** free tier (no key for open access) or **Frankfurter** (GHS not in Frankfurter’s 31 currencies — use ExchangeRate-API).

- **ExchangeRate-API:** `https://api.exchangerate-api.com/v4/latest/GHS` — supports GHS, USD, EUR. Free, no key. Rate limit: ~1 req/day for open access; or use API key for 1,500 req/month free.
- **Attribution:** Required per their terms.

### Deliverables
- [ ] Create `api/src/services/currencyConversion.ts`:
  - `getRates(base: 'GHS'|'USD'|'EUR'): Promise<{ USD, EUR, GHS }>`
  - Cache in memory (TTL 24h or configurable)
  - Fallback to manual rates if API fails
- [ ] Add `convert(amount: number, from: string, to: string, rates?: object): number`
- [ ] Optional: GET `/api/v1/currency/rates` for frontend (display converted amounts)

### Use cases
- **Report:** "Show BRS totals in USD" when project is GHS (optional toggle)
- **Dashboard:** Aggregate across projects in different currencies
- **Future:** Multi-currency cash book (Phase 4+)

### Files
- `api/src/services/currencyConversion.ts`
- `api/src/routes/currency.ts` (optional)
- `api/src/lib/currency.ts` (extend with convert)

### Risk
Medium. API can fail; must have fallback. Cache to avoid rate limits.

---

## Phase 3 — Admin Manual Exchange Rates (Low Risk)

**Gap:** No admin override for exchange rates. When API is down or for audit/compliance, admin cannot set manual rates.

### Schema
Add to `PlatformSettings` (key `generation` or new key `currency`):

```json
{
  "manualRates": {
    "GHS_USD": 0.0925,
    "GHS_EUR": 0.0796,
    "USD_GHS": 10.81,
    "EUR_GHS": 12.56
  },
  "useManualRatesOnly": false
}
```

- `useManualRatesOnly: true` → skip API, use only manual rates
- `useManualRatesOnly: false` → use API; fallback to manual if API fails

### Deliverables
- [ ] Extend admin generation schema: `manualRates?: Record<string, number>`, `useManualRatesOnly?: boolean`
- [ ] AdminGenerationSettings UI: section "Manual exchange rates (override)"
  - Inputs: GHS→USD, GHS→EUR, USD→GHS, EUR→GHS (or derive inverse)
  - Checkbox: "Use manual rates only (disable API)"
- [ ] `currencyConversion.ts` reads manual rates first when `useManualRatesOnly`, else uses API with manual fallback

### Files
- `api/src/routes/admin/settings.ts`
- `api/src/services/currencyConversion.ts`
- `web/src/pages/admin/AdminGenerationSettings.tsx`

### Risk
Low. Optional; defaults to API.

---

## Phase 4 — Cross-Check Admin Settings (Low Risk)

**Gap:** Ensure admin settings are consistent and used correctly across the app.

### Audit checklist
- [ ] **defaultCurrency** — used by ProjectNew (Phase 1)
- [ ] **defaultReportTitle, defaultFooter** — used when creating new orgs or projects (verify)
- [ ] **defaultPrimaryColor, defaultSecondaryColor** — used in report generation (verify)
- [ ] **apiRateLimitPerMin** — used by API key middleware (verify)
- [ ] **approvalThresholdAmount** — in org branding, not platform; Premium+ (verify)
- [ ] **manualRates** — used by currency conversion (Phase 3)

### Deliverables
- [ ] Document which settings apply where
- [ ] Add integration test or manual checklist
- [ ] Fix any missing linkages found

### Risk
Low. Documentation and verification.

---

## Phase 5 — Optional: Report Currency Conversion Toggle (Future)

**Scope:** On BRS Report, add "Show in [USD/EUR]" when project is GHS. Converts displayed totals using current rates.

### Deliverables
- [ ] Report API accepts `?displayCurrency=USD`
- [ ] Frontend toggle: "Display in project currency | USD | EUR"
- [ ] Convert balance per cash book, uncredited, unpresented, bank closing for display only (original values in project currency remain)

### Risk
Medium. Display vs stored amounts must be clear to avoid confusion.

---

## Implementation Order

| Phase | Description | Est. effort |
|-------|-------------|-------------|
| **1** | Admin defaultCurrency → ProjectNew | 1–2 hrs |
| **4** | Cross-check admin settings | 1 hr |
| **3** | Admin manual exchange rates | 2–3 hrs |
| **2** | Free API currency conversion service | 2–3 hrs |
| **5** | Report display currency toggle | 2–3 hrs (optional) |

---

## Free API Options (Phase 2)

| API | Key required | GHS support | Limit |
|-----|---------------|-------------|-------|
| **ExchangeRate-API v4** | No (open) | Yes | ~1/day |
| **ExchangeRate-API v6** | Yes (free) | Yes | 1,500/mo |
| **Frankfurter** | No | No (31 currencies) | Unlimited |
| **Manual only** | — | — | Admin-set |

**Recommendation:** Use ExchangeRate-API v4 open endpoint with 24h cache. Add optional `EXCHANGE_RATE_API_KEY` env for higher limits. Manual rates as fallback.

---

## Attribution (Required)

When using ExchangeRate-API or similar:
- Add "Rates by [ExchangeRate-API](https://www.exchangerate-api.com)" in footer or settings
- Or in API response / report footer when conversion is used
