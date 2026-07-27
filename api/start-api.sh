#!/bin/sh
# Run Prisma migrations, then start the API.
#
# Recovery loop (max 8 rounds):
# 1) If log shows missing "projects" table (P3018 / 42P01): db push + mark all migrations applied.
# 2) Else if P3009 for a configured migration: migrate resolve --rolled-back, retry deploy.
#    Also auto-detects migration names from the P3009 log (e.g. organization_match_memory).
#
# Order matters: first failure is often P3009 only (no SQL yet), so no "projects" line — we resolve
# first; the next deploy then hits P3018 and we bootstrap. Previously bootstrap ran only after the
# first failure, so P3009-only logs never triggered it.
#
# Disable bootstrap: PRISMA_BOOTSTRAP_EMPTY_DB=0
# Override P3009 auto-resolve list: PRISMA_AUTO_RESOLVE_MIGRATIONS=name1,name2
# Disable P3009 auto-resolve: PRISMA_AUTO_RESOLVE_MIGRATIONS="" (empty)
set -eu
SCHEMA="./prisma/schema.prisma"
MAX_ROUNDS=8

if [ "${NODE_ENV:-}" = "production" ]; then
  if [ -z "${JWT_SECRET:-}" ] || [ "$JWT_SECRET" = "dev-secret" ]; then
    echo "start-api: FATAL — JWT_SECRET is missing, empty, or still \"dev-secret\"." >&2
    echo "start-api: In Coolify → this resource → Environment, set JWT_SECRET (32+ random characters), then redeploy." >&2
    exit 1
  fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "start-api: FATAL — DATABASE_URL is not set. Migrations cannot run." >&2
  echo "start-api: In Coolify, set DATABASE_URL for the api service to your PostgreSQL connection string, then redeploy." >&2
  exit 1
fi

run_migrate() {
  npx prisma migrate deploy --schema="$SCHEMA"
}

# Prisma / Postgres wording varies slightly; keep patterns tight enough to avoid false positives.
log_suggests_missing_projects_table() {
  grep -qF 'relation "projects" does not exist' "$LOG" 2>/dev/null \
    || grep -qE 'relation[[:space:]]+"projects"[[:space:]]+does not exist' "$LOG" 2>/dev/null
}

bootstrap_empty_schema() {
  echo "start-api: empty database (no projects table) — prisma db push + migrate resolve --applied (all)" >&2
  echo "start-api: set PRISMA_BOOTSTRAP_EMPTY_DB=0 to disable. Do not use on DBs with real data you need." >&2
  printf '%s\n' 'DELETE FROM "_prisma_migrations";' | npx prisma db execute --stdin --schema="$SCHEMA" >&2 || true
  npx prisma db push --schema="$SCHEMA" --skip-generate >&2
  for name in $(ls -1 prisma/migrations 2>/dev/null | LC_ALL=C sort); do
    case "$name" in 20*) ;;
    *) continue ;;
    esac
    [ -d "prisma/migrations/$name" ] || continue
    echo "start-api: migrate resolve --applied $name" >&2
    npx prisma migrate resolve --applied "$name" --schema="$SCHEMA" >&2
  done
}

# Returns 0 if public table $1 exists (best-effort; used to choose --applied vs --rolled-back).
pg_table_exists() {
  table="$1"
  node --input-type=module -e "
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
try {
  const rows = await p.\$queryRawUnsafe(
    \"SELECT to_regclass('public.$table') AS r\"
  );
  process.exit(rows[0]?.r ? 0 : 1);
} catch {
  process.exit(1);
} finally {
  await p.\$disconnect();
}
" 2>/dev/null
}

# Known failed-migration → table created by that migration (partial apply detection).
migration_object_exists() {
  case "$1" in
    20260718110000_organization_match_memory|20260727090000_ensure_organization_match_memories)
      pg_table_exists organization_match_memories
      ;;
    *)
      return 1
      ;;
  esac
}

try_p3009_recover() {
  # Clear failed migration rows so migrate deploy can retry (or skip if already applied).
  # 1) Env list PRISMA_AUTO_RESOLVE_MIGRATIONS (comma-separated)
  # 2) Plus any migration name mentioned in the P3009 log (`2026…_name`)
  grep -q "P3009" "$LOG" 2>/dev/null || return 1

  DEFAULT_MIGS="20250228140000_add_project_slug,20260718110000_organization_match_memory,20260727090000_ensure_organization_match_memories"
  MIGS="${PRISMA_AUTO_RESOLVE_MIGRATIONS-$DEFAULT_MIGS}"

  names=""
  if [ -n "$MIGS" ]; then
    names="$MIGS"
  fi
  # Prisma: The `20260718110000_organization_match_memory` migration ... failed
  from_log=$(grep -oE '`[0-9]{14}_[a-zA-Z0-9_]+`' "$LOG" 2>/dev/null | tr -d '`' | sort -u | tr '\n' ',' || true)
  if [ -n "$from_log" ]; then
    names="${names},${from_log}"
  fi

  resolved_any=0
  OLDIFS=$IFS
  IFS=','
  for m in $names; do
    m=$(printf '%s' "$m" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    [ -z "$m" ] && continue
    # Only act when this migration is named in the failure log
    if ! grep -q "$m" "$LOG" 2>/dev/null; then
      continue
    fi
    # Partial apply: table already there → mark applied. Else roll back so deploy can re-run SQL.
    if migration_object_exists "$m"; then
      echo "start-api: P3009 — $m objects already exist; migrate resolve --applied" >&2
      if npx prisma migrate resolve --applied "$m" --schema="$SCHEMA" >&2; then
        resolved_any=1
      fi
    else
      echo "start-api: P3009 — resolving failed migration $m as rolled-back (will retry deploy)" >&2
      if npx prisma migrate resolve --rolled-back "$m" --schema="$SCHEMA" >&2; then
        resolved_any=1
      else
        # Never mark --applied when the migration object is missing — that leaves
        # migrate deploy "OK" while runtime queries crash (P2021).
        echo "start-api: WARN — migrate resolve --rolled-back $m failed; not marking applied (table missing)" >&2
      fi
    fi
  done
  IFS=$OLDIFS
  [ "$resolved_any" -eq 1 ]
}

LOG=$(mktemp)
trap 'rm -f "$LOG"' EXIT

seed_plans() {
  # Idempotent — keeps existing admin-edited rows. Disable with SEED_PLANS_ON_BOOT=0.
  # Force-reset to defaults with FORCE_PLAN_RESET=1.
  if [ "${SEED_PLANS_ON_BOOT:-1}" = "0" ]; then
    return 0
  fi
  if [ ! -f prisma/seed-plans.ts ]; then
    echo "start-api: seed-plans.ts not found — skipping plan seed" >&2
    return 0
  fi
  echo "start-api: seeding canonical subscription plans (idempotent)" >&2
  if ! npx tsx prisma/seed-plans.ts >&2; then
    # Don't fail the deploy if seeding plans hiccups — landing page falls back
    # to PLAN_PRICES config and frontend has its own static catalogue.
    echo "start-api: WARN — seed-plans failed; continuing with config fallback" >&2
  fi
}

seed_demo_users() {
  # Optional demo accounts (premium@test.com / Test123!, etc.). Off by default in production.
  # Enable in Coolify → api service → SEED_DEMO_USERS=1, then redeploy once.
  if [ "${SEED_DEMO_USERS:-0}" != "1" ]; then
    return 0
  fi
  if [ ! -f prisma/seed.ts ]; then
    echo "start-api: seed.ts not found — skipping demo user seed" >&2
    return 0
  fi
  echo "start-api: seeding demo users (SEED_DEMO_USERS=1; password Test123!)" >&2
  if ! npx tsx prisma/seed.ts >&2; then
    echo "start-api: WARN — demo user seed failed; continuing" >&2
  fi
}

# If migrate history says applied but the table was never created (false --applied),
# create it now so Reconcile does not crash with P2021.
ensure_organization_match_memories() {
  if pg_table_exists organization_match_memories; then
    return 0
  fi
  # Prefer the idempotent ensure migration; fall back to original create migration.
  SQL_FILE="prisma/migrations/20260727090000_ensure_organization_match_memories/migration.sql"
  if [ ! -f "$SQL_FILE" ]; then
    SQL_FILE="prisma/migrations/20260718110000_organization_match_memory/migration.sql"
  fi
  if [ ! -f "$SQL_FILE" ]; then
    echo "start-api: WARN — match-memory SQL missing; cannot heal organization_match_memories" >&2
    return 1
  fi
  echo "start-api: organization_match_memories missing after migrate OK — applying $SQL_FILE" >&2
  if npx prisma db execute --file "$SQL_FILE" --schema="$SCHEMA" >&2; then
    if pg_table_exists organization_match_memories; then
      echo "start-api: organization_match_memories created" >&2
      npx prisma migrate resolve --applied 20260727090000_ensure_organization_match_memories --schema="$SCHEMA" >&2 || true
      npx prisma migrate resolve --applied 20260718110000_organization_match_memory --schema="$SCHEMA" >&2 || true
      return 0
    fi
    echo "start-api: WARN — SQL ran but organization_match_memories still missing" >&2
    return 1
  fi
  echo "start-api: WARN — failed to create organization_match_memories; Reconcile soft-fails without org memory" >&2
  return 1
}

# If migrate deploy fails because objects already exist (partial prior run), mark that migration applied.
try_mark_applied_on_already_exists() {
  grep -qiE 'already exists|duplicate key|42P07|42710' "$LOG" 2>/dev/null || return 1
  from_log=$(grep -oE '`[0-9]{14}_[a-zA-Z0-9_]+`' "$LOG" 2>/dev/null | tr -d '`' | sort -u || true)
  # Also try current pending from migrate status is hard in shell — use last failed name from P3009 style
  if [ -z "$from_log" ]; then
    from_log=$(grep -oE '[0-9]{14}_[a-zA-Z0-9_]+' "$LOG" 2>/dev/null | head -5 | sort -u || true)
  fi
  [ -n "$from_log" ] || return 1
  resolved_any=0
  for m in $from_log; do
    echo "start-api: schema object already exists — migrate resolve --applied $m" >&2
    if npx prisma migrate resolve --applied "$m" --schema="$SCHEMA" >&2; then
      resolved_any=1
    fi
  done
  [ "$resolved_any" -eq 1 ]
}

round=0
while [ "$round" -lt "$MAX_ROUNDS" ]; do
  if run_migrate >"$LOG" 2>&1; then
    rm -f "$LOG"
    trap - EXIT
    echo "start-api: prisma migrate deploy OK" >&2
    ensure_organization_match_memories
    seed_plans
    seed_demo_users
    echo "start-api: starting Node on port ${PORT:-9001}" >&2
    exec node dist/index.js
  fi

  cat "$LOG" >&2

  progressed=0

  if [ "${PRISMA_BOOTSTRAP_EMPTY_DB:-1}" != "0" ] && log_suggests_missing_projects_table; then
    bootstrap_empty_schema
    progressed=1
  elif try_p3009_recover; then
    progressed=1
  elif try_mark_applied_on_already_exists; then
    progressed=1
  fi

  if [ "$progressed" -eq 0 ]; then
    echo "start-api: no automatic recovery applied; fix DB/migrations or env and redeploy." >&2
    echo "start-api: For P3009 on match_memory, in Coolify Terminal (api) run:" >&2
    echo "start-api:   npx prisma migrate resolve --rolled-back 20260718110000_organization_match_memory --schema=./prisma/schema.prisma" >&2
    echo "start-api:   npx prisma migrate deploy --schema=./prisma/schema.prisma" >&2
    exit 1
  fi

  round=$((round + 1))
done

echo "start-api: migration recovery exceeded $MAX_ROUNDS rounds" >&2
exit 1
