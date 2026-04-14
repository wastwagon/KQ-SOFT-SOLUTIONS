# Design Tokens — Premium Light Theme

Single premium light theme for Ghana-acceptable BRS and dashboards.

---

## Colour

| Token | Value | Use |
|-------|--------|-----|
| **Primary** (brand) | `#16a34a` (green) | Nav active, primary buttons, report org name, key totals. Overridable per org in Settings > Branding. |
| **Primary 50–900** | Tailwind primary scale | Backgrounds, hovers, borders (primary-50, primary-100, etc.). |
| **Secondary** | From org branding (e.g. `#15803d`) | Section headers, accents, secondary buttons. Stored in branding; use in report. |
| **Success** | green-50, green-700, green-800 | Matched count, positive states. |
| **Warning / Amber** | amber-50, amber-700, amber-800 | Unmatched counts, ageing bands, alerts. |
| **Error** | red-50, red-600, red-700 | Errors, destructive actions. |
| **Surface** | `#f8fafc` (slate-50) | Page background. |
| **Surface elevated** | `#ffffff` | Cards, modals. |
| **Border** | `#e2e8f0` (slate-200) | Card borders, table borders. |
| **Border muted** | `#f1f5f9` (slate-100) | Subtle dividers. |
| **Text primary** | gray-900 | Headings, body. |
| **Text secondary** | gray-600, gray-500 | Labels, hints. |

---

## Typography

- **Font stack:** `font-sans` — system-ui, Inter (if loaded), fallback sans.
- **Report title:** text-lg to text-xl, font-bold.
- **Section heading:** text-base to text-lg, font-medium.
- **Table header:** text-sm, font-medium, text-gray-700.
- **Body / table cell:** text-sm, text-gray-900.

Defined in `web/src/index.css` and `tailwind.config.js`.

---

## Spacing & layout

- **Card padding:** p-4 (sm), p-6 (report sections).
- **Section gap:** space-y-6 or mb-6.
- **Table cell:** px-3 py-2 (or px-2 py-1.5 for compact).

---

## Radius & shadow

- **Radius:** `--radius-sm` (0.375rem) to `--radius-xl` (1rem). Cards: rounded-lg.
- **Shadow:** `--shadow-card` for cards; `--shadow-card-hover` on hover.

---

## Formatting (Ghana)

- **Dates:** `formatDate()` — DD MMM YYYY (e.g. 31 Dec 2024). BRS title: DD-MMM-YYYY (e.g. 31-DECEMBER-2024).
- **Amounts:** `formatAmount(amount, currency)` — symbol + en-GB number (e.g. GH₵61,131.32).
- **Currency default:** GHS (GH₵).

See `web/src/lib/format.ts` and `web/src/lib/currency.ts`.

---

## Where tokens are used

| Token / area | Where used |
|--------------|------------|
| **Primary** | AppLayout nav active, primary buttons, report org name & key totals, PDF org name, link focus rings. |
| **Secondary** | Report section headers (Summary, Notes, Supporting documents) when `branding.secondaryColor` is set. |
| **Surface** | Page background (`bg-surface`), table headers (`bg-surface`), EmptyState icon container. |
| **Border / border-muted** | Card borders, table borders, dividers, sidebar/header borders, form inputs. |
| **shadow-card / shadow-card-hover** | Card, MetricCard, Dashboard manage cards, Projects status chips, Supporting documents table. |
| **Radius** | Cards `rounded-lg`, inputs `rounded-lg`. |
| **Format helpers** | All pages and exports use `formatDate`, `formatDateBRSTitle`, `formatAmount` from `web/src/lib/format.ts`. |
