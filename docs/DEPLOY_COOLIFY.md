# Deploy on a VPS with Coolify (Docker Compose)

This project ships these Compose files:

| File | Use |
|------|-----|
| `docker-compose.yml` | **Default / Coolify:** production stack (inline; no `include` — works on all Compose versions). |
| `docker-compose.prod.yml` | Same production stack (explicit filename); keep in sync with `docker-compose.yml`. |
| `docker-compose.development.yml` | Local development (hot reload, `Dockerfile.development`). |

Repository: [https://github.com/wastwagon/kqsoftwaresolutions](https://github.com/wastwagon/kqsoftwaresolutions)

**Live production app:** [https://kqsoftwaresolutions.com/](https://kqsoftwaresolutions.com/)

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
4. **Compose file path:** `docker-compose.yml` **or** `docker-compose.prod.yml` (both define the same **production** stack). Do **not** point Coolify at `docker-compose.development.yml`.

### `Bind for 0.0.0.0:… failed: port is already allocated`

The production compose file **does not publish** `web` or `api` to the host. Coolify reaches them on the **Docker network** (container ports **80** and **9001**). If you still see this error, Coolify may be merging an old env or custom compose snippet that adds `ports:` — remove duplicate port mappings there.

### `relation "projects" does not exist` (P3018 / migrate deploy)

The migration history in git **starts** with `ALTER TABLE "projects"` — there is **no** older migration that creates base tables. A **new** Postgres volume therefore has an empty `public` schema until something creates tables.

The **`api`** image runs **`start-api.sh`**, which detects this error and **bootstraps** once: `DELETE FROM "_prisma_migrations"`, **`prisma db push`** from `schema.prisma`, then **`prisma migrate resolve --applied`** for each folder under `prisma/migrations`, then **`migrate deploy`** (no-op). This is intended only for **empty / disposable** databases (typical first Coolify deploy).

- **Disable:** set `PRISMA_BOOTSTRAP_EMPTY_DB=0` on the `api` service.
- **Real production data** already in Postgres: do **not** rely on bootstrap; restore from backup or run a proper baseline / hand-managed SQL instead of wiping `_prisma_migrations`.

### API restarts / `P3009` / failed migration `20250228140000_add_project_slug`

Older migration SQL used `"Project"` / `"User"` while the real tables are **`projects`** / **`users`**. That is **fixed in the repo**; the production **API** image runs **`api/start-api.sh`** (not nginx’s `/docker-entrypoint.sh` on the **web** container). On **`P3009`** mentioning `20250228140000_add_project_slug` it runs `prisma migrate resolve --rolled-back` and **retries** `migrate deploy` once. A normal redeploy after pull should recover without manual steps.

**Logs:** Prisma / `start-api:` lines appear under the **`api`** service. Lines like `/docker-entrypoint.sh` and `nginx/1.x` are the **`web`** (nginx) service only.

- **Turn off** auto-recovery: set env `PRISMA_AUTO_RESOLVE_MIGRATIONS=` (empty) on the `api` service.
- **Extra migration names** (comma-separated): `PRISMA_AUTO_RESOLVE_MIGRATIONS=name1,name2`
- If deploy still fails after auto-resolve, fix the underlying error or use **Coolify Terminal**:

```bash
docker compose run --rm --no-deps api npx prisma migrate resolve --rolled-back <migration_name> --schema=./prisma/schema.prisma
```

**Dev-only / empty data:** remove the Postgres volume and redeploy (destructive).

### “Restarting” / many restarts while deploy shows Finished

`docker compose up` succeeding only means containers **started**. The **`api`** process can exit immediately (Docker restarts it) if env is invalid — most often **`JWT_SECRET`** missing, empty, or still `dev-secret`.

1. In Coolify, open **Logs** for the **`api`** service (not **web**).
2. If you see **`start-api: FATAL — JWT_SECRET`** or **`FATAL: JWT_SECRET must be set`**, set **`JWT_SECRET`** in the resource environment to a **strong random string** (32+ characters), redeploy, and confirm it is passed to the **`api`** service (not only as a build argument).

### Coolify restarts / dev images / “Prisma schema not found”

If Coolify builds **`Dockerfile.development`** (log shows `load build definition from Dockerfile.development`), the resource is using the **development** compose file, or an old checkout where `docker-compose.yml` was dev-only.

**Fix:** Use compose file **`docker-compose.yml`** or **`docker-compose.prod.yml`** (both are the production stack), then redeploy.

Coolify may still inject build `ARG`s into Dockerfiles; that is fine as long as **`build.dockerfile`** in compose is **`Dockerfile`** (production) for `api` and `web`.

## 3. Required environment variables

Set these in Coolify for the **stack** (or per-service, depending on Coolify):

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Strong secret (32+ characters). Required in production. |
| `VITE_API_URL` | **Public** API base URL **without** trailing slash, e.g. `https://api.yourdomain.com`. Baked into the web build. |
| `CORS_ORIGIN` | **Public** web app URL(s), comma-separated, e.g. `https://app.yourdomain.com`. |

## 4. Domains and ports

- **Web** listens on **80** inside the container (no default host `ports:` mapping — avoids conflicts with Coolify on **80**, **8080**, **9001**, etc.).
- **API** listens on **9001** inside the container (same: no host publish by default).

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

## 9. Platform Admin — database (migrations & seed)

If `prisma migrate deploy` on API startup did not run (e.g. missing `DATABASE_URL`, wrong service env), fix env and redeploy. The API now **fails fast** when `DATABASE_URL` is unset, so check Coolify logs for `start-api: FATAL — DATABASE_URL`.

**After the API is running**, a **platform admin** (see `PLATFORM_ADMIN_EMAILS`, default `admin@kqsoftwaresolutions.com` and legacy `admin@qsoft.com`) can open **Platform Admin → Database** in the web app and run:

- **Refresh status** — `prisma migrate status` (read-only)
- **Run migrate deploy** — same as startup migrations
- **Run seed** — `prisma db seed` (plans; optional test users — use only in controlled environments)

These call `POST/GET /api/v1/admin/database/...` and require a logged-in platform admin.

## 10. Smoke test

1. Open the web URL → register or log in (or use a seeded test account if you ran seed in that environment only).
2. Open `https://<api-domain>/health` (JSON `{ "status": "ok" }`) or trigger login from the app.
3. Create a project and upload a small test file.

If anything fails, check Coolify logs for `api` (migrations, `JWT_SECRET`, `DATABASE_URL`) and `web` (wrong `VITE_API_URL` → API calls go to the wrong host).
