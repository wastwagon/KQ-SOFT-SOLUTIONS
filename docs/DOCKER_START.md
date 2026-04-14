# Start BRS with Docker Desktop

## Start everything

From the project root:

```bash
docker compose up -d
```

This will:

1. **Postgres** – start on port `15432`
2. **Redis** – start on port `16379`
3. **API** – run `prisma db push` (sync schema; avoids P3005 on existing DB), then start on port `9101` (or `9001` if `API_PORT` not set)
4. **Web** – start on port `9100` (or `9000` if `WEB_PORT` not set)

**Default ports (see `.env.example`):** Web 9100, API 9101 — to avoid conflicts with other Docker services.

## Open the app

- Web UI: http://localhost:9100
- API: http://localhost:9101

## Restart after code changes

```bash
docker compose down
docker compose up -d --build
```

`--build` rebuilds images so code changes are picked up.

## View logs

```bash
docker compose logs -f
```

Or per service:

```bash
docker compose logs -f api
docker compose logs -f web
docker compose logs -f postgres
```

## Stop everything

```bash
docker compose down
```

To also remove data volumes (e.g. database):

```bash
docker compose down -v
```
