# Bank Reconciliation SaaS

**KQ SOFT SOLUTIONS** | Ghana

**Live production:** [https://kqsoftwaresolutions.com/](https://kqsoftwaresolutions.com/)

---

## Docker — Quick Start

**Local development** (hot reload, Vite + API dev servers; ports **9100** / **9101**):

```bash
cp .env.example .env   # Edit if needed
docker compose -f docker-compose.development.yml up -d
```

- **Web:** http://localhost:9100
- **API:** http://localhost:9101

**Production-style stack** (same as Coolify: multi-stage builds; **no host port publish** — Coolify reaches containers on the Docker network):

```bash
cp .env.example .env   # Set JWT_SECRET, VITE_API_URL, CORS_ORIGIN for a real run
docker compose up -d
```

To open the app in a **local browser** without Coolify, publish ports:

```bash
cp docker-compose.override.example.yml docker-compose.override.yml
docker compose up -d
```

Then use **http://localhost:8080** (web) and **http://localhost:9001** (API), or change `WEB_PORT` / `API_PORT` inside the override file.

**User manual:** See **[USER_MANUAL.pdf](USER_MANUAL.pdf)** for a comprehensive client handover guide (features, workflows, troubleshooting). Source: `USER_MANUAL.md`. To regenerate: `npm run manual:pdf` (requires Chrome).

**Using it yourself?** See **[docs/USE_IT_YOURSELF.md](docs/USE_IT_YOURSELF.md)** for a short run-through: start the app, sign in, create a project, upload cash book & bank statement, reconcile, and export the report.

**To use 9000/9001 instead**, remove or change in `.env`:

```
# WEB_PORT=9100
# API_PORT=9101
```

Then restart with the same `-f docker-compose.development.yml` you used to start.

**Production (VPS / Coolify):** **`docker-compose.yml`** is the production stack (same as **`docker-compose.prod.yml`**). Step-by-step: **[docs/DEPLOY_COOLIFY.md](docs/DEPLOY_COOLIFY.md)** (includes GitHub remote `wastwagon/kqsoftwaresolutions`).

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| Port 9000/9001 in use | Add `WEB_PORT=9100` and `API_PORT=9101` to `.env` |
| Port 6379 in use | Redis uses `16379` on host (internal stays 6379) |
| Port 5432 in use | Postgres uses `15432` on host (internal stays 5432) |
| Web container exits | Run `docker compose logs web` to see errors |

---

## Local Dev (Without Docker)

```bash
# 1. Start only Postgres and Redis (dev compose exposes 15432 / 16379 on the host)
docker compose -f docker-compose.development.yml up -d postgres redis

# 2. API
cd api && npm install && npm run dev   # → http://localhost:9001

# 3. Web (new terminal)
cd web && npm install && npm run dev   # → http://localhost:9000
```

Update `api/.env` with `DATABASE_URL=postgresql://postgres:postgres@localhost:15432/brs_db` for local Postgres.

---

## Testing

```bash
cd api && npm test          # Run Vitest unit tests
cd api && npm run test:watch   # Watch mode
```

Tests cover matching engine, Ghana bank parsers (Ecobank, GCB, Access), and reference extraction.
Current API test suite status: `19 files / 108 tests` (includes webhook handler, reconcile conflict, auth secret, API key limiter hardening, subscription lifecycle transition tests, CSV ingestion edge cases, OCR language resolution, OCR table line splitting heuristics including dual debit/credit columns, the public `/api/v1/public/plans` contract that always returns the four canonical tiers, the `/healthz` and `/readyz` probes with DB-timeout handling, the central error handler's Zod / Prisma / multer translation and production stack-leak guard, and the helmet security headers contract including CSP, HSTS, and `cross-origin-resource-policy`).

**Features:** Multi-bank (one project with multiple bank accounts), native PDF text extraction with OCR fallback, Ghana bank auto-detection (Ecobank, GCB, Access, Stanbic, Fidelity, UBA, Absa). **Premium report & dashboard:** Ghana-acceptable BRS layout, design tokens, narrative summary, preparer/reviewer comments, white-label branding; see `docs/PREMIUM_GHANA_IMPLEMENTATION_PLAN.md` and `docs/DESIGN_TOKENS.md`.

### OCR tuning (scanned PDFs / images)

Optional `api/.env` settings:

- `OCR_LANGS` — comma or plus list of Tesseract 3-letter codes, joined for recognition (example: `eng,fra` → `eng+fra`).
- `OCR_LANG` — single-language override (default `eng`). Ignored if `OCR_LANGS` is set.
- `PDF_OCR_SCALE` — render scale for PDF pages before OCR (default `2`, max `3`). Higher can improve accuracy but uses more CPU/RAM.
- `PDF_OCR_MAX_PAGES` — safety cap on pages OCR’d per PDF (default `50`).

For OCR and native PDF text, lines that start with a date may be split into **description + one amount**, or **description + two amounts** when two money values appear at the end (typical debit/credit columns). Map the extra column to **Credit** / **Debit** in the mapping step.

## Seed (test users and subscription tiers)

To create an admin account and one org per plan for testing limits and features:

```bash
cd api && npx prisma db push   # if not done already (schema in sync)
cd api && npx prisma db seed
```

**Password for all:** `Test123!`

**Roles:** Roles are enforced. Admin has full access; reviewer can approve, reopen, export; preparer can upload, map, reconcile; viewer is read-only. Settings > Members shows roles; org admins can change member roles.

| Account | Org plan | Purpose |
|--------|----------|--------|
| admin@kqsoftwaresolutions.com | firm | Admin role, full access (new seeds; legacy: `admin@qsoft.com`) |
| basic@test.com | basic | Test Basic limits (5 projects, 500 tx/month) |
| standard@test.com | standard | Test Standard (20 projects, 2000 tx/month) |
| premium@test.com | premium | Test Premium (100 projects, 10000 tx/month) |
| firm@test.com | firm | Test Firm (unlimited) |

Seed now also syncs realistic subscription samples:
- `basic@test.com`: no payment (trial/free lifecycle testing)
- `standard@test.com`, `premium@test.com`, `firm@test.com`: sample successful payments for active billing flows

Use this to sync existing or create missing sample users/orgs:

```bash
cd api && npx prisma db seed
```

---

## Email (Password Reset)

Password reset links are created by default. To send real emails in production:

1. Create an account at [resend.com](https://resend.com) and verify your domain (or use `onboarding@resend.dev` for testing).
2. Add to `api/.env`:
   ```
   RESEND_API_KEY=re_xxx
   EMAIL_FROM=BRS <noreply@yourdomain.com>
   APP_URL=https://yourdomain.com
   ```

Without `RESEND_API_KEY`, reset links are logged to the console in development.

---

## Billing (Paystack)

To enable plan upgrades in Settings > Billing:

1. Create a Paystack account at [paystack.com](https://paystack.com) (Ghana).
2. Add to `api/.env`:
   ```
   PAYSTACK_SECRET_KEY=sk_live_xxx
   PAYSTACK_WEBHOOK_SECRET=whsec_xxx  # Optional; from webhook settings
   ```
3. In Paystack Dashboard > Settings > Webhooks, add:
   ```
   https://yourdomain.com/api/v1/subscription/webhook
   ```

Without `PAYSTACK_SECRET_KEY`, the Billing section shows "Billing is not configured".

**Intro offer (50% off first payment):** Set `INTRO_OFFER_ENABLED=true` or `INTRO_OFFER_50_PCT=true` in `api/.env`. Eligible orgs (plan = basic, never used intro) see 50% off their first payment in Settings > Billing. After payment, the org is marked so the offer cannot be used again.

---

## Security and Release Checklist

Before deploying recent hardening updates, run:

```bash
cd api
npm run build
npm test -- --run
npm run db:migrate   # required: adds unique transaction match constraint
```

Environment checks:

- `JWT_SECRET` must be set to a strong secret in non-test environments (server now fails fast if missing).
- `PAYSTACK_SECRET_KEY` and `PAYSTACK_WEBHOOK_SECRET` should both be set when using billing webhooks.
- Ensure webhook endpoint uses exact URL path: `/api/v1/subscription/webhook`.

Operational behavior now enforced:

- Webhook signature verification uses raw request bytes.
- Duplicate Paystack references are treated as idempotent webhook retries.
- A transaction can only be part of one reconciliation match (DB + API conflict handling).
- Helmet sets CSP, HSTS (prod only), `X-Content-Type-Options`, `Referrer-Policy`, and related headers on every response.
- Per-IP rate limits: 30 req / 15 min on `/api/v1/auth/*`, 10 req / 1 hr on `/auth/forgot-password` and `/auth/reset-password`. Per-org limit: 30 calls / 1 hr to `/api/v1/subscription/initialize` (Paystack init).
- Zod validation, Prisma `P2002`/`P2025`/`P2003`, and Multer errors now map to friendly 4xx responses; production payloads never echo Prisma stack traces.
- Every response carries an `X-Request-Id` header (honoured if upstream proxy already set one) and every error JSON body includes the same `requestId` so a customer screenshot maps to a single log entry.

### Health & readiness endpoints

| Path | Purpose | When to use |
|------|---------|-------------|
| `GET /health` (alias `GET /healthz`) | Liveness — is the Node process up? Never touches the DB. | Coolify / k8s **liveness** probe. |
| `GET /readyz` | Readiness — is the DB reachable? Returns `503` with a `checks` object on failure. | Coolify / k8s **readiness** probe; load balancer health check. |

Tunables (`api/.env`):

- `LOG_LEVEL` — `trace` / `debug` / `info` / `warn` / `error` / `fatal` / `silent` (default `info`, `debug` in dev).
- `LOG_PRETTY=1` — force pretty-printed logs (default on in dev, off in prod).
- `READINESS_DB_TIMEOUT_MS` — ms before `/readyz` declares the DB dead (default `1500`).
- `HELMET_DISABLE_CSP=1` — escape hatch if a deployment must embed assets from an unexpected origin.

---

## Subscription Support Runbook

Use this when handling subscription/trial tickets safely in production.

1) Verify current state

```bash
cd api
npm run build
npm test -- --run
```

- In Platform Admin > Organization detail, confirm current `subscription` status and payment history.
- Check whether manual overrides exist before making changes.

2) Seed/sync sample data (staging or local only)

```bash
cd api
npx prisma db seed
```

- Safe to re-run; it syncs existing sample users/orgs and billing samples.
- Do not run seed on production unless explicitly approved for a controlled operation.

3) Apply controlled admin actions

- For trial extension: use "Update trial end" with a clear reason.
- For forced lifecycle state: use "Apply status override" with a clear reason.
- To restore computed behavior: use "Clear trial override" / "Clear status override" and record reason.

4) Rollback strategy

- Prefer rollback by clearing overrides first (non-destructive, audited).
- If a status was set incorrectly, apply the correct override with a new reason, then clear when no longer needed.
- Avoid direct database edits unless emergency-only and approved.

5) Post-change support checks

- Confirm `/api/v1/subscription/usage` reflects expected trial/active/expired/free state.
- Verify org limits still match current `plan`.
- For billing issues, confirm webhook signature secret and latest Paystack event/reference handling.

---

## Go-Live Checklist

Run this checklist on production rollout day.

### 1) Environment sanity

- `JWT_SECRET` is set (strong value, not empty).
- `PAYSTACK_SECRET_KEY` is set.
- `PAYSTACK_WEBHOOK_SECRET` is set.
- `APP_URL` points to the production web domain.
- `DATABASE_URL` points to the production Postgres instance.
- `RESEND_API_KEY` and `EMAIL_FROM` are set if password-reset emails must be delivered.

### 2) Backend deploy health

```bash
cd api
npm run build
npm run db:migrate
```

- Confirm migration succeeded before traffic is shifted.
- Confirm API process starts without missing-env errors.

### 3) Post-deploy smoke tests

Use a real admin account and one test org.

1. Authentication
   - Sign in successfully.
   - Trigger password reset and confirm email/log behavior is correct.
2. Core reconciliation
   - Create a project.
   - Upload cashbook + bank statement sample.
   - Map columns and run reconciliation.
   - Export the report.
3. Subscription usage
   - Open `Settings > Billing`.
   - Confirm subscription state shows expected status (`trial`/`active`/`expired`/`free`).
4. Admin controls
   - In Platform Admin > Organization detail:
     - set trial override with reason
     - set status override with reason
     - clear both overrides with reason
   - Confirm state updates immediately and actions are auditable.
5. Billing webhook path
   - Verify webhook URL configured as:
     - `/api/v1/subscription/webhook`
   - Confirm at least one webhook event is accepted and does not duplicate payment records.

### 4) Rollback guardrails

- First rollback step for subscription incidents: clear manual overrides.
- If deploy rollback is needed, restore previous app version first, then re-run smoke tests.
- Avoid manual DB edits except emergency, approved change windows.

---

## Project Structure

```
├── api/          # Backend (Node.js + Express + Prisma)
├── web/          # Frontend (React + TypeScript + Tailwind)
├── docker-compose.yml                    # production (Coolify default; no host ports)
├── docker-compose.prod.yml               # production (keep in sync)
├── docker-compose.development.yml        # local hot reload
├── docker-compose.override.example.yml   # optional: copy → docker-compose.override.yml for local ports
└── .env
```
