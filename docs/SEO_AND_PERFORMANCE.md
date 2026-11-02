# SEO & web performance — review (2026)

**Production site:** [https://kqsoftwaresolutions.com/](https://kqsoftwaresolutions.com/)  
**App:** React SPA (Vite); marketing at `/`, app behind auth.

---

## SEO — what we optimized

### Target queries (Ghana-facing)

| Intent | Phrases to use in copy & meta |
|--------|-------------------------------|
| Core product | bank reconciliation, **Bank Reconciliation Statement (BRS)**, cash book, bank statement |
| Geography | Ghana, GHS, Paystack, Accra, accounting firms, GRA good records (supporting only) |
| Banks | Ecobank, GCB, Stanbic, Access, Zenith, CalBank, ADB, Prudential |
| Avoid for SEO hero | “workspace”, “modern finance teams worldwide”, generic SaaS jargon without BRS |

### Implemented

| Item | Location |
|------|----------|
| Default `<title>` / description / keywords / canonical / absolute `og:image` | `web/index.html` |
| `lang="en-GH"`, single hero image preload (LCP) | `web/index.html` |
| `robots.txt` — allow `/`, disallow app shells | `web/public/robots.txt` |
| `sitemap.xml` — `/`, `/register`, `/privacy`, `/terms` | `web/public/sitemap.xml` |
| Per-route title, description, canonical, OG, JSON-LD | `PublicPageSeo.tsx` + `publicSeo.ts` |
| Landing H1 + hero aligned with Ghana + BRS | `Landing.tsx` |
| Schema.org `Organization` + `SoftwareApplication` | Landing JSON-LD |
| Legal pages meta | `Privacy.tsx`, `Terms.tsx` |
| Register indexable; login **noindex** | `Register.tsx`, `Login.tsx` |
| Static H1 + JSON-LD in `index.html` (no-JS crawlers) | `web/index.html` |
| Sitemap regenerated on prebuild | `scripts/generate-sitemap.mjs` |
| Optional full HTML prerender after build | `npm run prerender` → `dist/**/index.html` |
| PWA manifest description | `vite.config.ts` |

### Optional next (ops / CI)

- **Google Search Console** + **Bing Webmaster** — submit sitemap URL.
- Run **`npm run build:seo`** in CI (needs Playwright Chromium) before deploy for prerendered marketing HTML.
  - Local: `npm run test:e2e:install-browsers` then `npm run prerender`, or `PLAYWRIGHT_CHANNEL=chrome npm run prerender` if Google Chrome is installed.
- **Blog / help** on subdomain or `/blog` for long-tail (“how to prepare BRS Ghana”).
- Set **`VITE_PUBLIC_SITE_URL`** in production if staging host differs from canonical.

---

## Performance — current profile

### Marketing images (WebP)

| Step | Detail |
|------|--------|
| Generate | `npm run marketing-images` (also runs on `npm run build` prebuild) |
| Component | `MarketingPhoto.tsx` — `<picture>` WebP + JPEG fallback |
| LCP preload | Hero WebP in `index.html` |
| OG/social | Keep **JPEG** URLs in meta (broad crawler support) |

Typical savings: ~35–55% vs JPEG at quality 82 (hero **110 KB** WebP vs **325 KB** JPEG).

### JavaScript (production build, lazy routes)

| Chunk | ~Size | Notes |
|-------|-------|--------|
| Main entry | ~291 KB (~89 KB gzip) | React shell; `manualChunks` splits query/router |
| `xlsx` | ~430 KB | Loaded only on export/import routes |
| `jspdf` + `html2canvas` | ~350 KB + ~200 KB | Dynamic `import()` in export libs |
| `ProjectReconcile` | ~90 KB | Largest app route |
| `UserManual` | ~160 KB | In-app manual markdown |

**Implemented:** `manualChunks` in `vite.config.ts` keeps `xlsx`, `pdf` (jspdf/html2canvas), `query`, `router` out of the initial entry where possible.

### PWA / caching

- Service worker precaches static assets (`vite-plugin-pwa`); API uses **NetworkOnly** (correct for auth data).
- `start_url: /dashboard` — logged-in PWA opens app; marketing SEO unaffected.

### Core Web Vitals (checklist)

1. **LCP** — hero **WebP** preloaded once; avoid second competing preload (removed product-match preload from `index.html`).
2. **INP** — reconcile grid is heaviest UI; keep virtualisation on backlog if lists >500 rows feel sluggish.
3. **CLS** — marketing uses fixed aspect containers on product shots; verify on real devices after deploy.

**Measure after deploy:**

```bash
cd web && npm run build && npx vite preview
# Lighthouse (Chrome DevTools) on / in mobile mode
```

Or PageSpeed Insights against production URL.

---

## Env

| Variable | Purpose |
|----------|---------|
| `VITE_PUBLIC_SITE_URL` | Canonical host for OG URLs and `PublicPageSeo` (default `https://kqsoftwaresolutions.com`) |

---

## Maintenance

- When pricing or Ghana bank list changes, update **Landing FAQ** + `index.html` description if needed.
- Regenerate or hand-edit **sitemap.xml** when new public routes ship (`npm run sitemap`, also runs on prebuild).
- After large marketing image changes, re-run Lighthouse on `/`.

Related: `docs/GHANA_PLAIN_LANGUAGE_GUIDE.md` (wording), `docs/DEPLOY_COOLIFY.md` (production URL).
