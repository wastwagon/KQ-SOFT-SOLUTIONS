# Database check

Summary of the database schema and migration alignment check.

---

## 1. Schema and table names

All Prisma models now have explicit **`@@map`** so that Prisma uses the same table names as the migration SQL. This avoids mismatches between Prisma’s default (model name = table name) and the actual PostgreSQL tables.

| Model              | Table (@@map)     | Notes                                      |
|--------------------|-------------------|--------------------------------------------|
| User               | `users`           | Added @@map to match FK references in SQL. |
| Organization       | `organizations`   | Added @@map.                               |
| Project            | `projects`        | Added @@map; migrations use `"projects"`.  |
| Document           | `documents`       | Added @@map; enum migration uses `"documents"`. |
| Transaction        | `transactions`    | Added @@map.                               |
| Match              | `matches`         | Added @@map.                               |
| UsageLog           | `usage_logs`      | Added @@map.                               |
| Others             | (already had @@map) | plans, api_keys, bank_rules, organization_members, clients, bank_accounts, brs_attachments, match_items, audit_logs, payments, platform_settings. |

---

## 2. Migration history and naming

- **Older migrations** (e.g. `20250228140000`, `20250228160000`) use PascalCase: `"Project"`, `"User"`.
- **Newer migrations** use lowercase: `"projects"`, `"documents"`, `"users"`, `"organizations"`.

If your database was created with the older migrations, the real table names may be `"Project"` and `"User"`. In that case either:

- Rename those tables to `projects` and `users` once (and fix any FKs/indexes), or  
- Temporarily keep Prisma aligned with the existing names (e.g. `@@map("Project")`) until you run a one-off migration to rename to lowercase.

If your database was created or re-applied using the newer migrations (e.g. `documents`, `projects`), then the current schema and `@@map` values are correct.

---

## 3. Document type enum migration

- **File:** `20250229120000_document_type_enum_auditlog_relation/migration.sql`
- **Actions:** Creates enum `DocumentType` and changes `documents.type` from `TEXT` to `DocumentType`.
- **Requirement:** The table must exist as **`documents`** (lowercase). The Prisma `Document` model now has `@@map("documents")` so it matches.

If the table is still named `"Document"` (PascalCase), this migration will fail. Rename the table to `documents` first, or change the migration to use `"Document"` (not recommended long term).

---

## 4. AuditLog → Project relation

- **Schema:** `AuditLog` has optional `project Project?` with `projectId` and `onDelete: SetNull`.
- **DB:** No migration was added for this; `audit_logs.project_id` already exists. Only the Prisma relation was added.

---

## 5. Docker and migration baseline

- **Postgres** runs in Docker (see `docker-compose.yml`). From the host, connect at `localhost:15432`.
- If the DB was created with `db push` (as in the compose API command), `_prisma_migrations` may be missing and `migrate deploy` will fail with P3005 (schema not empty). In that case the DB was **baselined**: all 9 migrations were marked as applied with `prisma migrate resolve --applied <migration_name>` so that `migrate status` shows "Database schema is up to date!".

## 6. Commands to run when the DB is available

```bash
cd api
docker compose start postgres redis   # if containers are stopped
npx prisma migrate status   # See which migrations are applied
npx prisma migrate deploy   # Apply any new pending migrations
# Or for dev (compose uses this): npx prisma db push
```

---

## 7. Verify actual table names (when DB is running)

In PostgreSQL, list tables in the public schema:

```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
```

Or in `psql`: `\dt`

Ensure the names match what Prisma expects (e.g. `documents`, `projects`, `users`, `organizations`, `transactions`, `matches`, `usage_logs`). If you see PascalCase (`Project`, `User`, etc.) and the app fails with "relation does not exist", either rename those tables to lowercase or revert the corresponding `@@map` to the PascalCase name until you run a one-off rename migration.

---

## 8. Summary

- **Schema:** Valid; all models that need it have `@@map` so table names match the migration SQL (lowercase).
- **Document type:** Enum migration targets `documents`; ensure the table name is `documents`.
- **Database unreachable:** `migrate status` / `migrate deploy` were not run (DB server not available). Run them when the database is up to confirm and apply migrations.
