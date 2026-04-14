# Start BRS with Docker Desktop

## Development stack (hot reload, default ports 9100 / 9101)

From the project root:

```bash
docker compose -f docker-compose.development.yml up -d
```

This will:

1. **Postgres** – host port `15432` → container `5432`
2. **Redis** – host port `16379` → container `6379`
3. **API** – dev server on **9101** (or `API_PORT` from `.env`)
4. **Web** – Vite dev server on **9100** (or `WEB_PORT` from `.env`)

**Production-style stack** (multi-stage build; nginx on **80** inside web, published on host **8080** by default; API **9001**):

```bash
docker compose up -d
```

Open **http://localhost:8080** (or set `WEB_PORT=80` if host port 80 is free).

## Open the app (development compose)

- Web UI: http://localhost:9100
- API: http://localhost:9101

## Restart after code changes

Development:

```bash
docker compose -f docker-compose.development.yml down
docker compose -f docker-compose.development.yml up -d --build
```

Production-style:

```bash
docker compose down
docker compose up -d --build
```

## View logs

```bash
docker compose -f docker-compose.development.yml logs -f
```

Or per service:

```bash
docker compose -f docker-compose.development.yml logs -f api
docker compose -f docker-compose.development.yml logs -f web
docker compose -f docker-compose.development.yml logs -f postgres
```

## Stop and remove

```bash
docker compose -f docker-compose.development.yml down
```

To also remove volumes (database data):

```bash
docker compose -f docker-compose.development.yml down -v
```
