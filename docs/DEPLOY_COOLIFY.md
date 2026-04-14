# Deploy on a VPS with Coolify (Docker Compose)

This project ships these Compose files:

| File | Use |
|------|-----|
| `docker-compose.yml` | **Default / Coolify:** includes `docker-compose.prod.yml` (production images). |
| `docker-compose.prod.yml` | Production stack definition (same services as default compose). |
| `docker-compose.development.yml` | Local development (hot reload, `Dockerfile.development`). |

Repository: [https://github.com/wastwagon/kqsoftwaresolutions](https://github.com/wastwagon/kqsoftwaresolutions)

## 1. Push code to GitHub

From the project root (first time):

```bash
git init
git add .
git commit -m "Initial commit: Bank Reconciliation SaaS"
git branch -M main
git remote add origin https://github.com/wastwagon/kqsoftwaresolutions.git
git push -u origin main
```

If the remote already exists:

```bash
git remote set-url origin https://github.com/wastwagon/kqsoftwaresolutions.git
git push -u origin main
```

Do not commit `.env` files; configure secrets in Coolify.

## 2. Coolify: create a Docker Compose resource

1. **New resource** → **Docker Compose** (or your Coolify version’s equivalent).
2. **Repository:** `wastwagon/kqsoftwaresolutions` (or full Git URL).
3. **Branch:** `main`.
4. **Compose file path:** `docker-compose.yml` **or** `docker-compose.prod.yml` (both are the **production** stack). Do **not** point Coolify at `docker-compose.development.yml`.

Requires **Docker Compose v2.20+** (`include` support). If your server is older, set the path to **`docker-compose.prod.yml`** only.

### Coolify restarts / dev images / “Prisma schema not found”

If Coolify builds **`Dockerfile.development`** (log shows `load build definition from Dockerfile.development`), the resource is using the **development** compose file, or an old checkout where `docker-compose.yml` was dev-only.

**Fix:** Use compose file **`docker-compose.yml`** (current default includes production) or **`docker-compose.prod.yml`** directly, then redeploy.

Coolify may still inject build `ARG`s into Dockerfiles; that is fine as long as **`build.dockerfile`** in compose is **`Dockerfile`** (production) for `api` and `web`.

## 3. Required environment variables

Set these in Coolify for the **stack** (or per-service, depending on Coolify):

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Strong secret (32+ characters). Required in production. |
| `VITE_API_URL` | **Public** API base URL **without** trailing slash, e.g. `https://api.yourdomain.com`. Baked into the web build. |
| `CORS_ORIGIN` | **Public** web app URL(s), comma-separated, e.g. `https://app.yourdomain.com`. |

## 4. Domains and ports

- **Web** service listens on **80** inside the container (`WEB_PORT` maps host → 80, default host `80`).
- **API** listens on **9001** (`API_PORT` default `9001`).

In Coolify, attach:

- One domain to the **web** service (HTTPS → container port **80**).
- One domain to the **api** service (HTTPS → container port **9001**).

`VITE_API_URL` must match the **API** URL users see in the browser (same scheme and host you configured).

## 5. After changing `VITE_API_URL`

The frontend embeds `VITE_API_URL` at **build** time. If you change the API URL, **rebuild** the `web` service (redeploy / rebuild image).

## 6. Optional variables

See `.env.example` at the repo root: Paystack, Resend email, `APP_URL`, `API_BASE_URL`, `POSTGRES_PASSWORD`, `PLATFORM_ADMIN_EMAILS`, OCR/PDF tuning, etc.

## 7. Database and uploads

- Postgres data: Docker volume `postgres_data`.
- Uploaded documents: volume `uploads_data` mounted at `/app/uploads` in the API container.

## 8. Paystack webhooks

Configure the webhook URL in Paystack to:

`https://<your-api-domain>/api/v1/subscription/webhook`

## 9. Smoke test

1. Open the web URL → register or log in.
2. Open `https://<api-domain>/health` (JSON `{ "status": "ok" }`) or trigger login from the app.
3. Create a project and upload a small test file.

If anything fails, check Coolify logs for `api` (migrations, `JWT_SECRET`) and `web` (wrong `VITE_API_URL` → API calls go to the wrong host).
