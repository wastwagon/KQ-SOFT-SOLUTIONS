#!/bin/sh
# Run Prisma migrations, then start the API.
#
# Recovery loop (max 8 rounds):
# 1) If log shows missing "projects" table (P3018 / 42P01): db push + mark all migrations applied.
# 2) Else if P3009 for a configured migration: migrate resolve --rolled-back, retry deploy.
#
# Order matters: first failure is often P3009 only (no SQL yet), so no "projects" line — we resolve
# first; the next deploy then hits P3018 and we bootstrap. Previously bootstrap ran only after the
# first failure, so P3009-only logs never triggered it.
#
# Disable bootstrap: PRISMA_BOOTSTRAP_EMPTY_DB=0
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

try_p3009_rolled_back() {
  MIGS="${PRISMA_AUTO_RESOLVE_MIGRATIONS-20250228140000_add_project_slug}"
  [ -n "$MIGS" ] || return 1
  grep -q "P3009" "$LOG" 2>/dev/null || return 1
  resolved_any=0
  OLDIFS=$IFS
  IFS=','
  for m in $MIGS; do
    m=$(printf '%s' "$m" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
    [ -z "$m" ] && continue
    if grep -q "$m" "$LOG" 2>/dev/null; then
      echo "start-api: P3009 mentions $m — prisma migrate resolve --rolled-back" >&2
      npx prisma migrate resolve --rolled-back "$m" --schema="$SCHEMA" >&2
      resolved_any=1
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

round=0
while [ "$round" -lt "$MAX_ROUNDS" ]; do
  if run_migrate >"$LOG" 2>&1; then
    rm -f "$LOG"
    trap - EXIT
    echo "start-api: prisma migrate deploy OK" >&2
    seed_plans
    echo "start-api: starting Node on port ${PORT:-9001}" >&2
    exec node dist/index.js
  fi

  cat "$LOG" >&2

  progressed=0

  if [ "${PRISMA_BOOTSTRAP_EMPTY_DB:-1}" != "0" ] && log_suggests_missing_projects_table; then
    bootstrap_empty_schema
    progressed=1
  elif try_p3009_rolled_back; then
    progressed=1
  fi

  if [ "$progressed" -eq 0 ]; then
    echo "start-api: no automatic recovery applied; fix DB/migrations or env and redeploy." >&2
    exit 1
  fi

  round=$((round + 1))
done

echo "start-api: migration recovery exceeded $MAX_ROUNDS rounds" >&2
exit 1
