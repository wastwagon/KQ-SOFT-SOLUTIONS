# Production Deployment Guide

## Pre-Launch Checklist

### 1. Environment Variables

Set these **before** starting the API in production:

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | **Yes** | Strong secret (min 32 chars). App exits if missing or `dev-secret` in production. |
| `CORS_ORIGIN` | **Yes** | Frontend URL(s), comma-separated. Example: `https://app.yourdomain.com` |
| `DATABASE_URL` | **Yes** | PostgreSQL connection string |
| `NODE_ENV` | **Yes** | Set to `production` |
| `API_BASE_URL` | Recommended | Base URL for API (logos, links). Example: `https://api.yourdomain.com` |
| `UPLOAD_DIR` | Optional | Upload directory (default: `./uploads`) |
| `MAX_UPLOAD_SIZE_MB` | Optional | Max file size in MB (default: 10) |
| `PAYSTACK_SECRET_KEY` | For billing | Paystack live secret key (also used to verify webhook HMAC) |
| `APP_URL` | For reset + checkout return | Public SPA URL. Paystack redirects here `/settings/billing` after payment |
| `PLATFORM_ADMIN_EMAILS` | For admin | Comma-separated admin emails |
| `RESEND_API_KEY` | For reset | Enables password reset emails |
| `APP_URL` | For reset | Base URL for reset links |

### 2. Database

```bash
cd api
npx prisma migrate deploy
npx prisma db seed  # Optional: seed plans, platform settings
```

The API also refuses to start without `DATABASE_URL` (see `api/start-api.sh`). If migrations still did not run on the server, a **platform admin** can use **Platform Admin → Database** in the web app to run `migrate deploy` and `db seed` against the same `DATABASE_URL` (see `docs/DEPLOY_COOLIFY.md`).

### 3. Paystack Webhook

1. In Paystack Dashboard → Settings → Webhooks
2. Add URL: `https://your-api-domain.com/api/v1/subscription/webhook`
3. Leave `PAYSTACK_WEBHOOK_SECRET` unset (or set it to the same value as `PAYSTACK_SECRET_KEY`). Paystack does **not** issue a Stripe-style `whsec_` secret; signatures are HMAC SHA512 of the raw body using the secret key.
4. Set `APP_URL` to the public web app so checkout can send `callback_url` (`/settings/billing`). Optional dashboard callback: `https://your-api-domain.com/api/v1/subscription/callback`.

### 4. Security

- **JWT_SECRET**: Generate with `openssl rand -base64 32`
- **CORS**: Only add your frontend domain(s)
- **HTTPS**: Use TLS in production
- **File uploads**: Stored in `UPLOAD_DIR`; filenames are sanitized

### 5. Rate Limiting

- Auth endpoints: 30 requests per 15 min per IP
- API keys: Per-key rate limit from platform settings (default 100/min)

### 6. Build & Start

```bash
# API
cd api && npm run build && npm start

# Web (static build)
cd web && npm run build
# Serve dist/ with nginx, Vercel, etc.
```

### 7. Health Check

`GET /health` returns `{ status: "ok", service: "brs-api" }`

### 8. Web app (PWA + nginx)

The production web image (`web/Dockerfile`) serves `dist/` with `web/nginx.default.conf`. After deploy:

- **Service worker** (`/sw.js`) and **Workbox** bundles must not be cached as long-lived immutable assets — the bundled nginx config sets `Cache-Control: no-cache` for those paths.
- **Manifest**: `manifest.webmanifest` is generated at build time (`vite-plugin-pwa`). Icons: `pwa-icon-192.png`, `pwa-icon-512.png` (regenerated via `npm run icons` / `prebuild`).
- **Install**: Users can add KQ-SOFT to the home screen (iOS Safari / Android Chrome). Offline: the app shell is precached; API calls require network.
- **Verify**: `cd web && npm run build && npm run preview`, then Chrome DevTools → Application → Manifest & Service workers. Optional: `npm run test:e2e:smoke`.

Project workflow deep links use path segments, e.g. `/projects/{slug}/reconcile` (legacy `#reconcile` hashes redirect automatically).

**Reopen (completed / approved / submitted for review):**

| Action | API `PATCH /projects/:id/reopen` | Result |
|--------|----------------------------------|--------|
| Reopen matching | `{ "mode": "reconcile" }` (default) | Status `reconciling` — adjust pairs; sign-off cleared |
| Replace source files | `{ "mode": "sources" }` | Status `mapping` — upload/map again; sign-off cleared |

Uploads are allowed while status is `draft` or `mapping` only (auto-map after the first file must not block the second statement).

**Admin pricing:** Plan updates accept all canonical slugs including `free`. After changing prices in Platform Admin, redeploy is not required — invalidate happens via API; hard-refresh the marketing site if a CDN caches `/api/v1/public/plans`.

**Workspace assistant (⌘K):** Natural-language queries call `POST /api/v1/workspace/agent-search` when the org has `ai_suggestions`. Set `OPENAI_API_KEY` on the API (optional `OPENAI_MODEL`, `OPENAI_BASE_URL` for compatible providers). Disable with `WORKSPACE_AGENT_SEARCH=0`. Suggestions are constrained to an allowlist built from the user’s projects, clients, and plan features.

---

## Docker

```bash
docker-compose up -d
```

Ensure `docker-compose.yml` uses production env vars. For production, consider:
- Separate `docker-compose.prod.yml` with production settings
- Volume for `UPLOAD_DIR`
- External PostgreSQL

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "JWT_SECRET must be set" | Set `JWT_SECRET` in .env; ensure `NODE_ENV=production` |
| CORS errors | Add frontend URL to `CORS_ORIGIN` |
| Paystack webhook fails | Verify URL, secret; check webhook logs in Paystack |
| File upload fails | Check `UPLOAD_DIR` exists and is writable |
| Upload blocked after first file | Ensure API + web are on the same release (upload lock is status-based: `draft`/`mapping` only) |
| Cannot save Free plan pricing | API must allow `slug: free` on plan PUT; check admin API response in Network tab |
| Reopen but still can’t upload | Use **Replace source files** (not Reopen matching); status must be `mapping` |
