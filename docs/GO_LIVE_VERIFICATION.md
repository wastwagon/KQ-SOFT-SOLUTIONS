# Go-live verification (unified)

**This is the ship checklist** for Ghana BRS product go-live (matching, parsers, identity, date order, count-match diagnostic, clean-export A+B).

Matching methodology close-out only (FX/partials, pattern banks) lives in [MATCHING_GO_LIVE.md](./MATCHING_GO_LIVE.md) — do not treat that file as the full product gate.

Customer training week plan in the in-app user manual is separate from this engineer/ops verify harness.

## Quick run

From repo root (Postgres on `localhost:15441`):

```bash
chmod +x scripts/verify-go-live.sh
./scripts/verify-go-live.sh
```

With live API checks (API must be healthy on `:9101`):

```bash
./scripts/verify-go-live.sh --with-live-api
```

Authenticated create + report entity check:

```bash
SMOKE_EMAIL='you@example.com' SMOKE_PASSWORD='…' ./scripts/verify-go-live.sh --with-live-api
```

## What it covers

| Layer | Coverage |
|-------|----------|
| Matching false-positives | Unit: null dates, bank-rule corroboration, SCB unique-amount, multi-sum helpers |
| Pattern banks | Unit: Ecobank, SCB, GCB, NIB, Prudential, Absa, BOA |
| Parsers | Unit: GCB/NIB/Prudential/Absa/BOA/SCB statement tests |
| Count-match diagnostic | Unit + DB smoke helpers: open/cancel classification (never auto-clears) |
| Newest-first date order | Unit: import/cleanup/reconcile sort (30 Dec → 1 Jan) |
| Clean export A+B | Unit: sample truncate + watermark; smoke: tier quotas + `clean_exports_count`; route enforces full-export quota |
| Phase B UI logic | Web unit: `phasedAutoMatch`, profile tips |
| Project identity | DB smoke: create project with `statementBusinessName`, report entity resolution, cleanup |
| Live API (optional) | `/healthz`, optional login → create project → report entity name |

## API-only shortcuts

```bash
cd api
npm run test:go-live          # unit packs only
npm run verify:go-live        # DB unification smoke only
```

## Manual UI checklist (5 minutes)

1. **New project** — fill statement business name, account name/number, closing date → name auto-composes.
2. Open project header → “On statement” shows the business name; edit + save works.
3. **Report** — company line shows statement business name (not firm org name). PDF/Excel same.
4. **Reconcile** — bank tip banner (where detected); Phase B says “safe → patterns”; **Match by counting** panel lists/export work; counts never auto-clear.
5. **Date order** — reconcile tables and cleanup preview show **newest date first**.
6. **Clean tools** — Sample Excel/PDF watermarked + truncated; Full export shows remaining quota and blocks at limit.
7. Legacy project with empty statement business name — report still shows org name.

## If Docker API is unhealthy

Dev compose mounts a named `api_node_modules` volume. If logs show `Cannot find package 'pino-http'`:

```bash
docker compose -f docker-compose.development.yml run --rm --no-deps api npm install
docker compose -f docker-compose.development.yml up -d redis api
```

Redis is internal-only in `docker-compose.development.yml` (no host port) so it does not clash with other local stacks.
