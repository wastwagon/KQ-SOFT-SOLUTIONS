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
| `PAYSTACK_SECRET_KEY` | For billing | Paystack live secret key |
| `PAYSTACK_WEBHOOK_SECRET` | For billing | Webhook signature secret |
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
3. Copy the webhook secret to `PAYSTACK_WEBHOOK_SECRET`

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
